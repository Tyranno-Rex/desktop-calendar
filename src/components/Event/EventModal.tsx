import { useState, useEffect, useRef } from 'react';
import { X, Trash2, ChevronDown } from 'lucide-react';
import type { CalendarEvent } from '../../types';
import './Event.css';

// 로컬 날짜를 yyyy-MM-dd 형식으로 변환 (타임존 문제 방지)
const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 시간 옵션
const PERIODS = ['AM', 'PM'] as const;
const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 10, 20, 30, 40, 50];

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
  const [title, setTitle] = useState(event?.title || '');
  const [time, setTime] = useState(event?.time || '');
  const [description, setDescription] = useState(event?.description || '');
  const [syncToGoogle, setSyncToGoogle] = useState(false);
  const timePickerRef = useRef<HTMLDivElement>(null);

  // 시간 선택 상태
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('AM');
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);

  // 각 드롭다운 열림 상태
  const [openDropdown, setOpenDropdown] = useState<'period' | 'hour' | 'minute' | null>(null);

  const isEditing = !!event;

  // 시간 선택기 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (timePickerRef.current && !timePickerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
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

    if (isEditing && event) {
      onUpdate(event.id, {
        title: title.trim(),
        time: time || undefined,
        description: description.trim() || undefined,
      });
    } else {
      onSave({
        title: title.trim(),
        date: getLocalDateString(date),
        time: time || undefined,
        description: description.trim() || undefined,
        color: '#3b82f6',
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
