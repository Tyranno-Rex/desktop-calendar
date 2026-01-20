import { memo } from 'react';
import './Calendar.css';

interface CalendarHeaderProps {
  monthYear: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

export const CalendarHeader = memo(function CalendarHeader({
  monthYear,
  onPrevMonth,
  onNextMonth,
  onToday,
}: CalendarHeaderProps) {
  return (
    <div className="calendar-header">
      <button className="nav-btn" onClick={onPrevMonth} title="Previous month">
        &#8249;
      </button>
      <div className="month-year">
        <span>{monthYear}</span>
        <button className="today-btn" onClick={onToday} title="Go to today">
          Today
        </button>
      </div>
      <button className="nav-btn" onClick={onNextMonth} title="Next month">
        &#8250;
      </button>
    </div>
  );
});
