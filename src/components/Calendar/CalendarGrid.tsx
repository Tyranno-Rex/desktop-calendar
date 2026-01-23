
import { DayCell } from './DayCell';
import type { CalendarEvent } from '../../types';
import './Calendar.css';

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
}: CalendarGridProps) {
  return (
    <div className="calendar-grid">
      <div className="weekday-row">
        {WEEKDAY_NAMES.map((day) => (
          <div key={day} className="weekday-cell">
            {day}
          </div>
        ))}
      </div>
      <div className="days-grid">
        {days.map((date) => {
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
