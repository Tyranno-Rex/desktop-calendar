
import { CalendarHeader } from './CalendarHeader';
import { CalendarGrid } from './CalendarGrid';
import { useCalendar } from '../../hooks/useCalendar';
import type { CalendarEvent } from '../../types';
import './Calendar.css';

interface CalendarProps {
  getEventsForDate: (date: Date) => CalendarEvent[];
  onSelectDate: (date: Date) => void;
  onOpenDate: (date: Date, e: React.MouseEvent) => void;
  onEventClick?: (event: CalendarEvent, e: React.MouseEvent) => void;
  selectedDate: Date | null;
  showEventDetails?: boolean;
  showHolidays?: boolean;
  showAdjacentMonths?: boolean;
}

export function Calendar({ getEventsForDate, onSelectDate, onOpenDate, onEventClick, selectedDate, showEventDetails = false, showHolidays = true, showAdjacentMonths = true }: CalendarProps) {
  const {
    calendarDays,
    monthYear,
    goToPreviousMonth,
    goToNextMonth,
    goToToday,
    isCurrentMonth,
    isTodayDate,
  } = useCalendar();

  const isSelected = (date: Date) => {
    if (!selectedDate) return false;
    return (
      date.getFullYear() === selectedDate.getFullYear() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getDate() === selectedDate.getDate()
    );
  };

  return (
    <div className="calendar">
      <CalendarHeader
        monthYear={monthYear}
        onPrevMonth={goToPreviousMonth}
        onNextMonth={goToNextMonth}
        onToday={goToToday}
      />
      <CalendarGrid
        days={calendarDays}
        isCurrentMonth={isCurrentMonth}
        isSelected={isSelected}
        isToday={isTodayDate}
        getEventsForDate={getEventsForDate}
        onSelectDate={onSelectDate}
        onOpenDate={onOpenDate}
        onEventClick={onEventClick}
        showEventDetails={showEventDetails}
        showHolidays={showHolidays}
        showAdjacentMonths={showAdjacentMonths}
      />
    </div>
  );
}
