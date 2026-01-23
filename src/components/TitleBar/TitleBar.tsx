import { memo, useCallback, useState, useEffect } from 'react';
import { X, Settings, Minus, RefreshCw } from 'lucide-react';
import './TitleBar.css';

interface TitleBarProps {
  onSettings: () => void;
  resizeMode?: boolean;
  onSync?: () => void;
  googleConnected?: boolean;
}

export const TitleBar = memo(function TitleBar({
  onSettings,
  resizeMode = false,
  onSync,
  googleConnected = false,
}: TitleBarProps) {
  const [syncCooldown, setSyncCooldown] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // 쿨다운 타이머
  useEffect(() => {
    if (syncCooldown > 0) {
      const timer = setTimeout(() => setSyncCooldown(syncCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [syncCooldown]);

  const handleSync = useCallback(async () => {
    if (syncCooldown > 0 || isSyncing || !onSync) return;

    setIsSyncing(true);
    try {
      await onSync();
    } finally {
      setIsSyncing(false);
      setSyncCooldown(10); // 10초 쿨다운
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
