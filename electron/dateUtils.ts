// Shared date utilities for Electron main process
// Note: This duplicates some logic from src/utils/date.ts because
// Electron main process cannot import from renderer source

import type { CalendarEvent } from './store';

/**
 * yyyy-MM-dd 문자열을 Date 객체로 변환 (정오 12시로 설정하여 타임존 문제 방지)
 */
export const parseLocalDateString = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
};

/**
 * 로컬 날짜를 yyyy-MM-dd 형식으로 변환 (타임존 문제 방지)
 */
export const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 특정 날짜가 반복 일정에 해당하는지 확인
 */
export const isDateInRepeatSchedule = (
  targetDateStr: string,
  event: CalendarEvent
): boolean => {
  if (!event.repeat || event.repeat.type === 'none') {
    return event.date === targetDateStr;
  }

  const targetDate = parseLocalDateString(targetDateStr);
  const startDate = parseLocalDateString(event.date);
  const { type, interval, endDate } = event.repeat;

  // 시작일 이전이면 false
  if (targetDate < startDate) return false;

  // 종료일 이후면 false
  if (endDate && targetDate > parseLocalDateString(endDate)) return false;

  // 시작일과 같으면 true
  if (targetDateStr === event.date) return true;

  // 반복 패턴에 맞는지 확인
  const intervalNum = interval || 1;
  switch (type) {
    case 'daily': {
      const diffDays = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays % intervalNum === 0;
    }
    case 'weekly': {
      const diffDays = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays % (intervalNum * 7) === 0;
    }
    case 'monthly': {
      if (targetDate.getDate() !== startDate.getDate()) return false;
      const monthsDiff = (targetDate.getFullYear() - startDate.getFullYear()) * 12 +
                         (targetDate.getMonth() - startDate.getMonth());
      return monthsDiff >= 0 && monthsDiff % intervalNum === 0;
    }
    case 'yearly': {
      if (targetDate.getMonth() !== startDate.getMonth() ||
          targetDate.getDate() !== startDate.getDate()) return false;
      const yearsDiff = targetDate.getFullYear() - startDate.getFullYear();
      return yearsDiff >= 0 && yearsDiff % intervalNum === 0;
    }
    default:
      return false;
  }
};
