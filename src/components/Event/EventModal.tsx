import { useState } from 'react';
import { X, Clock, Trash2 } from 'lucide-react';
import type { CalendarEvent } from '../../types';
import './Event.css';

// 로컬 날짜를 yyyy-MM-dd 형식으로 변환 (타임존 문제 방지)
const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface EventModalProps {
  date: Date;
  event?: CalendarEvent;
  onSave: (event: Omit<CalendarEvent, 'id'>) => void;
  onUpdate: (id: string, updates: Partial<CalendarEvent>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function EventModal({
  date,
  event,
  onSave,
  onUpdate,
  onDelete,
  onClose,
}: EventModalProps) {
  const [title, setTitle] = useState(event?.title || '');
  const [time, setTime] = useState(event?.time || '');
  const [description, setDescription] = useState(event?.description || '');

  const isEditing = !!event;

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
      });
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
