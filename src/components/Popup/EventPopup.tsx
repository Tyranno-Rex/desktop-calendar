import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import type { CalendarEvent } from '../../types';
import './Popup.css';

const COLORS = [
  '#4a9eff', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
];

export function EventPopup() {
  const [date, setDate] = useState<Date>(new Date());
  const [eventId, setEventId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [isEdit, setIsEdit] = useState(false);

  useEffect(() => {
    // URL에서 파라미터 추출
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.split('?')[1] || '');

    const dateStr = params.get('date');
    const eventIdParam = params.get('eventId');

    if (dateStr) {
      setDate(new Date(dateStr));
    }

    if (eventIdParam) {
      setEventId(eventIdParam);
      setIsEdit(true);
      // 기존 이벤트 데이터 로드
      loadEvent(eventIdParam);
    }
  }, []);

  const loadEvent = async (id: string) => {
    const events = await window.electronAPI?.getEvents();
    const event = events?.find(e => e.id === id);
    if (event) {
      setTitle(event.title);
      setDescription(event.description || '');
      setColor(event.color || COLORS[0]);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return;

    const event: CalendarEvent = {
      id: eventId || crypto.randomUUID(),
      title: title.trim(),
      date: format(date, 'yyyy-MM-dd'),
      description: description.trim() || undefined,
      color,
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

  return (
    <div className="popup-container">
      <div className="popup-header">
        <div className="popup-date">
          <span className="popup-day">{format(date, 'd')}</span>
          <div className="popup-date-info">
            <span className="popup-weekday">{format(date, 'EEEE')}</span>
            <span className="popup-month">{format(date, 'MMMM yyyy')}</span>
          </div>
        </div>
        <button className="popup-close" onClick={handleClose}>×</button>
      </div>

      <div className="popup-content">
        <div className="popup-field">
          <input
            type="text"
            placeholder="Event title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="popup-input"
            autoFocus
          />
        </div>

        <div className="popup-field">
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="popup-textarea"
            rows={3}
          />
        </div>

        <div className="popup-field">
          <label className="popup-label">Color</label>
          <div className="popup-colors">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`popup-color-btn ${color === c ? 'active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="popup-footer">
        {isEdit && (
          <button className="popup-btn popup-btn-delete" onClick={handleDelete}>
            Delete
          </button>
        )}
        <button className="popup-btn popup-btn-cancel" onClick={handleClose}>
          Cancel
        </button>
        <button
          className="popup-btn popup-btn-save"
          onClick={handleSave}
          disabled={!title.trim()}
        >
          {isEdit ? 'Save' : 'Add'}
        </button>
      </div>
    </div>
  );
}
