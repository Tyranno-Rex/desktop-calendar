
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
        {days.map((date) => (
          <DayCell
            key={date.toISOString()}
            date={date}
            isCurrentMonth={isCurrentMonth(date)}
            isSelected={isSelected(date)}
            isToday={isToday(date)}
            events={getEventsForDate(date)}
            onClick={() => onSelectDate(date)}
            onDoubleClick={(e) => onOpenDate(date, e)}
            onEventClick={onEventClick}
          />
        ))}
      </div>
    </div>
  );
}
