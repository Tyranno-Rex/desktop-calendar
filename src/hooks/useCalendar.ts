import { useState, useMemo, useCallback } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isToday,
} from 'date-fns';

export function useCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  const goToPreviousMonth = useCallback(() => {
    setCurrentDate(prev => subMonths(prev, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentDate(prev => addMonths(prev, 1));
  }, []);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const isCurrentMonth = useCallback(
    (date: Date) => isSameMonth(date, currentDate),
    [currentDate]
  );

  const isTodayDate = useCallback((date: Date) => isToday(date), []);

  const monthYear = format(currentDate, 'MMMM yyyy');

  return {
    calendarDays,
    monthYear,
    goToPreviousMonth,
    goToNextMonth,
    goToToday,
    isCurrentMonth,
    isTodayDate,
  };
}
