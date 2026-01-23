import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { Settings } from '../../types';
import './Settings.css';

const WEEKDAYS = [
  { id: 0, short: 'Sun', full: 'Sunday' },
  { id: 1, short: 'Mon', full: 'Monday' },
  { id: 2, short: 'Tue', full: 'Tuesday' },
  { id: 3, short: 'Wed', full: 'Wednesday' },
  { id: 4, short: 'Thu', full: 'Thursday' },
  { id: 5, short: 'Fri', full: 'Friday' },
  { id: 6, short: 'Sat', full: 'Saturday' },
];

interface AdvancedSettingsProps {
  settings: Settings;
  onUpdateSettings: (updates: Partial<Settings>) => void;
  onClose: () => void;
}

export function AdvancedSettings({
  settings,
  onUpdateSettings,
  onClose,
}: AdvancedSettingsProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragHandleRef = useRef<HTMLDivElement>(null);

  const hiddenDays = settings.hiddenDays || [];

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

  const toggleDay = (dayId: number) => {
    const newHiddenDays = hiddenDays.includes(dayId)
      ? hiddenDays.filter(d => d !== dayId)
      : [...hiddenDays, dayId];

    // 최소 1일은 표시되어야 함
    if (newHiddenDays.length >= 7) return;

    onUpdateSettings({ hiddenDays: newHiddenDays });
  };

  const hideWeekends = () => {
    onUpdateSettings({ hiddenDays: [0, 6] });
  };

  const showAllDays = () => {
    onUpdateSettings({ hiddenDays: [] });
  };

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
          {/* 요일 표시 설정 */}
          <div className="setting-item">
            <label>
              Visible Days
              <span className="setting-hint">Select which days to show on calendar</span>
            </label>

            <div className="weekday-selector">
              {WEEKDAYS.map(day => (
                <button
                  key={day.id}
                  className={`weekday-btn ${!hiddenDays.includes(day.id) ? 'active' : ''}`}
                  onClick={() => toggleDay(day.id)}
                  title={day.full}
                >
                  {day.short}
                </button>
              ))}
            </div>

            <div className="weekday-presets">
              <button
                className="preset-btn"
                onClick={hideWeekends}
              >
                Weekdays Only
              </button>
              <button
                className="preset-btn"
                onClick={showAllDays}
              >
                Show All
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
