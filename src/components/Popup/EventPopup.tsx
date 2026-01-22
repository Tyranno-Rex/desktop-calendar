import { useState, useEffect, useCallback } from 'react';
import { X, Clock, Trash2 } from 'lucide-react';

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
          <div className="popup-time-input">
            <Clock size={16} className="popup-time-icon" />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="popup-input popup-input-time"
            />
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
