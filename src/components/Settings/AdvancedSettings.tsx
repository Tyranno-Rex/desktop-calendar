import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { Settings } from '../../types';
import './Settings.css';

interface AdvancedSettingsProps {
  settings: Settings;
  onUpdateSettings: (updates: Partial<Settings>) => void;
  onClose: () => void;
}

export function AdvancedSettings({
  settings: _settings,
  onUpdateSettings: _onUpdateSettings,
  onClose,
}: AdvancedSettingsProps) {
  // 나중에 고급 설정 항목 추가 시 사용할 props
  void _settings;
  void _onUpdateSettings;
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragHandleRef = useRef<HTMLDivElement>(null);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleDragHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      className="settings-backdrop"
      onClick={handleBackdropClick}
    >
      <div
        className="settings-panel advanced-settings-panel"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`
        }}
      >
        <div className="settings-header">
          <div
            className="settings-drag-handle"
            ref={dragHandleRef}
            onMouseDown={handleDragHandleMouseDown}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          >
            <h3>Advanced Settings</h3>
          </div>
          <button className="btn-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="settings-content">
          {/* 여기에 고급 설정 항목들이 추가될 예정 */}
          <div className="advanced-placeholder">
            <p>Advanced settings will be available here.</p>
            <p className="placeholder-hint">More options coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  );
}
