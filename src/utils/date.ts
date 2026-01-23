import type { CalendarEvent } from '../types';

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
 * 이벤트 시간 비교 함수 (시간 없으면 맨 뒤로)
 */
export const compareEventTime = (a: CalendarEvent, b: CalendarEvent): number => {
  if (!a.time && !b.time) return 0;
  if (!a.time) return 1;
  if (!b.time) return -1;
  return a.time.localeCompare(b.time);
};
