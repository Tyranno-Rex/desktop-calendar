import { memo, useCallback } from 'react';
import { Menu, X, Settings, Minus } from 'lucide-react';
import './TitleBar.css';

interface TitleBarProps {
  onSettings: () => void;
  resizeMode?: boolean;
  showPanelToggle?: boolean;
  isPanelOpen?: boolean;
  onTogglePanel?: () => void;
}

export const TitleBar = memo(function TitleBar({
  onSettings,
  resizeMode = false,
  showPanelToggle = false,
  isPanelOpen = false,
  onTogglePanel,
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
        {showPanelToggle && (
          <button
            className="window-btn panel-toggle"
            onClick={onTogglePanel}
            title={isPanelOpen ? 'Hide Panel' : 'Show Panel'}
          >
            {isPanelOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        )}
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
