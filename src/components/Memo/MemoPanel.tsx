import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, StickyNote } from 'lucide-react';
import type { Memo } from '../../types';
import './Memo.css';

interface MemoPanelProps {
  onClose: () => void;
  position?: 'left' | 'right';
}

export function MemoPanel({ onClose, position = 'right' }: MemoPanelProps) {
  const [memo, setMemo] = useState<Memo | null>(null);
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 메모 불러오기
  useEffect(() => {
    const loadMemo = async () => {
      if (window.electronAPI?.getMemo) {
        const savedMemo = await window.electronAPI.getMemo();
        if (savedMemo) {
          setMemo(savedMemo);
          setContent(savedMemo.content);
        }
      }
    };
    loadMemo();
  }, []);

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

  const slideDirection = position === 'left' ? -320 : 320;

  return (
    <motion.div
      className={`memo-panel ${position}`}
      initial={{ x: slideDirection, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: slideDirection, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
    >
      <div className="memo-header">
        <div className="memo-title">
          <StickyNote size={18} />
          <span>Memo</span>
        </div>
        <button className="memo-close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="memo-content">
        <textarea
          ref={textareaRef}
          className="memo-textarea"
          value={content}
          onChange={handleContentChange}
          onClick={() => textareaRef.current?.focus()}
          placeholder="Write your memo here..."
          autoFocus
        />
      </div>

      <div className="memo-footer">
        {isSaving ? (
          <span className="memo-status saving">Saving...</span>
        ) : memo?.updatedAt ? (
          <span className="memo-status saved">
            Last saved: {new Date(memo.updatedAt).toLocaleTimeString()}
          </span>
        ) : null}
      </div>
    </motion.div>
  );
}
