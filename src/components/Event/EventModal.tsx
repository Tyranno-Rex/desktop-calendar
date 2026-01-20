import { useState } from 'react';
import { format } from 'date-fns';
import type { CalendarEvent } from '../../types';
import './Event.css';

const EVENT_COLORS = [
  '#4a9eff',
  '#ff6b6b',
  '#51cf66',
  '#ffd43b',
  '#cc5de8',
  '#20c997',
  '#ff922b',
  '#868e96',
];

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
  const [description, setDescription] = useState(event?.description || '');
  const [color, setColor] = useState(event?.color || EVENT_COLORS[0]);

  const isEditing = !!event;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (isEditing && event) {
      onUpdate(event.id, { title, description, color });
    } else {
      onSave({
        title,
        description,
        color,
        date: format(date, 'yyyy-MM-dd'),
      });
    }
    onClose();
  };

  const handleDelete = () => {
    if (event && confirm('Delete this event?')) {
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
      <div className="modal">
        <div className="modal-header">
          <h3>{isEditing ? 'Edit Event' : 'New Event'}</h3>
          <span className="modal-date">{format(date, 'MMM d, yyyy')}</span>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title">Title</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description (optional)"
              rows={3}
            />
          </div>
          <div className="form-group">
            <label>Color</label>
            <div className="color-picker">
              {EVENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-option ${color === c ? 'selected' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
          <div className="modal-actions">
            {isEditing && (
              <button type="button" className="btn-delete" onClick={handleDelete}>
                Delete
              </button>
            )}
            <div className="modal-actions-right">
              <button type="button" className="btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-save" disabled={!title.trim()}>
                {isEditing ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
