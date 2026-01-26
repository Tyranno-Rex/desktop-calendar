import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Trash2, ChevronDown, ChevronRight, Repeat, Settings } from 'lucide-react';
import { getLocalDateString } from '../../utils/date';
import type { RepeatType, RepeatConfig } from '../../types';

// yyyy-MM-dd 문자열을 로컬 Date로 파싱 (타임존 문제 방지)
const parseLocalDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
};

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

import type { CalendarEvent } from '../../types';
import './Popup.css';

export function EventPopup() {
  const [date, setDate] = useState<Date>(new Date());
  const [eventId, setEventId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [description, setDescription] = useState('');
  const [isEdit, setIsEdit] = useState(false);
  const [ready, setReady] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [syncToGoogle, setSyncToGoogle] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const timePickerRef = useRef<HTMLDivElement>(null);
  const repeatPickerRef = useRef<HTMLDivElement>(null);

  // 반복 설정 상태
  const [repeatType, setRepeatType] = useState<RepeatType>('none');
  const [repeatInterval, setRepeatInterval] = useState(1);
  const [repeatEndDate, setRepeatEndDate] = useState('');
  const [showRepeatDropdown, setShowRepeatDropdown] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // 시간 선택 상태
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('AM');
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);

  // 각 드롭다운 열림 상태
  const [openDropdown, setOpenDropdown] = useState<'period' | 'hour' | 'minute' | null>(null);

  // 폼 초기화
  const resetForm = useCallback(() => {
    setTitle('');
    setTime('');
    setDescription('');
    setEventId(null);
    setIsEdit(false);
    setRepeatType('none');
    setRepeatInterval(1);
    setRepeatEndDate('');
    setSyncToGoogle(false);
    setShowMoreOptions(false);
  }, []);

  // Google 연결 상태 및 테마 설정 확인
  useEffect(() => {
    const checkGoogleAuth = async () => {
      if (window.electronAPI?.googleAuthStatus) {
        const isConnected = await window.electronAPI.googleAuthStatus();
        setGoogleConnected(isConnected);
      }
    };
    const loadTheme = async () => {
      if (window.electronAPI?.getSettings) {
        const settings = await window.electronAPI.getSettings();
        if (settings?.theme) {
          setTheme(settings.theme);
        }
      }
    };
    checkGoogleAuth();
    loadTheme();
  }, []);

  // 팝업 데이터 처리
  const handlePopupData = useCallback(async (data: { type: string; date: string; event?: CalendarEvent }) => {
    resetForm();

    if (data.date) {
      setDate(parseLocalDate(data.date));
    }

    if (data.event?.id) {
      // 반복 인스턴스인 경우 원본 ID 사용, 아니면 그대로
      const originalId = data.event.isRepeatInstance && data.event.repeatGroupId
        ? data.event.repeatGroupId
        : data.event.id;
      setEventId(originalId);
      setIsEdit(true);

      // 전달받은 이벤트 데이터 사용 (반복 인스턴스도 원본 데이터 복사됨)
      setTitle(data.event.title || '');
      setTime(data.event.time || '');
      setDescription(data.event.description || '');
      // 반복 설정 로드
      if (data.event.repeat) {
        setRepeatType(data.event.repeat.type);
        setRepeatInterval(data.event.repeat.interval || 1);
        setRepeatEndDate(data.event.repeat.endDate || '');
      }
    }

    setReady(true);
  }, [resetForm]);

  useEffect(() => {
    // IPC로 데이터 수신 (미리 로드된 팝업용)
    window.electronAPI?.onPopupData?.(handlePopupData);

    // URL에서 파라미터 추출 (기존 호환성 유지)
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.split('?')[1] || '');

    const dateStr = params.get('date');
    const eventIdParam = params.get('eventId');

    if (dateStr) {
      setDate(parseLocalDate(dateStr));
      setReady(true);
    }

    if (eventIdParam) {
      setEventId(eventIdParam);
      setIsEdit(true);
      loadEvent(eventIdParam);
    }
  }, [handlePopupData]);

  const loadEvent = async (id: string) => {
    const events = await window.electronAPI?.getEvents();
    const event = events?.find(e => e.id === id);
    if (event) {
      setTitle(event.title);
      setTime(event.time || '');
      setDescription(event.description || '');
      // 반복 설정 로드
      if (event.repeat) {
        setRepeatType(event.repeat.type);
        setRepeatInterval(event.repeat.interval || 1);
        setRepeatEndDate(event.repeat.endDate || '');
      }
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return;

    // 반복 설정 생성
    const repeat: RepeatConfig | undefined = repeatType !== 'none' ? {
      type: repeatType,
      interval: repeatInterval,
      endDate: repeatEndDate || undefined,
    } : undefined;

    const event: CalendarEvent = {
      id: eventId || crypto.randomUUID(),
      title: title.trim(),
      date: getLocalDateString(date),
      time: time || undefined,
      description: description.trim() || undefined,
      color: '#3b82f6',
      repeat,
    };

    await window.electronAPI?.popupSaveEvent(event, syncToGoogle);
    window.electronAPI?.closePopup();
  };

  const handleDelete = async () => {
    if (eventId) {
      await window.electronAPI?.popupDeleteEvent(eventId);
      window.electronAPI?.closePopup();
    }
  };

  const handleClose = () => {
    window.electronAPI?.closePopup();
  };

  // 리사이즈 핸들러
  const handleResizeStart = (direction: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    window.electronAPI?.startResize(direction);

    const handleMouseUp = () => {
      window.electronAPI?.stopResize();
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mouseup', handleMouseUp);
  };

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

  // 팝업이 준비되지 않았으면 빈 컨테이너만 표시
  if (!ready) {
    return <div className={`popup-container popup-loading ${theme}`} />;
  }

  return (
    <div className={`popup-container ${theme}`}>
      {/* 리사이즈 핸들 */}
      <div className="resize-handle resize-n" onMouseDown={handleResizeStart('n')} />
      <div className="resize-handle resize-s" onMouseDown={handleResizeStart('s')} />
      <div className="resize-handle resize-e" onMouseDown={handleResizeStart('e')} />
      <div className="resize-handle resize-w" onMouseDown={handleResizeStart('w')} />
      <div className="resize-handle resize-ne" onMouseDown={handleResizeStart('ne')} />
      <div className="resize-handle resize-nw" onMouseDown={handleResizeStart('nw')} />
      <div className="resize-handle resize-se" onMouseDown={handleResizeStart('se')} />
      <div className="resize-handle resize-sw" onMouseDown={handleResizeStart('sw')} />

      {/* Header */}
      <div className="popup-header">
        <h2 className="popup-title">Schedule Details</h2>
        <button className="popup-close" onClick={handleClose}>
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="popup-content">
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

        {/* More Options 토글 버튼 */}
        <button
          type="button"
          className="more-options-btn"
          onClick={() => setShowMoreOptions(!showMoreOptions)}
        >
          <Settings size={14} />
          <span>More options</span>
          <ChevronRight size={14} className={`more-options-chevron ${showMoreOptions ? 'open' : ''}`} />
        </button>

        {/* 추가 옵션 */}
        {showMoreOptions && (
          <div className="more-options-content">
            {/* Google Calendar 동기화 토글 - 새 일정 추가 시에만 표시 */}
            {!isEdit && googleConnected && (
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
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="popup-footer">
        {isEdit && (
          <button className="popup-btn popup-btn-delete" onClick={handleDelete}>
            <Trash2 size={16} />
            Delete
          </button>
        )}
        <div className="popup-footer-right">
          <button className="popup-btn popup-btn-cancel" onClick={handleClose}>
            Cancel
          </button>
          <button
            className="popup-btn popup-btn-save"
            onClick={handleSave}
            disabled={!title.trim()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
