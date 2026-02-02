import { memo, useMemo } from 'react';
import { getDay } from 'date-fns';
import { Repeat } from 'lucide-react';
import type { CalendarEvent } from '../../types';
import { getLocalDateString, compareEventTime } from '../../utils/date';
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
  showHolidays?: boolean; // 휴일 색상 표시
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
  showHolidays = true,
}: DayCellProps) {
  const dayNumber = date.getDate();
  const dayOfWeek = getDay(date);
  const dateString = getLocalDateString(date);
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const classNames = [
    'day-cell',
    !isCurrentMonth && 'other-month',
    isSelected && 'selected',
    isToday && 'today',
    showHolidays && isWeekend && 'weekend',
  ]
    .filter(Boolean)
    .join(' ');

  // 이벤트 정렬: 미완료(시간순) -> 완료(시간순)
  const sortedEvents = useMemo(() => {
    const incomplete = events.filter(e => !e.completed).sort(compareEventTime);
    const completed = events.filter(e => e.completed).sort(compareEventTime);
    return [...incomplete, ...completed];
  }, [events]);

  const maxVisibleEvents = 3;
  const visibleEvents = sortedEvents.slice(0, maxVisibleEvents);
  const remainingCount = sortedEvents.length - maxVisibleEvents;

  return (
    <div
      className={classNames}
      data-date={dateString}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="day-cell-content">
        <span className={`day-number ${isToday ? 'today-badge' : ''}`}>
          {dayNumber}
        </span>

        {/* 패널이 열려있을 때: 점으로 표시 (큰 원=5개, 작은 원=1개) */}
        {!showEventDetails && sortedEvents.length > 0 && (
          <div className="day-dots">
            {(() => {
              const count = sortedEvents.length;
              const largeDots = Math.floor(count / 5);
              const smallDots = count % 5;
              const dots: React.ReactNode[] = [];

              // 큰 원 (각각 5개 일정)
              for (let i = 0; i < largeDots; i++) {
                dots.push(<div key={`large-${i}`} className="day-dot large" />);
              }
              // 작은 원 (각각 1개 일정)
              for (let i = 0; i < smallDots; i++) {
                dots.push(<div key={`small-${i}`} className="day-dot" />);
              }

              return dots;
            })()}
          </div>
        )}

        {/* 패널이 닫혀있을 때: 이벤트 상세 표시 (시간+제목) */}
        {showEventDetails && sortedEvents.length > 0 && (
          <div className="day-events-detail">
            {visibleEvents.map((event) => (
              <div
                key={event.id}
                className={`day-event-item ${event.completed ? 'completed' : ''}`}
                title={event.title}
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick?.(event, e);
                }}
              >
                {(event.repeat || event.isRepeatInstance) && (
                  <Repeat size={10} className="day-event-repeat-icon" />
                )}
                {event.time && (
                  <span className="day-event-time">{event.time}</span>
                )}
                <span className={event.completed ? 'day-event-title-completed' : ''}>
                  {event.title}
                </span>
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
