import { useMemo } from 'react';
import { DayCell } from './DayCell';
import type { CalendarEvent } from '../../types';
import './Calendar.css';

const WEEKDAYS = [
  { name: 'Sun', index: 0, isWeekend: true },
  { name: 'Mon', index: 1, isWeekend: false },
  { name: 'Tue', index: 2, isWeekend: false },
  { name: 'Wed', index: 3, isWeekend: false },
  { name: 'Thu', index: 4, isWeekend: false },
  { name: 'Fri', index: 5, isWeekend: false },
  { name: 'Sat', index: 6, isWeekend: true },
];

interface CalendarGridProps {
  days: Date[];
  isCurrentMonth: (date: Date) => boolean;
  isSelected: (date: Date) => boolean;
  isToday: (date: Date) => boolean;
  getEventsForDate: (date: Date) => CalendarEvent[];
  onSelectDate: (date: Date) => void;
  onOpenDate: (date: Date, e: React.MouseEvent) => void;
  onEventClick?: (event: CalendarEvent, e: React.MouseEvent) => void;
  showEventDetails?: boolean;
  showHolidays?: boolean;
  showAdjacentMonths?: boolean;
  hiddenDays?: number[];
}

export function CalendarGrid({
  days,
  isCurrentMonth,
  isSelected,
  isToday,
  getEventsForDate,
  onSelectDate,
  onOpenDate,
  onEventClick,
  showEventDetails = false,
  showHolidays = true,
  showAdjacentMonths = true,
  hiddenDays = [],
}: CalendarGridProps) {
  // 표시할 요일 필터링
  const visibleWeekdays = useMemo(() => {
    return WEEKDAYS.filter(day => !hiddenDays.includes(day.index));
  }, [hiddenDays]);

  // 표시할 날짜 필터링 (숨긴 요일 제외)
  const visibleDays = useMemo(() => {
    return days.filter(date => !hiddenDays.includes(date.getDay()));
  }, [days, hiddenDays]);

  // 동적 열 개수
  const columnCount = 7 - hiddenDays.length;

  return (
    <div className="calendar-grid">
      <div
        className="weekday-row"
        style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}
      >
        {visibleWeekdays.map((day) => (
          <div
            key={day.name}
            className={`weekday-cell ${showHolidays && day.isWeekend ? 'weekend' : ''}`}
          >
            {day.name}
          </div>
        ))}
      </div>
      <div
        className="days-grid"
        style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}
      >
        {visibleDays.map((date) => {
          const isCurrent = isCurrentMonth(date);
          // 이월 표시 숨기기
          if (!showAdjacentMonths && !isCurrent) {
            return <div key={date.toISOString()} className="day-cell empty" />;
          }
          return (
            <DayCell
              key={date.toISOString()}
              date={date}
              isCurrentMonth={isCurrent}
              isSelected={isSelected(date)}
              isToday={isToday(date)}
              events={getEventsForDate(date)}
              onClick={() => onSelectDate(date)}
              onDoubleClick={(e) => onOpenDate(date, e)}
              onEventClick={onEventClick}
              showEventDetails={showEventDetails}
              showHolidays={showHolidays}
            />
          );
        })}
      </div>
    </div>
  );
}
