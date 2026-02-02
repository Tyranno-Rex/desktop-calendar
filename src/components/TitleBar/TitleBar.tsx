import { memo, useCallback, useState, useEffect, useRef } from 'react';
import { X, Settings, Minus, RefreshCw, StickyNote, Plus, Trash2 } from 'lucide-react';
import type { Memo } from '../../types';
import './TitleBar.css';

interface TitleBarProps {
  onSettings: () => void;
  resizeMode?: boolean;
  onSync?: () => void;
  googleConnected?: boolean;
  onMemo?: (id?: string) => void;
  showMemoButton?: boolean;
}

export const TitleBar = memo(function TitleBar({
  onSettings,
  resizeMode = false,
  onSync,
  googleConnected = false,
  onMemo,
  showMemoButton = true,
}: TitleBarProps) {
  const [syncCooldown, setSyncCooldown] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showMemoMenu, setShowMemoMenu] = useState(false);
  const [memos, setMemos] = useState<Memo[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  // 쿨다운 타이머
  useEffect(() => {
    if (syncCooldown > 0) {
      const timer = setTimeout(() => setSyncCooldown(syncCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [syncCooldown]);

  // 메모 목록 불러오기
  const loadMemos = useCallback(async () => {
    if (window.electronAPI?.getMemos) {
      const loadedMemos = await window.electronAPI.getMemos();
      setMemos(loadedMemos);
    }
  }, []);

  // 메뉴 열릴 때 메모 목록 불러오기
  useEffect(() => {
    if (showMemoMenu) {
      loadMemos();
    }
  }, [showMemoMenu, loadMemos]);

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMemoMenu(false);
      }
    };

    if (showMemoMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMemoMenu]);

  const handleSync = useCallback(async () => {
    if (syncCooldown > 0 || isSyncing || !onSync) return;

    setIsSyncing(true);
    try {
      await onSync();
    } finally {
      setIsSyncing(false);
      setSyncCooldown(30); // 30초 쿨다운
    }
  }, [syncCooldown, isSyncing, onSync]);

  const handleMinimize = useCallback(() => {
    window.electronAPI?.minimizeWindow();
  }, []);

  const handleClose = useCallback(() => {
    window.electronAPI?.closeWindow();
  }, []);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!resizeMode) return;
    e.preventDefault();
    window.electronAPI?.startMove();

    const handleMouseUp = () => {
      window.electronAPI?.stopMove();
      window.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseup', handleMouseUp);
  }, [resizeMode]);

  const handleMemoClick = useCallback(() => {
    setShowMemoMenu(!showMemoMenu);
  }, [showMemoMenu]);

  const handleNewMemo = useCallback(() => {
    setShowMemoMenu(false);
    onMemo?.();
  }, [onMemo]);

  const handleOpenMemo = useCallback((id: string) => {
    setShowMemoMenu(false);
    onMemo?.(id);
  }, [onMemo]);

  const handleDeleteMemo = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.electronAPI?.deleteMemo) {
      await window.electronAPI.deleteMemo(id);
      loadMemos();
    }
  }, [loadMemos]);

  // 메모 미리보기 텍스트 생성
  const getMemoPreview = (memo: Memo) => {
    const firstLine = memo.content.split('\n')[0].trim();
    if (firstLine.length > 20) {
      return firstLine.substring(0, 20) + '...';
    }
    return firstLine || '(빈 메모)';
  };

  return (
    <div className={`title-bar ${resizeMode ? 'title-bar-movable' : ''}`}>
      <div
        className="title-bar-drag"
        onMouseDown={handleDragStart}
        style={{ cursor: resizeMode ? 'move' : 'default' }}
      >
        <span className="title-text">Calendar</span>
      </div>

      {/* 윈도우 스타일 버튼 */}
      <div className="window-controls">
        {showMemoButton && onMemo && (
          <div className="memo-btn-container" ref={menuRef}>
            <button className="window-btn memo" onClick={handleMemoClick} title="Memo">
              <StickyNote size={16} />
            </button>
            {showMemoMenu && (
              <div className="memo-dropdown">
                <button className="memo-dropdown-item new" onClick={handleNewMemo}>
                  <Plus size={14} />
                  <span>새 메모장</span>
                </button>
                {memos.length > 0 && <div className="memo-dropdown-divider" />}
                {memos.map(memo => (
                  <div
                    key={memo.id}
                    className="memo-dropdown-item"
                    onClick={() => handleOpenMemo(memo.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleOpenMemo(memo.id)}
                  >
                    <StickyNote size={14} />
                    <span className="memo-preview">{getMemoPreview(memo)}</span>
                    <button
                      className="memo-delete-btn"
                      onClick={(e) => handleDeleteMemo(e, memo.id)}
                      title="삭제"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {googleConnected && (
          <button
            className={`window-btn sync ${isSyncing ? 'syncing' : ''} ${syncCooldown > 0 ? 'cooldown' : ''}`}
            onClick={handleSync}
            disabled={syncCooldown > 0 || isSyncing}
            title={syncCooldown > 0 ? `${syncCooldown}초 후 동기화 가능` : 'Google Calendar 동기화'}
          >
            <RefreshCw size={16} className={isSyncing ? 'spinning' : ''} />
            {syncCooldown > 0 && <span className="cooldown-badge">{syncCooldown}</span>}
          </button>
        )}
        <button className="window-btn settings" onClick={onSettings} title="Settings">
          <Settings size={16} />
        </button>
        <button className="window-btn minimize" onClick={handleMinimize} title="Minimize">
          <Minus size={16} />
        </button>
        <button className="window-btn close" onClick={handleClose} title="Close">
          <X size={16} />
        </button>
      </div>
    </div>
  );
});
