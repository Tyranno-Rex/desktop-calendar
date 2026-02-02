import { useState, useRef, useCallback, useEffect } from 'react';
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
          {/* 공휴일 표시 */}
          <div className="setting-item setting-item-row">
            <label>Show Holidays</label>
            <div
              className={`toggle-btn ${settings.showHolidays ? 'active' : ''}`}
              onClick={() => onUpdateSettings({ showHolidays: !settings.showHolidays })}
            >
              <span className="toggle-slider"></span>
            </div>
          </div>

          {/* 이월 날짜 표시 */}
          <div className="setting-item setting-item-row">
            <label>Adjacent Months</label>
            <div
              className={`toggle-btn ${settings.showAdjacentMonths ? 'active' : ''}`}
              onClick={() => onUpdateSettings({ showAdjacentMonths: !settings.showAdjacentMonths })}
            >
              <span className="toggle-slider"></span>
            </div>
          </div>

          {/* 그리드 라인 */}
          <div className="setting-item setting-item-row">
            <label>Grid Lines</label>
            <div
              className={`toggle-btn ${settings.showGridLines ? 'active' : ''}`}
              onClick={() => onUpdateSettings({ showGridLines: !settings.showGridLines })}
            >
              <span className="toggle-slider"></span>
            </div>
          </div>

          {/* 스케줄 패널 위치 */}
          <div className="setting-item setting-item-row">
            <label>Schedule Panel</label>
            <div className="theme-options">
              <button
                className={`theme-btn ${settings.schedulePanelPosition === 'left' ? 'active' : ''}`}
                onClick={() => onUpdateSettings({ schedulePanelPosition: 'left' })}
              >
                Left
              </button>
              <button
                className={`theme-btn ${settings.schedulePanelPosition === 'right' ? 'active' : ''}`}
                onClick={() => onUpdateSettings({ schedulePanelPosition: 'right' })}
              >
                Right
              </button>
            </div>
          </div>

          {/* 패널 열림 시 일정 점으로 표시 */}
          <div className="setting-item setting-item-row">
            <label>
              Compact Events
              <span className="setting-hint">Show dots instead of titles</span>
            </label>
            <div
              className={`toggle-btn ${settings.showEventDots ? 'active' : ''}`}
              onClick={() => onUpdateSettings({ showEventDots: !settings.showEventDots })}
            >
              <span className="toggle-slider"></span>
            </div>
          </div>

          <div className="setting-divider" />

          {/* 자동 백업 */}
          <div className="setting-item setting-item-row">
            <label>
              Auto Backup
              <span className="setting-hint">Backup on app start/quit</span>
            </label>
            <div
              className={`toggle-btn ${settings.autoBackup !== false ? 'active' : ''}`}
              onClick={() => onUpdateSettings({ autoBackup: !settings.autoBackup })}
            >
              <span className="toggle-slider"></span>
            </div>
          </div>

          {/* 미완료 과거 일정 표시 */}
          <div className="setting-item setting-item-row">
            <label>
              Show Overdue
              <span className="setting-hint">Show incomplete past tasks</span>
            </label>
            <div
              className={`toggle-btn ${settings.showOverdueTasks !== false ? 'active' : ''}`}
              onClick={() => onUpdateSettings({ showOverdueTasks: !settings.showOverdueTasks })}
            >
              <span className="toggle-slider"></span>
            </div>
          </div>

          <div className="setting-divider" />

          {/* 요일 표시 설정 */}
          <div className="setting-item">
            <label>
              Visible Days
              <span className="setting-hint">Select which days to show</span>
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
