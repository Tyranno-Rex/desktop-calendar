import { useState, useEffect, useRef } from 'react';
import { X, Trash2, ChevronDown, Repeat } from 'lucide-react';
import type { CalendarEvent, RepeatType, RepeatConfig } from '../../types';
import { getLocalDateString } from '../../utils/date';
import './Event.css';

// 시간 옵션
const PERIODS = ['AM', 'PM'] as const;
const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 10, 20, 30, 40, 50];

// 반복 옵션
const REPEAT_OPTIONS: { value: RepeatType; label: string }[] = [
  { value: 'none', label: 'No repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

// HH:mm -> {period, hour, minute} 파싱
const parseTime = (t: string) => {
  if (!t) return { period: 'AM' as const, hour: 12, minute: 0 };
  const [h, m] = t.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return { period, hour, minute: m };
};

// {period, hour, minute} -> HH:mm 변환
const formatTime = (period: string, hour: number, minute: number) => {
  let h = hour;
  if (period === 'AM') {
    h = hour === 12 ? 0 : hour;
  } else {
    h = hour === 12 ? 12 : hour + 12;
  }
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};


interface EventModalProps {
  date: Date;
  event?: CalendarEvent;
  onSave: (event: Omit<CalendarEvent, 'id'>, syncToGoogle?: boolean) => void;
  onUpdate: (id: string, updates: Partial<CalendarEvent>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  googleConnected?: boolean;
}

export function EventModal({
  date,
  event,
  onSave,
  onUpdate,
  onDelete,
  onClose,
  googleConnected = false,
}: EventModalProps) {
  // DEBUG
  console.log('[EventModal] googleConnected:', googleConnected, 'isEditing:', !!event);

  const [title, setTitle] = useState(event?.title || '');
  const [time, setTime] = useState(event?.time || '');
  const [description, setDescription] = useState(event?.description || '');
  const [syncToGoogle, setSyncToGoogle] = useState(false);
  const timePickerRef = useRef<HTMLDivElement>(null);
  const repeatPickerRef = useRef<HTMLDivElement>(null);

  // 반복 설정 상태
  const [repeatType, setRepeatType] = useState<RepeatType>(event?.repeat?.type || 'none');
  const [repeatInterval, setRepeatInterval] = useState(event?.repeat?.interval || 1);
  const [repeatEndDate, setRepeatEndDate] = useState(event?.repeat?.endDate || '');
  const [showRepeatDropdown, setShowRepeatDropdown] = useState(false);

  // 시간 선택 상태
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('AM');
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);

  // 각 드롭다운 열림 상태
  const [openDropdown, setOpenDropdown] = useState<'period' | 'hour' | 'minute' | null>(null);

  const isEditing = !!event;

  // 시간/반복 선택기 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (timePickerRef.current && !timePickerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
      if (repeatPickerRef.current && !repeatPickerRef.current.contains(e.target as Node)) {
        setShowRepeatDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 시간이 변경될 때 선택 상태 동기화
  useEffect(() => {
    if (time) {
      const parsed = parseTime(time);
      setSelectedPeriod(parsed.period as 'AM' | 'PM');
      setSelectedHour(parsed.hour);
      setSelectedMinute(parsed.minute);
    }
  }, [time]);

  // 시간 선택 핸들러
  const handlePeriodSelect = (period: 'AM' | 'PM') => {
    setSelectedPeriod(period);
    setTime(formatTime(period, selectedHour, selectedMinute));
    setOpenDropdown(null);
  };

  const handleHourSelect = (hour: number) => {
    setSelectedHour(hour);
    setTime(formatTime(selectedPeriod, hour, selectedMinute));
    setOpenDropdown(null);
  };

  const handleMinuteSelect = (minute: number) => {
    setSelectedMinute(minute);
    setTime(formatTime(selectedPeriod, selectedHour, minute));
    setOpenDropdown(null);
  };

  const handleClearTime = () => {
    setTime('');
    setOpenDropdown(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // 반복 설정 생성
    const repeat: RepeatConfig | undefined = repeatType !== 'none' ? {
      type: repeatType,
      interval: repeatInterval,
      endDate: repeatEndDate || undefined,
    } : undefined;

    if (isEditing && event) {
      onUpdate(event.id, {
        title: title.trim(),
        time: time || undefined,
        description: description.trim() || undefined,
        repeat,
      });
    } else {
      onSave({
        title: title.trim(),
        date: getLocalDateString(date),
        time: time || undefined,
        description: description.trim() || undefined,
        color: '#3b82f6',
        repeat,
      }, syncToGoogle);
    }
    onClose();
  };

  const handleDelete = () => {
    if (event) {
      onDelete(event.id);
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="event-modal-popup">
        {/* Header */}
        <div className="popup-header">
          <h2 className="popup-title">Schedule Details</h2>
          <button className="popup-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="popup-content">
          <div className="popup-field">
            <label className="popup-label">Title</label>
            <input
              type="text"
              placeholder="Enter title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="popup-input"
              autoFocus
            />
          </div>

          <div className="popup-field">
            <label className="popup-label">Time</label>
            <div className="time-picker-row" ref={timePickerRef}>
              {/* AM/PM 선택 */}
              <div className="time-select-wrapper">
                <button
                  type="button"
                  className="time-select-btn"
                  onClick={() => setOpenDropdown(openDropdown === 'period' ? null : 'period')}
                >
                  <span>{time ? selectedPeriod : 'AM'}</span>
                  <ChevronDown size={14} />
                </button>
                {openDropdown === 'period' && (
                  <div className="time-dropdown">
                    {PERIODS.map((p) => (
                      <div
                        key={p}
                        className={`time-dropdown-item ${selectedPeriod === p ? 'selected' : ''}`}
                        onClick={() => handlePeriodSelect(p)}
                      >
                        {p}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Hour 선택 */}
              <div className="time-select-wrapper">
                <button
                  type="button"
                  className="time-select-btn"
                  onClick={() => setOpenDropdown(openDropdown === 'hour' ? null : 'hour')}
                >
                  <span>{time ? selectedHour : 12}</span>
                  <ChevronDown size={14} />
                </button>
                {openDropdown === 'hour' && (
                  <div className="time-dropdown">
                    {HOURS.map((h) => (
                      <div
                        key={h}
                        className={`time-dropdown-item ${selectedHour === h ? 'selected' : ''}`}
                        onClick={() => handleHourSelect(h)}
                      >
                        {h}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Min 선택 */}
              <div className="time-select-wrapper">
                <button
                  type="button"
                  className="time-select-btn"
                  onClick={() => setOpenDropdown(openDropdown === 'minute' ? null : 'minute')}
                >
                  <span>{time ? String(selectedMinute).padStart(2, '0') : '00'}</span>
                  <ChevronDown size={14} />
                </button>
                {openDropdown === 'minute' && (
                  <div className="time-dropdown">
                    {MINUTES.map((m) => (
                      <div
                        key={m}
                        className={`time-dropdown-item ${selectedMinute === m ? 'selected' : ''}`}
                        onClick={() => handleMinuteSelect(m)}
                      >
                        {String(m).padStart(2, '0')}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Clear 버튼 */}
              <button type="button" className="time-clear-btn-inline" onClick={handleClearTime}>
                Clear
              </button>
            </div>
          </div>

          <div className="popup-field">
            <label className="popup-label">Description</label>
            <textarea
              placeholder="Add description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="popup-textarea"
              rows={4}
            />
          </div>

          {/* 반복 설정 */}
          <div className="popup-field">
            <label className="popup-label">Repeat</label>
            <div className="repeat-picker-row" ref={repeatPickerRef}>
              {/* 반복 타입 선택 */}
              <div className="repeat-select-wrapper">
                <button
                  type="button"
                  className="repeat-select-btn"
                  onClick={() => setShowRepeatDropdown(!showRepeatDropdown)}
                >
                  <Repeat size={14} />
                  <span>{REPEAT_OPTIONS.find(o => o.value === repeatType)?.label}</span>
                  <ChevronDown size={14} />
                </button>
                {showRepeatDropdown && (
                  <div className="repeat-dropdown">
                    {REPEAT_OPTIONS.map((option) => (
                      <div
                        key={option.value}
                        className={`repeat-dropdown-item ${repeatType === option.value ? 'selected' : ''}`}
                        onClick={() => {
                          setRepeatType(option.value);
                          setShowRepeatDropdown(false);
                        }}
                      >
                        {option.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 반복 간격 (반복 타입이 none이 아닐 때만) */}
              {repeatType !== 'none' && (
                <>
                  <div className="repeat-interval">
                    <span>Every</span>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={repeatInterval}
                      onChange={(e) => setRepeatInterval(Math.max(1, parseInt(e.target.value) || 1))}
                      className="repeat-interval-input"
                    />
                    <span>
                      {repeatType === 'daily' && (repeatInterval === 1 ? 'day' : 'days')}
                      {repeatType === 'weekly' && (repeatInterval === 1 ? 'week' : 'weeks')}
                      {repeatType === 'monthly' && (repeatInterval === 1 ? 'month' : 'months')}
                      {repeatType === 'yearly' && (repeatInterval === 1 ? 'year' : 'years')}
                    </span>
                  </div>

                  {/* 종료일 */}
                  <div className="repeat-end">
                    <input
                      type="date"
                      value={repeatEndDate}
                      onChange={(e) => setRepeatEndDate(e.target.value)}
                      className="repeat-end-input"
                      placeholder="End date"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Google Calendar 동기화 토글 - 새 일정 추가 시에만 표시 */}
          {!isEditing && googleConnected && (
            <div className="popup-field popup-field-toggle">
              <label className="toggle-label">
                <span className="toggle-text">Add to Google Calendar</span>
                <div
                  className={`toggle-switch ${syncToGoogle ? 'active' : ''}`}
                  onClick={() => setSyncToGoogle(!syncToGoogle)}
                >
                  <div className="toggle-knob" />
                </div>
              </label>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="popup-footer">
          {isEditing && (
            <button className="popup-btn popup-btn-delete" onClick={handleDelete}>
              <Trash2 size={16} />
              Delete
            </button>
          )}
          <div className="popup-footer-right">
            <button className="popup-btn popup-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              className="popup-btn popup-btn-save"
              onClick={handleSubmit}
              disabled={!title.trim()}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
