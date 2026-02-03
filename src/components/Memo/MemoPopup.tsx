import { useState, useEffect, useCallback, useRef } from 'react';
import { X, StickyNote, Pin, PinOff } from 'lucide-react';
import type { Memo } from '../../types';
import './MemoPopup.css';

export function MemoPopup() {
  const [memo, setMemo] = useState<Memo | null>(null);
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [accentColor, setAccentColor] = useState<'blue' | 'orange'>('blue');
  const [memoId, setMemoId] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // URL에서 메모 ID 파싱
  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const id = params.get('id');
    setMemoId(id);
  }, []);

  // 테마 및 메모 불러오기
  useEffect(() => {
    const loadData = async () => {
      // 테마 로드
      if (window.electronAPI?.getSettings) {
        const settings = await window.electronAPI.getSettings();
        // 기존 orange 테마 마이그레이션 처리
        if (settings?.theme === 'orange') {
          setTheme('dark');
          setAccentColor('orange');
        } else if (settings?.theme) {
          setTheme(settings.theme as 'light' | 'dark');
          setAccentColor(settings.accentColor || 'blue');
        }
      }

      // 메모 로드 (id가 있으면 해당 메모, 없으면 새 메모)
      if (memoId && window.electronAPI?.getMemo) {
        const savedMemo = await window.electronAPI.getMemo(memoId);
        if (savedMemo) {
          setMemo(savedMemo);
          setContent(savedMemo.content);
        }
      }
      // memoId가 null이면 새 메모 (빈 상태 유지)
    };
    loadData();
  }, [memoId]);

  // 패널 열릴 때 textarea에 포커스
  useEffect(() => {
    const timer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // 자동 저장 (디바운스)
  const saveMemo = useCallback(async (newContent: string) => {
    if (!window.electronAPI?.saveMemo) return;

    setIsSaving(true);
    const now = new Date().toISOString();
    const newMemo: Memo = {
      id: memo?.id || crypto.randomUUID(),
      content: newContent,
      createdAt: memo?.createdAt || now,
      updatedAt: now,
    };

    await window.electronAPI.saveMemo(newMemo);
    setMemo(newMemo);
    setIsSaving(false);
  }, [memo]);

  // 내용 변경 시 자동 저장 (500ms 디바운스)
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveMemo(newContent);
    }, 500);
  };

  // 컴포넌트 언마운트 시 저장
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleClose = () => {
    window.electronAPI?.closeMemo();
  };

  // 핀 고정 토글
  const handlePinToggle = useCallback(() => {
    const newPinned = !isPinned;
    setIsPinned(newPinned);
    window.electronAPI?.setMemoPinned?.(newPinned);
  }, [isPinned]);

  // 리사이즈 핸들러
  const handleResizeStart = (direction: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    window.electronAPI?.startResize(direction);

    const handleMouseUp = () => {
      window.electronAPI?.stopResize();
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mouseup', handleMouseUp);
  };

  // 메모 미리보기 (첫 줄)
  const getMemoTitle = () => {
    if (!content) return 'Memo';
    const firstLine = content.split('\n')[0].trim();
    if (firstLine.length > 15) {
      return firstLine.substring(0, 15) + '...';
    }
    return firstLine || 'Memo';
  };

  return (
    <div className={`memo-popup-container ${theme} ${accentColor} ${isPinned ? 'pinned' : ''}`}>
      {/* 리사이즈 핸들 - 핀 고정 시 비활성화 */}
      {!isPinned && (
        <>
          <div className="resize-handle resize-n" onMouseDown={handleResizeStart('n')} />
          <div className="resize-handle resize-s" onMouseDown={handleResizeStart('s')} />
          <div className="resize-handle resize-e" onMouseDown={handleResizeStart('e')} />
          <div className="resize-handle resize-w" onMouseDown={handleResizeStart('w')} />
          <div className="resize-handle resize-ne" onMouseDown={handleResizeStart('ne')} />
          <div className="resize-handle resize-nw" onMouseDown={handleResizeStart('nw')} />
          <div className="resize-handle resize-se" onMouseDown={handleResizeStart('se')} />
          <div className="resize-handle resize-sw" onMouseDown={handleResizeStart('sw')} />
        </>
      )}

      {/* Header */}
      <div className="memo-popup-header">
        <div className="memo-popup-title">
          <StickyNote size={18} />
          <span>{getMemoTitle()}</span>
        </div>
        <div className="memo-popup-controls">
          <button
            className={`memo-popup-btn pin ${isPinned ? 'active' : ''}`}
            onClick={handlePinToggle}
            title={isPinned ? '고정 해제' : '바탕화면에 고정'}
          >
            {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
          </button>
          {!isPinned && (
            <button className="memo-popup-btn close" onClick={handleClose}>
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="memo-popup-content">
        {isPinned ? (
          <div className="memo-popup-display">
            {content || 'Write your memo here...'}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            className="memo-popup-textarea"
            value={content}
            onChange={handleContentChange}
            placeholder="Write your memo here..."
            autoFocus
          />
        )}
      </div>

      {/* Footer - 핀 고정 시 숨김 */}
      {!isPinned && (
        <div className="memo-popup-footer">
          {isSaving ? (
            <span className="memo-status saving">Saving...</span>
          ) : memo?.updatedAt ? (
            <span className="memo-status saved">
              Last saved: {new Date(memo.updatedAt).toLocaleTimeString()}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
