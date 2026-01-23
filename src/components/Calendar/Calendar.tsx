import { useState } from 'react';
import { CalendarHeader, type ViewMode } from './CalendarHeader';
import { CalendarGrid } from './CalendarGrid';
import { WeekView } from './WeekView';
import { useCalendar } from '../../hooks/useCalendar';
import type { CalendarEvent } from '../../types';
import './Calendar.css';

interface CalendarProps {
  events: CalendarEvent[];
  getEventsForDate: (date: Date) => CalendarEvent[];
  onSelectDate: (date: Date) => void;
  onOpenDate: (date: Date, e: React.MouseEvent) => void;
  onEventClick?: (event: CalendarEvent, e: React.MouseEvent) => void;
  selectedDate: Date | null;
  showEventDetails?: boolean;
  showHolidays?: boolean;
  showAdjacentMonths?: boolean;
  hiddenDays?: number[];
}

export function Calendar({ events, getEventsForDate, onSelectDate, onOpenDate, onEventClick, selectedDate, showEventDetails = false, showHolidays = true, showAdjacentMonths = true, hiddenDays = [] }: CalendarProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  const {
    calendarDays,
    weekDays,
    weekRangeText,
    goToPreviousMonth,
    goToNextMonth,
    goToPreviousWeek,
    goToNextWeek,
    goToToday,
    goToMonth,
    goToYear,
    currentMonth,
    currentYear,
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
        currentMonth={currentMonth}
        currentYear={currentYear}
        weekRangeText={weekRangeText}
        onPrevMonth={goToPreviousMonth}
        onNextMonth={goToNextMonth}
        onPrevWeek={goToPreviousWeek}
        onNextWeek={goToNextWeek}
        onToday={goToToday}
        onMonthSelect={goToMonth}
        onYearSelect={goToYear}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
      {viewMode === 'month' ? (
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
          hiddenDays={hiddenDays}
        />
      ) : (
        <WeekView
          weekDays={weekDays}
          events={events}
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
          onEventClick={onEventClick}
          showHolidays={showHolidays}
          hiddenDays={hiddenDays}
        />
      )}
    </div>
  );
}
