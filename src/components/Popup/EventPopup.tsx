import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Trash2, ChevronDown } from 'lucide-react';

// 로컬 날짜를 yyyy-MM-dd 형식으로 변환 (타임존 문제 방지)
const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// yyyy-MM-dd 문자열을 로컬 Date로 파싱 (타임존 문제 방지)
const parseLocalDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
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
  const timePickerRef = useRef<HTMLDivElement>(null);

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
  }, []);

  // 팝업 데이터 처리
  const handlePopupData = useCallback(async (data: { type: string; date: string; event?: CalendarEvent }) => {
    resetForm();

    if (data.date) {
      setDate(parseLocalDate(data.date));
    }

    if (data.event?.id) {
      setEventId(data.event.id);
      setIsEdit(true);
      // 이벤트 데이터 로드
      const events = await window.electronAPI?.getEvents();
      const event = events?.find(e => e.id === data.event!.id);
      if (event) {
        setTitle(event.title);
        setTime(event.time || '');
        setDescription(event.description || '');
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
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return;

    const event: CalendarEvent = {
      id: eventId || crypto.randomUUID(),
      title: title.trim(),
      date: getLocalDateString(date),
      time: time || undefined,
      description: description.trim() || undefined,
      color: '#3b82f6',
    };

    await window.electronAPI?.popupSaveEvent(event);
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

  // 팝업이 준비되지 않았으면 빈 컨테이너만 표시
  if (!ready) {
    return <div className="popup-container popup-loading" />;
  }

  return (
    <div className="popup-container">
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
