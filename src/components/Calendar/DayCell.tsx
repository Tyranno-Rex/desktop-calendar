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
  onEventClick?: (event: CalendarEvent, e: React.MouseEvent) => void;
  showEventDetails?: boolean; // 패널이 닫혀있을 때 이벤트 상세 표시
}

export const DayCell = memo(function DayCell({
  date,
  isCurrentMonth,
  isSelected,
  isToday,
  events,
  onClick,
  onDoubleClick,
  onEventClick,
  showEventDetails = false,
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

  const maxVisibleEvents = 3;
  const visibleEvents = events.slice(0, maxVisibleEvents);
  const remainingCount = events.length - maxVisibleEvents;

  return (
    <div
      className={classNames}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="day-cell-content">
        <span className={`day-number ${isToday ? 'today-badge' : ''}`}>
          {dayNumber}
        </span>

        {/* 패널이 열려있을 때: 점으로 표시 */}
        {!showEventDetails && events.length > 0 && (
          <div className="day-dots">
            {Array.from({ length: Math.min(events.length, 3) }).map((_, i) => (
              <div
                key={i}
                className="day-dot"
              />
            ))}
          </div>
        )}

        {/* 패널이 닫혀있을 때: 이벤트 상세 표시 (시간+제목) */}
        {showEventDetails && events.length > 0 && (
          <div className="day-events-detail">
            {visibleEvents.map((event) => (
              <div
                key={event.id}
                className="day-event-item"
                title={event.title}
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick?.(event, e);
                }}
              >
                {event.time && (
                  <span className="day-event-time">{event.time}</span>
                )}
                {event.title}
              </div>
            ))}
            {remainingCount > 0 && (
              <div className="day-event-more">+{remainingCount} more</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
