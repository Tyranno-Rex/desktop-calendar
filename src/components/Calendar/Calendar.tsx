import { useState, memo, useCallback } from 'react';
import { CalendarHeader, type ViewMode } from './CalendarHeader';
import { CalendarGrid } from './CalendarGrid';
import { WeekView } from './WeekView';
import { useCalendar } from '../../hooks/useCalendar';
import { isSameDay } from '../../utils/date';
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
  showGridLines?: boolean;
  hiddenDays?: number[];
}

function CalendarInner({
  events,
  getEventsForDate,
  onSelectDate,
  onOpenDate,
  onEventClick,
  selectedDate,
  showEventDetails = false,
  showHolidays = true,
  showAdjacentMonths = true,
  showGridLines = true,
  hiddenDays = [],
}: CalendarProps) {
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

  const isSelected = useCallback((date: Date) => isSameDay(date, selectedDate), [selectedDate]);

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
          showGridLines={showGridLines}
          hiddenDays={hiddenDays}
        />
      ) : (
        <WeekView
          weekDays={weekDays}
          events={events}
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
          onOpenDate={onOpenDate}
          onEventClick={onEventClick}
          showHolidays={showHolidays}
          hiddenDays={hiddenDays}
        />
      )}
    </div>
  );
}

export const Calendar = memo(CalendarInner);
