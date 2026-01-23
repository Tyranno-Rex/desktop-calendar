import { useState, useMemo, useCallback } from 'react';
import {
  startOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isSameMonth,
  isSameDay,
  isToday,
  format,
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

  // 주간 뷰를 위한 날짜 계산
  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const tempDay = addDays(weekStart, i);
      const day = new Date(tempDay.getFullYear(), tempDay.getMonth(), tempDay.getDate(), 12, 0, 0, 0);
      days.push(day);
    }
    return days;
  }, [currentDate]);

  // 주간 뷰 헤더 텍스트 (예: "Jan 19 - 25, 2025")
  const weekRangeText = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });

    if (weekStart.getMonth() === weekEnd.getMonth()) {
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'd, yyyy')}`;
    } else if (weekStart.getFullYear() === weekEnd.getFullYear()) {
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    } else {
      return `${format(weekStart, 'MMM d, yyyy')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    }
  }, [currentDate]);

  const goToPreviousWeek = useCallback(() => {
    setCurrentDate(prev => subWeeks(prev, 1));
  }, []);

  const goToNextWeek = useCallback(() => {
    setCurrentDate(prev => addWeeks(prev, 1));
  }, []);

  const isCurrentWeek = useCallback(
    (date: Date) => {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      return date >= weekStart && date <= weekEnd;
    },
    [currentDate]
  );

  const isSameDayAs = useCallback(
    (date1: Date, date2: Date) => isSameDay(date1, date2),
    []
  );

  return {
    currentDate,
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
    isCurrentWeek,
    isTodayDate,
    isSameDayAs,
  };
}
