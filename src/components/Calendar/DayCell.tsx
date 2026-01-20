import { memo } from 'react';
import { format, getDay } from 'date-fns';
import type { CalendarEvent } from '../../types';
import './Calendar.css';

interface DayCellProps {
  date: Date;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  events: CalendarEvent[];
  onClick: () => void;
  onDoubleClick: (e: React.MouseEvent) => void;
}

export const DayCell = memo(function DayCell({
  date,
  isCurrentMonth,
  isSelected,
  isToday,
  events,
  onClick,
  onDoubleClick,
}: DayCellProps) {
  const dayNumber = format(date, 'd');
  const dayOfWeek = getDay(date);
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const classNames = [
    'day-cell',
    !isCurrentMonth && 'other-month',
    isSelected && 'selected',
    isToday && 'today',
    isWeekend && 'weekend',
  ]
    .filter(Boolean)
    .join(' ');

  const maxVisibleEvents = 2;
  const visibleEvents = events.slice(0, maxVisibleEvents);
  const remainingCount = events.length - maxVisibleEvents;

  return (
    <div className={classNames} onClick={onClick} onDoubleClick={onDoubleClick}>
      <span className="day-number">{dayNumber}</span>
      {events.length > 0 && (
        <div className="day-events">
          {visibleEvents.map((event) => (
            <div
              key={event.id}
              className="day-event"
              style={{ backgroundColor: event.color || '#5ba0f5' }}
              title={event.title}
            >
              {event.title}
            </div>
          ))}
          {remainingCount > 0 && (
            <div className="day-event-more">+{remainingCount} more</div>
          )}
        </div>
      )}
    </div>
  );
});
