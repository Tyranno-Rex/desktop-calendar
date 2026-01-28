import { useState, useEffect, useRef } from 'react';
import { X, Trash2, ChevronDown, Repeat, Bell } from 'lucide-react';
import type { CalendarEvent, RepeatConfig, RepeatType, ReminderConfig } from '../../types';
import {
  getLocalDateString,
  parseTime,
  formatTime,
  PERIODS,
  HOURS,
  MINUTES,
  REPEAT_OPTIONS,
  REMINDER_OPTIONS,
} from '../../utils/date';
import './Event.css';


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
  const repeatPickerRef = useRef<HTMLDivElement>(null);

  // 반복 설정 상태
  const [repeatType, setRepeatType] = useState<RepeatType>(event?.repeat?.type || 'none');
  const repeatInterval = event?.repeat?.interval || 1;
  const repeatEndDate = event?.repeat?.endDate || '';
  const [showRepeatDropdown, setShowRepeatDropdown] = useState(false);

  // 알림 설정 상태
  const [reminderMinutes, setReminderMinutes] = useState<number>(
    event?.reminder?.enabled ? event.reminder.minutesBefore : 0
  );
  const [showReminderDropdown, setShowReminderDropdown] = useState(false);
  const reminderPickerRef = useRef<HTMLDivElement>(null);

  // 시간 선택 상태
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('AM');
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);

  // 각 드롭다운 열림 상태
  const [openDropdown, setOpenDropdown] = useState<'period' | 'hour' | 'minute' | null>(null);

  const isEditing = !!event;

  // 반복 인스턴스인 경우 원본 ID 사용
  const originalEventId = event?.isRepeatInstance && event?.repeatGroupId
    ? event.repeatGroupId
    : event?.id;

  // 시간/반복/알림 선택기 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (timePickerRef.current && !timePickerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
      if (repeatPickerRef.current && !repeatPickerRef.current.contains(e.target as Node)) {
        setShowRepeatDropdown(false);
      }
      if (reminderPickerRef.current && !reminderPickerRef.current.contains(e.target as Node)) {
        setShowReminderDropdown(false);
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

    // 알림 설정 생성
    const reminder: ReminderConfig | undefined = reminderMinutes > 0 ? {
      enabled: true,
      minutesBefore: reminderMinutes,
    } : undefined;

    if (isEditing && event && originalEventId) {
      onUpdate(originalEventId, {
        title: title.trim(),
        time: time || undefined,
        description: description.trim() || undefined,
        repeat,
        reminder,
      });
    } else {
      onSave({
        title: title.trim(),
        date: getLocalDateString(date),
        time: time || undefined,
        description: description.trim() || undefined,
        color: '#3b82f6',
        repeat,
        reminder,
      }, syncToGoogle);
    }
    onClose();
  };

  const handleDelete = () => {
    if (event && originalEventId) {
      onDelete(originalEventId);
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
            <div className="title-repeat-row">
              <input
                type="text"
                placeholder="Enter title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="popup-input"
                autoFocus
              />
              <div className="repeat-select-wrapper" ref={repeatPickerRef}>
                <button
                  type="button"
                  className="repeat-select-btn-compact"
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
              <div className="reminder-select-wrapper" ref={reminderPickerRef}>
                <button
                  type="button"
                  className={`reminder-select-btn-compact ${reminderMinutes > 0 ? 'active' : ''}`}
                  onClick={() => setShowReminderDropdown(!showReminderDropdown)}
                  disabled={!time}
                  title={!time ? 'Set time first to enable reminder' : ''}
                >
                  <Bell size={14} />
                  <ChevronDown size={14} />
                </button>
                {showReminderDropdown && (
                  <div className="reminder-dropdown">
                    {REMINDER_OPTIONS.map((option) => (
                      <div
                        key={option.value}
                        className={`reminder-dropdown-item ${reminderMinutes === option.value ? 'selected' : ''}`}
                        onClick={() => {
                          setReminderMinutes(option.value);
                          setShowReminderDropdown(false);
                        }}
                      >
                        {option.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
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
