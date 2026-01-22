import { memo, useCallback } from 'react';
import { X, Settings, Minus } from 'lucide-react';
import './TitleBar.css';

interface TitleBarProps {
  onSettings: () => void;
  resizeMode?: boolean;
}

export const TitleBar = memo(function TitleBar({
  onSettings,
  resizeMode = false,
}: TitleBarProps) {
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
