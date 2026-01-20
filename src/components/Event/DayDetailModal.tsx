import { format } from 'date-fns';
import type { CalendarEvent } from '../../types';
import './Event.css';

interface DayDetailModalProps {
  date: Date;
  events: CalendarEvent[];
  onAddEvent: () => void;
  onEditEvent: (event: CalendarEvent) => void;
  onClose: () => void;
}

export function DayDetailModal({ date, events, onAddEvent, onEditEvent, onClose }: DayDetailModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="day-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="day-detail-header">
          <div className="day-detail-date">
            <span className="day-detail-day">{format(date, 'd')}</span>
            <div className="day-detail-info">
              <span className="day-detail-weekday">{format(date, 'EEEE')}</span>
              <span className="day-detail-month">{format(date, 'MMMM yyyy')}</span>
            </div>
          </div>
          <button className="btn-close-modal" onClick={onClose}>×</button>
        </div>

        <div className="day-detail-content">
          {events.length === 0 ? (
            <div className="day-detail-empty">No events</div>
          ) : (
            <div className="day-detail-events">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="day-detail-event"
                  onClick={() => onEditEvent(event)}
                >
                  <span
                    className="event-color-dot"
                    style={{ backgroundColor: event.color || '#4a9eff' }}
                  />
                  <div className="day-detail-event-info">
                    <span className="day-detail-event-title">{event.title}</span>
                    {event.description && (
                      <span className="day-detail-event-desc">{event.description}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="day-detail-footer">
          <button className="btn-add-event-large" onClick={onAddEvent}>
            + Add Event
          </button>
        </div>
      </div>
    </div>
  );
}
