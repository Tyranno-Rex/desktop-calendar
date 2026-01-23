import { useState, useMemo, useCallback } from 'react';
import {
  startOfMonth,
  startOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
} from 'date-fns';

export function useCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });

    // 항상 42일(6주) 표시
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const tempDay = addDays(calendarStart, i);
      // 타임존 문제 방지: 명시적으로 로컬 날짜 생성
      const day = new Date(tempDay.getFullYear(), tempDay.getMonth(), tempDay.getDate(), 12, 0, 0, 0);
      days.push(day);
    }
    return days;
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

  const goToMonth = useCallback((month: number) => {
    setCurrentDate(prev => new Date(prev.getFullYear(), month, 1));
  }, []);

  const goToYear = useCallback((year: number) => {
    setCurrentDate(prev => new Date(year, prev.getMonth(), 1));
  }, []);

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const isCurrentMonth = useCallback(
    (date: Date) => isSameMonth(date, currentDate),
    [currentDate]
  );

  const isTodayDate = useCallback((date: Date) => isToday(date), []);

  return {
    calendarDays,
    goToPreviousMonth,
    goToNextMonth,
    goToToday,
    goToMonth,
    goToYear,
    currentMonth,
    currentYear,
    isCurrentMonth,
    isTodayDate,
  };
}
