import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Trash2, ChevronRight, Settings } from 'lucide-react';
import type { CalendarEvent } from '../../types';
import { getLocalDateString, parseLocalDateString } from '../../utils/date';
import { useEventForm } from '../../hooks/useEventForm';
import { TimePicker, RepeatSelector, ReminderSelector, DDayToggle, GoogleSyncToggle } from '../Event/EventFormFields';
import './Popup.css';

export function EventPopup() {
  const [date, setDate] = useState<Date>(new Date());
  const [eventId, setEventId] = useState<string | null>(null);
  const [isEdit, setIsEdit] = useState(false);
  const [ready, setReady] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  const { state, actions, refs } = useEventForm();

  // 리스너 중복 등록 방지
  const listenerRegisteredRef = useRef(false);
  // actions를 ref로 저장 (useEffect 의존성 문제 해결)
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  // 테마 설정 로드 (마운트 시 1회)
  useEffect(() => {
    const loadTheme = async () => {
      if (window.electronAPI?.getSettings) {
        const settings = await window.electronAPI.getSettings();
        if (settings?.theme) {
          setTheme(settings.theme);
        }
      }
    };
    loadTheme();
  }, []);

  // IPC 리스너 등록 (마운트 시 1회만)
  useEffect(() => {
    if (listenerRegisteredRef.current) return;
    listenerRegisteredRef.current = true;

    // 팝업 데이터 수신 핸들러
    const handlePopupData = async (data: { type: string; date: string; event?: CalendarEvent }) => {
      actionsRef.current.resetForm();
      setShowMoreOptions(false);

      // 팝업이 열릴 때마다 Google 연결 상태 확인
      if (window.electronAPI?.googleAuthStatus) {
        const isConnected = await window.electronAPI.googleAuthStatus();
        setGoogleConnected(isConnected);
      }

      if (data.date) {
        setDate(parseLocalDateString(data.date));
      }

      if (data.event?.id) {
        const originalId = data.event.isRepeatInstance && data.event.repeatGroupId
          ? data.event.repeatGroupId
          : data.event.id;
        setEventId(originalId);
        setIsEdit(true);
        actionsRef.current.loadFromEvent(data.event);
      } else {
        setEventId(null);
        setIsEdit(false);
      }

      setReady(true);
    };

    // IPC로 데이터 수신
    window.electronAPI?.onPopupData?.(handlePopupData);

    // URL에서 파라미터 추출 (기존 호환성 유지)
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.split('?')[1] || '');

    const dateStr = params.get('date');
    const eventIdParam = params.get('eventId');

    if (dateStr) {
      setDate(parseLocalDateString(dateStr));
      // URL 파라미터로 열릴 때도 Google 연결 상태 확인
      if (window.electronAPI?.googleAuthStatus) {
        window.electronAPI.googleAuthStatus().then(setGoogleConnected);
      }
      setReady(true);
    }

    if (eventIdParam) {
      setEventId(eventIdParam);
      setIsEdit(true);
      loadEventById(eventIdParam);
    }
  }, []);

  const loadEventById = async (id: string) => {
    const events = await window.electronAPI?.getEvents();
    const event = events?.find((e: CalendarEvent) => e.id === id);
    if (event) {
      actionsRef.current.loadFromEvent(event);
    }
  };

  const handleSave = async () => {
    if (!state.title.trim()) return;

    const repeat = actions.buildRepeatConfig();
    const reminder = actions.buildReminderConfig();

    const event: CalendarEvent = {
      id: eventId || crypto.randomUUID(),
      title: state.title.trim(),
      date: getLocalDateString(date),
      time: state.time || undefined,
      description: state.description.trim() || undefined,
      color: '#3b82f6',
      repeat,
      reminder,
      isDDay: state.isDDay || undefined,
    };

    await window.electronAPI?.popupSaveEvent(event, state.syncToGoogle);
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
  const handleResizeStart = useCallback((direction: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    window.electronAPI?.startResize(direction);

    const handleMouseUp = () => {
      window.electronAPI?.stopResize();
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

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
              value={state.title}
              onChange={(e) => actions.setTitle(e.target.value)}
              className="popup-input"
              autoFocus
            />
            <RepeatSelector
              repeatType={state.repeatType}
              showDropdown={state.showRepeatDropdown}
              onSetShowDropdown={actions.setShowRepeatDropdown}
              onSelectType={actions.setRepeatType}
              pickerRef={refs.repeatPickerRef}
            />
            <ReminderSelector
              reminderMinutes={state.reminderMinutes}
              showDropdown={state.showReminderDropdown}
              onSetShowDropdown={actions.setShowReminderDropdown}
              onSelectMinutes={actions.setReminderMinutes}
              disabled={!state.time}
              pickerRef={refs.reminderPickerRef}
            />
          </div>
        </div>

        <div className="popup-field">
          <label className="popup-label">Time</label>
          <TimePicker
            time={state.time}
            selectedPeriod={state.selectedPeriod}
            selectedHour={state.selectedHour}
            selectedMinute={state.selectedMinute}
            openDropdown={state.openDropdown}
            onSetOpenDropdown={actions.setOpenDropdown}
            onPeriodSelect={actions.handlePeriodSelect}
            onHourSelect={actions.handleHourSelect}
            onMinuteSelect={actions.handleMinuteSelect}
            onClearTime={actions.handleClearTime}
            pickerRef={refs.timePickerRef}
          />
        </div>

        <div className="popup-field">
          <label className="popup-label">Description</label>
          <textarea
            placeholder="Add description..."
            value={state.description}
            onChange={(e) => actions.setDescription(e.target.value)}
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
            {/* D-Day 표시 옵션 */}
            <DDayToggle
              isDDay={state.isDDay}
              onToggle={() => actions.setIsDDay(!state.isDDay)}
            />

            {/* Google Calendar 동기화 토글 - 새 일정 추가 시에만 표시 */}
            {!isEdit && googleConnected && (
              <GoogleSyncToggle
                syncToGoogle={state.syncToGoogle}
                onToggle={() => actions.setSyncToGoogle(!state.syncToGoogle)}
              />
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
            disabled={!state.title.trim()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
