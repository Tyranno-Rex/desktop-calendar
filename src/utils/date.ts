import type { CalendarEvent, RepeatType } from '../types';

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

/**
 * yyyy-MM-dd 문자열을 Date 객체로 변환
 */
export const parseLocalDateString = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * 반복 타입에 따라 다음 날짜 계산
 */
export const getNextRepeatDate = (
  date: Date,
  repeatType: RepeatType,
  interval: number
): Date => {
  const next = new Date(date);

  switch (repeatType) {
    case 'daily':
      next.setDate(next.getDate() + interval);
      break;
    case 'weekly':
      next.setDate(next.getDate() + (interval * 7));
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + interval);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + interval);
      break;
  }

  return next;
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
  if (endDate) {
    const end = parseLocalDateString(endDate);
    if (targetDate > end) return false;
  }

  // 시작일과 같으면 true
  if (targetDateStr === event.date) return true;

  // 반복 패턴에 맞는지 확인
  switch (type) {
    case 'daily': {
      const diffDays = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays % interval === 0;
    }
    case 'weekly': {
      const diffDays = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays % (interval * 7) === 0;
    }
    case 'monthly': {
      // 같은 날짜인지 확인
      if (targetDate.getDate() !== startDate.getDate()) return false;
      const monthsDiff = (targetDate.getFullYear() - startDate.getFullYear()) * 12 +
                         (targetDate.getMonth() - startDate.getMonth());
      return monthsDiff >= 0 && monthsDiff % interval === 0;
    }
    case 'yearly': {
      // 같은 월/일인지 확인
      if (targetDate.getMonth() !== startDate.getMonth() ||
          targetDate.getDate() !== startDate.getDate()) return false;
      const yearsDiff = targetDate.getFullYear() - startDate.getFullYear();
      return yearsDiff >= 0 && yearsDiff % interval === 0;
    }
    default:
      return false;
  }
};

/**
 * 특정 날짜의 반복 일정 인스턴스 생성
 */
export const createRepeatInstance = (
  event: CalendarEvent,
  targetDateStr: string
): CalendarEvent => {
  return {
    ...event,
    id: `${event.id}_${targetDateStr}`,
    date: targetDateStr,
    isRepeatInstance: true,
    repeatGroupId: event.id,
  };
};
