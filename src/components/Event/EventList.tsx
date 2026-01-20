
import { format } from 'date-fns';
import type { CalendarEvent } from '../../types';
import './Event.css';

interface EventListProps {
  date: Date | null;
  events: CalendarEvent[];
  onAddEvent: () => void;
  onEditEvent: (event: CalendarEvent) => void;
}

export function EventList({ date, events, onAddEvent, onEditEvent }: EventListProps) {
  if (!date) {
    return (
      <div className="event-list">
        <div className="event-list-empty">
          Select a date to view events
        </div>
      </div>
    );
  }

  return (
    <div className="event-list">
      <div className="event-list-header">
        <span className="event-date">{format(date, 'EEEE, MMM d')}</span>
        <button className="btn-add-event" onClick={onAddEvent} title="Add event">
          +
        </button>
      </div>
      {events.length === 0 ? (
        <div className="event-list-empty">No events for this day</div>
      ) : (
        <div className="event-items">
          {events.map((event) => (
            <div
              key={event.id}
              className="event-item"
              onClick={() => onEditEvent(event)}
            >
              <span
                className="event-color-bar"
                style={{ backgroundColor: event.color || '#4a9eff' }}
              />
              <div className="event-content">
                <span className="event-title">{event.title}</span>
                {event.description && (
                  <span className="event-description">{event.description}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
