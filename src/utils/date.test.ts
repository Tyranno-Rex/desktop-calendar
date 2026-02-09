import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseTime,
  formatTime,
  getLocalDateString,
  compareEventTime,
  parseLocalDateString,
  isDateInRepeatSchedule,
  createRepeatInstance,
  isSameDay,
  sortEventsByCompletion,
  getEventsForDateString,
  getDDay,
  getTodayString,
  PERIODS,
  HOURS,
  MINUTES,
  REPEAT_OPTIONS,
  REMINDER_OPTIONS,
} from './date';
import type { CalendarEvent } from '../types';

// ==================== 상수 테스트 ====================

describe('Constants', () => {
  describe('PERIODS', () => {
    it('contains AM and PM', () => {
      expect(PERIODS).toEqual(['AM', 'PM']);
    });
  });

  describe('HOURS', () => {
    it('contains 12-hour format hours starting with 12', () => {
      expect(HOURS).toEqual([12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      expect(HOURS).toHaveLength(12);
    });
  });

  describe('MINUTES', () => {
    it('contains 10-minute intervals', () => {
      expect(MINUTES).toEqual([0, 10, 20, 30, 40, 50]);
      expect(MINUTES).toHaveLength(6);
    });
  });

  describe('REPEAT_OPTIONS', () => {
    it('contains all repeat types', () => {
      expect(REPEAT_OPTIONS.map(o => o.value)).toEqual(['none', 'daily', 'weekly', 'monthly', 'yearly']);
    });

    it('has labels for each option', () => {
      REPEAT_OPTIONS.forEach(option => {
        expect(option.label).toBeDefined();
        expect(typeof option.label).toBe('string');
        expect(option.label.length).toBeGreaterThan(0);
      });
    });
  });

  describe('REMINDER_OPTIONS', () => {
    it('contains expected reminder intervals', () => {
      const values = REMINDER_OPTIONS.map(o => o.value);
      expect(values).toContain(0);      // No reminder
      expect(values).toContain(5);      // 5 minutes
      expect(values).toContain(60);     // 1 hour
      expect(values).toContain(1440);   // 1 day
    });

    it('has labels for each option', () => {
      REMINDER_OPTIONS.forEach(option => {
        expect(option.label).toBeDefined();
        expect(typeof option.label).toBe('string');
      });
    });
  });
});

// ==================== parseTime ====================

describe('parseTime', () => {
  describe('valid inputs', () => {
    it('returns default for empty string', () => {
      expect(parseTime('')).toEqual({ period: 'AM', hour: 12, minute: 0 });
    });

    it('parses midnight (00:00) as 12 AM', () => {
      expect(parseTime('00:00')).toEqual({ period: 'AM', hour: 12, minute: 0 });
    });

    it('parses early morning (01:00 - 11:59) as AM', () => {
      expect(parseTime('01:00')).toEqual({ period: 'AM', hour: 1, minute: 0 });
      expect(parseTime('06:30')).toEqual({ period: 'AM', hour: 6, minute: 30 });
      expect(parseTime('09:30')).toEqual({ period: 'AM', hour: 9, minute: 30 });
      expect(parseTime('11:59')).toEqual({ period: 'AM', hour: 11, minute: 59 });
    });

    it('parses noon (12:00) as PM', () => {
      expect(parseTime('12:00')).toEqual({ period: 'PM', hour: 12, minute: 0 });
      expect(parseTime('12:30')).toEqual({ period: 'PM', hour: 12, minute: 30 });
    });

    it('parses afternoon (13:00 - 23:59) as PM', () => {
      expect(parseTime('13:00')).toEqual({ period: 'PM', hour: 1, minute: 0 });
      expect(parseTime('14:45')).toEqual({ period: 'PM', hour: 2, minute: 45 });
      expect(parseTime('18:00')).toEqual({ period: 'PM', hour: 6, minute: 0 });
      expect(parseTime('23:59')).toEqual({ period: 'PM', hour: 11, minute: 59 });
    });
  });

  describe('edge cases', () => {
    it('handles single digit hours in input', () => {
      // 실제로는 "9:30" 형식은 잘 안 쓰지만 테스트
      expect(parseTime('9:30')).toEqual({ period: 'AM', hour: 9, minute: 30 });
    });

    it('handles all hour boundaries', () => {
      // 0시 ~ 23시 모든 정시 테스트
      for (let h = 0; h < 24; h++) {
        const timeStr = `${String(h).padStart(2, '0')}:00`;
        const result = parseTime(timeStr);
        expect(result.period).toBe(h < 12 ? 'AM' : 'PM');
        expect(result.minute).toBe(0);
      }
    });
  });
});

// ==================== formatTime ====================

describe('formatTime', () => {
  describe('AM times', () => {
    it('formats 12 AM as 00:00 (midnight)', () => {
      expect(formatTime('AM', 12, 0)).toBe('00:00');
    });

    it('formats 1-11 AM correctly', () => {
      expect(formatTime('AM', 1, 0)).toBe('01:00');
      expect(formatTime('AM', 9, 0)).toBe('09:00');
      expect(formatTime('AM', 11, 30)).toBe('11:30');
    });
  });

  describe('PM times', () => {
    it('formats 12 PM as 12:00 (noon)', () => {
      expect(formatTime('PM', 12, 0)).toBe('12:00');
      expect(formatTime('PM', 12, 30)).toBe('12:30');
    });

    it('formats 1-11 PM correctly', () => {
      expect(formatTime('PM', 1, 0)).toBe('13:00');
      expect(formatTime('PM', 2, 0)).toBe('14:00');
      expect(formatTime('PM', 11, 30)).toBe('23:30');
    });
  });

  describe('minute padding', () => {
    it('pads single digit minutes', () => {
      expect(formatTime('AM', 9, 0)).toBe('09:00');
      expect(formatTime('AM', 9, 5)).toBe('09:05');
      expect(formatTime('PM', 3, 9)).toBe('15:09');
    });

    it('does not add extra padding to double digit minutes', () => {
      expect(formatTime('AM', 9, 30)).toBe('09:30');
      expect(formatTime('PM', 5, 45)).toBe('17:45');
    });
  });
});

// ==================== parseTime + formatTime roundtrip ====================

describe('parseTime + formatTime roundtrip', () => {
  it('roundtrips all valid 24-hour times', () => {
    const testTimes = [
      '00:00', '00:30', '01:00', '06:30', '11:59',
      '12:00', '12:30', '13:00', '15:45', '18:00', '23:59'
    ];

    testTimes.forEach((time) => {
      const parsed = parseTime(time);
      const formatted = formatTime(parsed.period, parsed.hour, parsed.minute);
      expect(formatted).toBe(time);
    });
  });

  it('roundtrips every hour', () => {
    for (let h = 0; h < 24; h++) {
      const timeStr = `${String(h).padStart(2, '0')}:00`;
      const parsed = parseTime(timeStr);
      const formatted = formatTime(parsed.period, parsed.hour, parsed.minute);
      expect(formatted).toBe(timeStr);
    }
  });
});

// ==================== getLocalDateString ====================

describe('getLocalDateString', () => {
  it('returns YYYY-MM-DD format', () => {
    const date = new Date(2024, 0, 15); // Jan 15, 2024
    expect(getLocalDateString(date)).toBe('2024-01-15');
  });

  it('pads single-digit month', () => {
    const date = new Date(2024, 2, 15); // Mar 15, 2024
    expect(getLocalDateString(date)).toBe('2024-03-15');
  });

  it('pads single-digit day', () => {
    const date = new Date(2024, 5, 5); // Jun 5, 2024
    expect(getLocalDateString(date)).toBe('2024-06-05');
  });

  it('handles start of year', () => {
    const date = new Date(2024, 0, 1); // Jan 1, 2024
    expect(getLocalDateString(date)).toBe('2024-01-01');
  });

  it('handles end of year', () => {
    const date = new Date(2024, 11, 31); // Dec 31, 2024
    expect(getLocalDateString(date)).toBe('2024-12-31');
  });

  it('handles leap year Feb 29', () => {
    const date = new Date(2024, 1, 29); // Feb 29, 2024 (leap year)
    expect(getLocalDateString(date)).toBe('2024-02-29');
  });

  it('handles different years', () => {
    expect(getLocalDateString(new Date(1999, 11, 31))).toBe('1999-12-31');
    expect(getLocalDateString(new Date(2000, 0, 1))).toBe('2000-01-01');
    expect(getLocalDateString(new Date(2099, 5, 15))).toBe('2099-06-15');
  });
});

// ==================== parseLocalDateString ====================

describe('parseLocalDateString', () => {
  it('parses YYYY-MM-DD to Date at noon', () => {
    const date = parseLocalDateString('2024-06-15');
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(5); // June (0-indexed)
    expect(date.getDate()).toBe(15);
    expect(date.getHours()).toBe(12); // noon to avoid timezone issues
  });

  it('parses start of year', () => {
    const date = parseLocalDateString('2024-01-01');
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(0);
    expect(date.getDate()).toBe(1);
  });

  it('parses end of year', () => {
    const date = parseLocalDateString('2024-12-31');
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(11);
    expect(date.getDate()).toBe(31);
  });

  it('parses leap year date', () => {
    const date = parseLocalDateString('2024-02-29');
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(1);
    expect(date.getDate()).toBe(29);
  });

  it('roundtrips with getLocalDateString', () => {
    const testDates = ['2024-01-01', '2024-06-15', '2024-12-31', '2024-02-29'];
    testDates.forEach(dateStr => {
      const parsed = parseLocalDateString(dateStr);
      const formatted = getLocalDateString(parsed);
      expect(formatted).toBe(dateStr);
    });
  });
});

// ==================== compareEventTime ====================

describe('compareEventTime', () => {
  const makeEvent = (time?: string): CalendarEvent => ({
    id: '1',
    title: 'Test',
    date: '2024-01-01',
    time,
  });

  describe('events without time', () => {
    it('returns 0 when both have no time', () => {
      expect(compareEventTime(makeEvent(), makeEvent())).toBe(0);
    });

    it('returns 1 when first has no time (goes to end)', () => {
      expect(compareEventTime(makeEvent(), makeEvent('09:00'))).toBe(1);
    });

    it('returns -1 when second has no time', () => {
      expect(compareEventTime(makeEvent('09:00'), makeEvent())).toBe(-1);
    });
  });

  describe('events with time', () => {
    it('returns negative when first is earlier', () => {
      expect(compareEventTime(makeEvent('09:00'), makeEvent('10:00'))).toBeLessThan(0);
      expect(compareEventTime(makeEvent('00:00'), makeEvent('23:59'))).toBeLessThan(0);
    });

    it('returns positive when first is later', () => {
      expect(compareEventTime(makeEvent('10:00'), makeEvent('09:00'))).toBeGreaterThan(0);
      expect(compareEventTime(makeEvent('23:59'), makeEvent('00:00'))).toBeGreaterThan(0);
    });

    it('returns 0 when times are equal', () => {
      expect(compareEventTime(makeEvent('09:00'), makeEvent('09:00'))).toBe(0);
      expect(compareEventTime(makeEvent('12:30'), makeEvent('12:30'))).toBe(0);
    });
  });

  describe('sorting behavior', () => {
    it('sorts array correctly when used with Array.sort', () => {
      const events = [
        makeEvent('14:00'),
        makeEvent('09:00'),
        makeEvent(), // no time
        makeEvent('12:00'),
      ];
      const sorted = [...events].sort(compareEventTime);
      expect(sorted[0].time).toBe('09:00');
      expect(sorted[1].time).toBe('12:00');
      expect(sorted[2].time).toBe('14:00');
      expect(sorted[3].time).toBeUndefined(); // no time goes to end
    });
  });
});

// ==================== isSameDay ====================

describe('isSameDay', () => {
  describe('null handling', () => {
    it('returns false when first is null', () => {
      expect(isSameDay(null, new Date())).toBe(false);
    });

    it('returns false when second is null', () => {
      expect(isSameDay(new Date(), null)).toBe(false);
    });

    it('returns false when both are null', () => {
      expect(isSameDay(null, null)).toBe(false);
    });
  });

  describe('same day comparisons', () => {
    it('returns true for same day different times', () => {
      const d1 = new Date(2024, 5, 15, 10, 0);
      const d2 = new Date(2024, 5, 15, 22, 30);
      expect(isSameDay(d1, d2)).toBe(true);
    });

    it('returns true for exact same Date object', () => {
      const d = new Date(2024, 5, 15);
      expect(isSameDay(d, d)).toBe(true);
    });

    it('returns true for start and end of same day', () => {
      const d1 = new Date(2024, 5, 15, 0, 0, 0, 0);
      const d2 = new Date(2024, 5, 15, 23, 59, 59, 999);
      expect(isSameDay(d1, d2)).toBe(true);
    });
  });

  describe('different day comparisons', () => {
    it('returns false for different days', () => {
      const d1 = new Date(2024, 5, 15);
      const d2 = new Date(2024, 5, 16);
      expect(isSameDay(d1, d2)).toBe(false);
    });

    it('returns false for different months same day number', () => {
      const d1 = new Date(2024, 5, 15); // June 15
      const d2 = new Date(2024, 6, 15); // July 15
      expect(isSameDay(d1, d2)).toBe(false);
    });

    it('returns false for different years same month and day', () => {
      const d1 = new Date(2024, 5, 15);
      const d2 = new Date(2025, 5, 15);
      expect(isSameDay(d1, d2)).toBe(false);
    });

    it('returns false for adjacent days at midnight boundary', () => {
      const d1 = new Date(2024, 5, 15, 23, 59, 59);
      const d2 = new Date(2024, 5, 16, 0, 0, 0);
      expect(isSameDay(d1, d2)).toBe(false);
    });
  });
});

// ==================== sortEventsByCompletion ====================

describe('sortEventsByCompletion', () => {
  const makeEvent = (id: string, time: string | undefined, completed: boolean): CalendarEvent => ({
    id,
    title: `Event ${id}`,
    date: '2024-01-01',
    time,
    completed,
  });

  describe('sorting order', () => {
    it('puts incomplete first, then completed', () => {
      const events = [
        makeEvent('1', '09:00', true),
        makeEvent('2', '14:00', false),
        makeEvent('3', '08:00', true),
        makeEvent('4', '10:00', false),
      ];
      const sorted = sortEventsByCompletion(events);
      expect(sorted[0].completed).toBe(false);
      expect(sorted[1].completed).toBe(false);
      expect(sorted[2].completed).toBe(true);
      expect(sorted[3].completed).toBe(true);
    });

    it('sorts each group by time', () => {
      const events = [
        makeEvent('1', '09:00', true),
        makeEvent('2', '14:00', false),
        makeEvent('3', '08:00', true),
        makeEvent('4', '10:00', false),
      ];
      const sorted = sortEventsByCompletion(events);
      // Incomplete: 10:00, 14:00
      expect(sorted[0].time).toBe('10:00');
      expect(sorted[1].time).toBe('14:00');
      // Completed: 08:00, 09:00
      expect(sorted[2].time).toBe('08:00');
      expect(sorted[3].time).toBe('09:00');
    });
  });

  describe('edge cases', () => {
    it('handles empty array', () => {
      expect(sortEventsByCompletion([])).toEqual([]);
    });

    it('handles all incomplete', () => {
      const events = [
        makeEvent('1', '14:00', false),
        makeEvent('2', '09:00', false),
      ];
      const sorted = sortEventsByCompletion(events);
      expect(sorted[0].time).toBe('09:00');
      expect(sorted[1].time).toBe('14:00');
    });

    it('handles all completed', () => {
      const events = [
        makeEvent('1', '14:00', true),
        makeEvent('2', '09:00', true),
      ];
      const sorted = sortEventsByCompletion(events);
      expect(sorted[0].time).toBe('09:00');
      expect(sorted[1].time).toBe('14:00');
    });

    it('handles events without time', () => {
      const events = [
        makeEvent('1', undefined, false),
        makeEvent('2', '09:00', false),
        makeEvent('3', undefined, true),
        makeEvent('4', '08:00', true),
      ];
      const sorted = sortEventsByCompletion(events);
      // Incomplete with time first, then incomplete without time
      expect(sorted[0].time).toBe('09:00');
      expect(sorted[1].time).toBeUndefined();
      // Completed with time first, then completed without time
      expect(sorted[2].time).toBe('08:00');
      expect(sorted[3].time).toBeUndefined();
    });

    it('handles single event', () => {
      const events = [makeEvent('1', '09:00', false)];
      const sorted = sortEventsByCompletion(events);
      expect(sorted).toHaveLength(1);
      expect(sorted[0].id).toBe('1');
    });
  });

  describe('immutability', () => {
    it('does not modify original array', () => {
      const events = [
        makeEvent('1', '14:00', false),
        makeEvent('2', '09:00', true),
      ];
      const originalOrder = events.map(e => e.id);
      sortEventsByCompletion(events);
      expect(events.map(e => e.id)).toEqual(originalOrder);
    });
  });

  describe('undefined completed field', () => {
    it('treats undefined completed as incomplete (falsy)', () => {
      const events: CalendarEvent[] = [
        { id: '1', title: 'No completed field', date: '2024-01-01', time: '10:00' },
        { id: '2', title: 'Completed', date: '2024-01-01', time: '09:00', completed: true },
      ];
      const sorted = sortEventsByCompletion(events);
      expect(sorted[0].id).toBe('1'); // undefined completed = incomplete
      expect(sorted[1].id).toBe('2'); // completed = true
    });
  });
});

// ==================== isDateInRepeatSchedule ====================

describe('isDateInRepeatSchedule', () => {
  const baseEvent: CalendarEvent = {
    id: '1',
    title: 'Test',
    date: '2024-01-15',
  };

  describe('non-repeating events', () => {
    it('returns true for exact date match', () => {
      expect(isDateInRepeatSchedule('2024-01-15', baseEvent)).toBe(true);
    });

    it('returns false for non-matching date', () => {
      expect(isDateInRepeatSchedule('2024-01-16', baseEvent)).toBe(false);
      expect(isDateInRepeatSchedule('2024-01-14', baseEvent)).toBe(false);
    });

    it('handles repeat type "none" same as no repeat', () => {
      const event = { ...baseEvent, repeat: { type: 'none' as const, interval: 1 } };
      expect(isDateInRepeatSchedule('2024-01-15', event)).toBe(true);
      expect(isDateInRepeatSchedule('2024-01-16', event)).toBe(false);
    });
  });

  describe('date boundaries', () => {
    it('returns false for date before start', () => {
      const event = { ...baseEvent, repeat: { type: 'daily' as const, interval: 1 } };
      expect(isDateInRepeatSchedule('2024-01-14', event)).toBe(false);
      expect(isDateInRepeatSchedule('2023-12-31', event)).toBe(false);
    });

    it('returns true for start date', () => {
      const event = { ...baseEvent, repeat: { type: 'daily' as const, interval: 1 } };
      expect(isDateInRepeatSchedule('2024-01-15', event)).toBe(true);
    });
  });

  describe('daily repeat', () => {
    it('matches every day with interval 1', () => {
      const event = { ...baseEvent, repeat: { type: 'daily' as const, interval: 1 } };
      expect(isDateInRepeatSchedule('2024-01-15', event)).toBe(true);
      expect(isDateInRepeatSchedule('2024-01-16', event)).toBe(true);
      expect(isDateInRepeatSchedule('2024-01-17', event)).toBe(true);
      expect(isDateInRepeatSchedule('2024-02-15', event)).toBe(true);
    });

    it('matches every N days with interval N', () => {
      const event = { ...baseEvent, repeat: { type: 'daily' as const, interval: 2 } };
      expect(isDateInRepeatSchedule('2024-01-15', event)).toBe(true); // start
      expect(isDateInRepeatSchedule('2024-01-16', event)).toBe(false);
      expect(isDateInRepeatSchedule('2024-01-17', event)).toBe(true);
      expect(isDateInRepeatSchedule('2024-01-18', event)).toBe(false);
      expect(isDateInRepeatSchedule('2024-01-19', event)).toBe(true);
    });

    it('handles interval of 3', () => {
      const event = { ...baseEvent, repeat: { type: 'daily' as const, interval: 3 } };
      expect(isDateInRepeatSchedule('2024-01-15', event)).toBe(true);
      expect(isDateInRepeatSchedule('2024-01-16', event)).toBe(false);
      expect(isDateInRepeatSchedule('2024-01-17', event)).toBe(false);
      expect(isDateInRepeatSchedule('2024-01-18', event)).toBe(true);
    });
  });

  describe('weekly repeat', () => {
    it('matches every week with interval 1', () => {
      const event = { ...baseEvent, repeat: { type: 'weekly' as const, interval: 1 } };
      expect(isDateInRepeatSchedule('2024-01-15', event)).toBe(true);
      expect(isDateInRepeatSchedule('2024-01-22', event)).toBe(true);
      expect(isDateInRepeatSchedule('2024-01-29', event)).toBe(true);
      expect(isDateInRepeatSchedule('2024-02-05', event)).toBe(true);
    });

    it('does not match non-weekly dates', () => {
      const event = { ...baseEvent, repeat: { type: 'weekly' as const, interval: 1 } };
      expect(isDateInRepeatSchedule('2024-01-16', event)).toBe(false);
      expect(isDateInRepeatSchedule('2024-01-21', event)).toBe(false);
    });

    it('matches every N weeks with interval N', () => {
      const event = { ...baseEvent, repeat: { type: 'weekly' as const, interval: 2 } };
      expect(isDateInRepeatSchedule('2024-01-15', event)).toBe(true);
      expect(isDateInRepeatSchedule('2024-01-22', event)).toBe(false); // 1 week
      expect(isDateInRepeatSchedule('2024-01-29', event)).toBe(true);  // 2 weeks
      expect(isDateInRepeatSchedule('2024-02-05', event)).toBe(false); // 3 weeks
      expect(isDateInRepeatSchedule('2024-02-12', event)).toBe(true);  // 4 weeks
    });
  });

  describe('monthly repeat', () => {
    it('matches same day each month with interval 1', () => {
      const event = { ...baseEvent, repeat: { type: 'monthly' as const, interval: 1 } };
      expect(isDateInRepeatSchedule('2024-01-15', event)).toBe(true);
      expect(isDateInRepeatSchedule('2024-02-15', event)).toBe(true);
      expect(isDateInRepeatSchedule('2024-03-15', event)).toBe(true);
      expect(isDateInRepeatSchedule('2024-12-15', event)).toBe(true);
    });

    it('does not match different days', () => {
      const event = { ...baseEvent, repeat: { type: 'monthly' as const, interval: 1 } };
      expect(isDateInRepeatSchedule('2024-02-14', event)).toBe(false);
      expect(isDateInRepeatSchedule('2024-02-16', event)).toBe(false);
    });

    it('matches every N months with interval N', () => {
      const event = { ...baseEvent, repeat: { type: 'monthly' as const, interval: 2 } };
      expect(isDateInRepeatSchedule('2024-01-15', event)).toBe(true);
      expect(isDateInRepeatSchedule('2024-02-15', event)).toBe(false);
      expect(isDateInRepeatSchedule('2024-03-15', event)).toBe(true);
      expect(isDateInRepeatSchedule('2024-04-15', event)).toBe(false);
      expect(isDateInRepeatSchedule('2024-05-15', event)).toBe(true);
    });

    it('matches across years', () => {
      const event = { ...baseEvent, repeat: { type: 'monthly' as const, interval: 1 } };
      expect(isDateInRepeatSchedule('2025-01-15', event)).toBe(true);
      expect(isDateInRepeatSchedule('2025-06-15', event)).toBe(true);
    });

    // 월말 문제: 31일 시작 → 2월
    it('does not match February for 31st start date (month has no 31st)', () => {
      const event31: CalendarEvent = {
        id: '1',
        title: 'Test',
        date: '2024-01-31',
        repeat: { type: 'monthly', interval: 1 },
      };
      // February has no 31st, so it should not match
      expect(isDateInRepeatSchedule('2024-02-29', event31)).toBe(false);
      expect(isDateInRepeatSchedule('2024-02-28', event31)).toBe(false);
      // March 31 should match
      expect(isDateInRepeatSchedule('2024-03-31', event31)).toBe(true);
    });
  });

  describe('yearly repeat', () => {
    it('matches same date each year with interval 1', () => {
      const event = { ...baseEvent, repeat: { type: 'yearly' as const, interval: 1 } };
      expect(isDateInRepeatSchedule('2024-01-15', event)).toBe(true);
      expect(isDateInRepeatSchedule('2025-01-15', event)).toBe(true);
      expect(isDateInRepeatSchedule('2026-01-15', event)).toBe(true);
      expect(isDateInRepeatSchedule('2030-01-15', event)).toBe(true);
    });

    it('does not match different dates', () => {
      const event = { ...baseEvent, repeat: { type: 'yearly' as const, interval: 1 } };
      expect(isDateInRepeatSchedule('2025-01-16', event)).toBe(false);
      expect(isDateInRepeatSchedule('2025-02-15', event)).toBe(false);
    });

    it('matches every N years with interval N', () => {
      const event = { ...baseEvent, repeat: { type: 'yearly' as const, interval: 2 } };
      expect(isDateInRepeatSchedule('2024-01-15', event)).toBe(true);
      expect(isDateInRepeatSchedule('2025-01-15', event)).toBe(false);
      expect(isDateInRepeatSchedule('2026-01-15', event)).toBe(true);
      expect(isDateInRepeatSchedule('2027-01-15', event)).toBe(false);
      expect(isDateInRepeatSchedule('2028-01-15', event)).toBe(true);
    });

    // 윤년 2월 29일 처리
    it('handles leap year Feb 29', () => {
      const leapEvent: CalendarEvent = {
        id: '1',
        title: 'Leap Day',
        date: '2024-02-29',
        repeat: { type: 'yearly', interval: 1 },
      };
      expect(isDateInRepeatSchedule('2024-02-29', leapEvent)).toBe(true);
      // 2025 is not a leap year, so Feb 29 doesn't exist
      expect(isDateInRepeatSchedule('2025-02-28', leapEvent)).toBe(false);
      // 2028 is a leap year
      expect(isDateInRepeatSchedule('2028-02-29', leapEvent)).toBe(true);
    });
  });

  describe('with endDate', () => {
    it('matches dates up to and including endDate', () => {
      const event = {
        ...baseEvent,
        repeat: { type: 'daily' as const, interval: 1, endDate: '2024-01-20' },
      };
      expect(isDateInRepeatSchedule('2024-01-15', event)).toBe(true);
      expect(isDateInRepeatSchedule('2024-01-18', event)).toBe(true);
      expect(isDateInRepeatSchedule('2024-01-20', event)).toBe(true); // inclusive
    });

    it('does not match dates after endDate', () => {
      const event = {
        ...baseEvent,
        repeat: { type: 'daily' as const, interval: 1, endDate: '2024-01-20' },
      };
      expect(isDateInRepeatSchedule('2024-01-21', event)).toBe(false);
      expect(isDateInRepeatSchedule('2024-02-01', event)).toBe(false);
    });

    it('works with weekly repeat and endDate', () => {
      const event = {
        ...baseEvent,
        repeat: { type: 'weekly' as const, interval: 1, endDate: '2024-01-29' },
      };
      expect(isDateInRepeatSchedule('2024-01-15', event)).toBe(true);
      expect(isDateInRepeatSchedule('2024-01-22', event)).toBe(true);
      expect(isDateInRepeatSchedule('2024-01-29', event)).toBe(true);
      expect(isDateInRepeatSchedule('2024-02-05', event)).toBe(false); // after end
    });
  });
});

// ==================== createRepeatInstance ====================

describe('createRepeatInstance', () => {
  const event: CalendarEvent = {
    id: 'original-123',
    title: 'Weekly Meeting',
    date: '2024-01-15',
    time: '10:00',
    description: 'Team sync',
    color: 'blue',
    repeat: { type: 'weekly', interval: 1 },
  };

  it('creates instance with modified id', () => {
    const instance = createRepeatInstance(event, '2024-01-22');
    expect(instance.id).toBe('original-123_2024-01-22');
  });

  it('sets new date', () => {
    const instance = createRepeatInstance(event, '2024-01-22');
    expect(instance.date).toBe('2024-01-22');
  });

  it('marks as repeat instance', () => {
    const instance = createRepeatInstance(event, '2024-01-22');
    expect(instance.isRepeatInstance).toBe(true);
  });

  it('sets repeatGroupId to original id', () => {
    const instance = createRepeatInstance(event, '2024-01-22');
    expect(instance.repeatGroupId).toBe('original-123');
  });

  it('preserves all other properties', () => {
    const instance = createRepeatInstance(event, '2024-01-22');
    expect(instance.title).toBe('Weekly Meeting');
    expect(instance.time).toBe('10:00');
    expect(instance.description).toBe('Team sync');
    expect(instance.color).toBe('blue');
    expect(instance.repeat).toEqual({ type: 'weekly', interval: 1 });
  });

  it('does not modify original event', () => {
    const originalId = event.id;
    const originalDate = event.date;
    createRepeatInstance(event, '2024-01-22');
    expect(event.id).toBe(originalId);
    expect(event.date).toBe(originalDate);
    expect(event.isRepeatInstance).toBeUndefined();
    expect(event.repeatGroupId).toBeUndefined();
  });
});

// ==================== getEventsForDateString ====================

describe('getEventsForDateString', () => {
  describe('basic functionality', () => {
    it('returns empty array for empty events', () => {
      expect(getEventsForDateString('2024-01-15', [])).toEqual([]);
    });

    it('returns matching normal events', () => {
      const events: CalendarEvent[] = [
        { id: '1', title: 'Event 1', date: '2024-01-15' },
        { id: '2', title: 'Event 2', date: '2024-01-16' },
      ];
      const result = getEventsForDateString('2024-01-15', events);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('returns multiple events for same date', () => {
      const events: CalendarEvent[] = [
        { id: '1', title: 'Event 1', date: '2024-01-15' },
        { id: '2', title: 'Event 2', date: '2024-01-15' },
        { id: '3', title: 'Event 3', date: '2024-01-16' },
      ];
      const result = getEventsForDateString('2024-01-15', events);
      expect(result).toHaveLength(2);
      expect(result.map(e => e.id)).toContain('1');
      expect(result.map(e => e.id)).toContain('2');
    });
  });

  describe('repeat events', () => {
    it('returns original event on start date', () => {
      const events: CalendarEvent[] = [
        { id: '1', title: 'Weekly', date: '2024-01-15', repeat: { type: 'weekly', interval: 1 } },
      ];
      const result = getEventsForDateString('2024-01-15', events);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
      expect(result[0].isRepeatInstance).toBeUndefined();
    });

    it('returns repeat instance for subsequent dates', () => {
      const events: CalendarEvent[] = [
        { id: '1', title: 'Weekly', date: '2024-01-08', repeat: { type: 'weekly', interval: 1 } },
      ];
      const result = getEventsForDateString('2024-01-15', events);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1_2024-01-15');
      expect(result[0].isRepeatInstance).toBe(true);
      expect(result[0].repeatGroupId).toBe('1');
    });

    it('does not return repeat event for non-matching dates', () => {
      const events: CalendarEvent[] = [
        { id: '1', title: 'Weekly', date: '2024-01-08', repeat: { type: 'weekly', interval: 1 } },
      ];
      const result = getEventsForDateString('2024-01-10', events);
      expect(result).toHaveLength(0);
    });
  });

  describe('mixed events', () => {
    it('returns both normal and repeat instances', () => {
      const events: CalendarEvent[] = [
        { id: '1', title: 'Normal', date: '2024-01-15' },
        { id: '2', title: 'Weekly', date: '2024-01-08', repeat: { type: 'weekly', interval: 1 } },
      ];
      const result = getEventsForDateString('2024-01-15', events);
      expect(result).toHaveLength(2);
      expect(result.find(e => e.id === '1')).toBeDefined();
      expect(result.find(e => e.repeatGroupId === '2')).toBeDefined();
    });

    it('handles multiple overlapping repeat schedules', () => {
      const events: CalendarEvent[] = [
        { id: '1', title: 'Daily', date: '2024-01-01', repeat: { type: 'daily', interval: 1 } },
        { id: '2', title: 'Weekly', date: '2024-01-08', repeat: { type: 'weekly', interval: 1 } },
      ];
      const result = getEventsForDateString('2024-01-15', events);
      expect(result).toHaveLength(2);
    });
  });
});

// ==================== getDDay ====================

describe('getDDay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 5, 15)); // June 15, 2024
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('D-Day', () => {
    it('returns D-Day for today', () => {
      expect(getDDay('2024-06-15')).toBe('D-Day');
    });
  });

  describe('future dates (D-N)', () => {
    it('returns D-1 for tomorrow', () => {
      expect(getDDay('2024-06-16')).toBe('D-1');
    });

    it('returns D-N for various future dates', () => {
      expect(getDDay('2024-06-17')).toBe('D-2');
      expect(getDDay('2024-06-25')).toBe('D-10');
      expect(getDDay('2024-07-15')).toBe('D-30');
      expect(getDDay('2025-06-15')).toBe('D-365'); // leap year
    });
  });

  describe('past dates (D+N)', () => {
    it('returns D+1 for yesterday', () => {
      expect(getDDay('2024-06-14')).toBe('D+1');
    });

    it('returns D+N for various past dates', () => {
      expect(getDDay('2024-06-13')).toBe('D+2');
      expect(getDDay('2024-06-05')).toBe('D+10');
      expect(getDDay('2024-05-15')).toBe('D+31');
    });
  });
});

// ==================== getTodayString ====================

describe('getTodayString', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns today in YYYY-MM-DD format', () => {
    vi.setSystemTime(new Date(2024, 5, 15)); // June 15, 2024
    expect(getTodayString()).toBe('2024-06-15');
  });

  it('handles start of year', () => {
    vi.setSystemTime(new Date(2024, 0, 1));
    expect(getTodayString()).toBe('2024-01-01');
  });

  it('handles end of year', () => {
    vi.setSystemTime(new Date(2024, 11, 31));
    expect(getTodayString()).toBe('2024-12-31');
  });

  it('handles leap year Feb 29', () => {
    vi.setSystemTime(new Date(2024, 1, 29));
    expect(getTodayString()).toBe('2024-02-29');
  });
});
