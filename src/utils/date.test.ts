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
} from './date';
import type { CalendarEvent } from '../types';

// ==================== parseTime ====================

describe('parseTime', () => {
  it('returns default for empty string', () => {
    expect(parseTime('')).toEqual({ period: 'AM', hour: 12, minute: 0 });
  });

  it('parses midnight (00:00) as 12 AM', () => {
    expect(parseTime('00:00')).toEqual({ period: 'AM', hour: 12, minute: 0 });
  });

  it('parses morning time (09:30) as AM', () => {
    expect(parseTime('09:30')).toEqual({ period: 'AM', hour: 9, minute: 30 });
  });

  it('parses noon (12:00) as PM', () => {
    expect(parseTime('12:00')).toEqual({ period: 'PM', hour: 12, minute: 0 });
  });

  it('parses afternoon time (14:45) as PM', () => {
    expect(parseTime('14:45')).toEqual({ period: 'PM', hour: 2, minute: 45 });
  });

  it('parses 11:59 as AM', () => {
    expect(parseTime('11:59')).toEqual({ period: 'AM', hour: 11, minute: 59 });
  });

  it('parses 23:59 as PM', () => {
    expect(parseTime('23:59')).toEqual({ period: 'PM', hour: 11, minute: 59 });
  });
});

// ==================== formatTime ====================

describe('formatTime', () => {
  it('formats 12 AM as 00:00', () => {
    expect(formatTime('AM', 12, 0)).toBe('00:00');
  });

  it('formats 9 AM as 09:00', () => {
    expect(formatTime('AM', 9, 0)).toBe('09:00');
  });

  it('formats 12 PM as 12:00', () => {
    expect(formatTime('PM', 12, 0)).toBe('12:00');
  });

  it('formats 2 PM as 14:00', () => {
    expect(formatTime('PM', 2, 0)).toBe('14:00');
  });

  it('formats 11:30 PM as 23:30', () => {
    expect(formatTime('PM', 11, 30)).toBe('23:30');
  });

  it('formats minutes with padding', () => {
    expect(formatTime('AM', 9, 5)).toBe('09:05');
  });
});

// ==================== parseTime + formatTime roundtrip ====================

describe('parseTime + formatTime roundtrip', () => {
  const testCases = ['00:00', '06:30', '12:00', '15:45', '23:59'];

  testCases.forEach((time) => {
    it(`roundtrips ${time}`, () => {
      const parsed = parseTime(time);
      const formatted = formatTime(parsed.period, parsed.hour, parsed.minute);
      expect(formatted).toBe(time);
    });
  });
});

// ==================== getLocalDateString ====================

describe('getLocalDateString', () => {
  it('returns YYYY-MM-DD format', () => {
    const date = new Date(2024, 0, 15); // Jan 15, 2024
    expect(getLocalDateString(date)).toBe('2024-01-15');
  });

  it('pads single-digit month and day', () => {
    const date = new Date(2024, 2, 5); // Mar 5, 2024
    expect(getLocalDateString(date)).toBe('2024-03-05');
  });

  it('handles end of year', () => {
    const date = new Date(2024, 11, 31); // Dec 31, 2024
    expect(getLocalDateString(date)).toBe('2024-12-31');
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
});

// ==================== compareEventTime ====================

describe('compareEventTime', () => {
  const makeEvent = (time?: string): CalendarEvent => ({
    id: '1',
    title: 'Test',
    date: '2024-01-01',
    time,
  });

  it('returns 0 when both have no time', () => {
    expect(compareEventTime(makeEvent(), makeEvent())).toBe(0);
  });

  it('returns 1 when first has no time', () => {
    expect(compareEventTime(makeEvent(), makeEvent('09:00'))).toBe(1);
  });

  it('returns -1 when second has no time', () => {
    expect(compareEventTime(makeEvent('09:00'), makeEvent())).toBe(-1);
  });

  it('compares times correctly', () => {
    expect(compareEventTime(makeEvent('09:00'), makeEvent('10:00'))).toBeLessThan(0);
    expect(compareEventTime(makeEvent('10:00'), makeEvent('09:00'))).toBeGreaterThan(0);
    expect(compareEventTime(makeEvent('09:00'), makeEvent('09:00'))).toBe(0);
  });
});

// ==================== isSameDay ====================

describe('isSameDay', () => {
  it('returns false when either is null', () => {
    expect(isSameDay(null, new Date())).toBe(false);
    expect(isSameDay(new Date(), null)).toBe(false);
    expect(isSameDay(null, null)).toBe(false);
  });

  it('returns true for same day', () => {
    const d1 = new Date(2024, 5, 15, 10, 0);
    const d2 = new Date(2024, 5, 15, 22, 30);
    expect(isSameDay(d1, d2)).toBe(true);
  });

  it('returns false for different days', () => {
    const d1 = new Date(2024, 5, 15);
    const d2 = new Date(2024, 5, 16);
    expect(isSameDay(d1, d2)).toBe(false);
  });
});

// ==================== sortEventsByCompletion ====================

describe('sortEventsByCompletion', () => {
  const events: CalendarEvent[] = [
    { id: '1', title: 'Done', date: '2024-01-01', time: '09:00', completed: true },
    { id: '2', title: 'Todo late', date: '2024-01-01', time: '14:00', completed: false },
    { id: '3', title: 'Done early', date: '2024-01-01', time: '08:00', completed: true },
    { id: '4', title: 'Todo early', date: '2024-01-01', time: '10:00', completed: false },
  ];

  it('puts incomplete first, then completed', () => {
    const sorted = sortEventsByCompletion(events);
    expect(sorted[0].completed).toBe(false);
    expect(sorted[1].completed).toBe(false);
    expect(sorted[2].completed).toBe(true);
    expect(sorted[3].completed).toBe(true);
  });

  it('sorts each group by time', () => {
    const sorted = sortEventsByCompletion(events);
    // Incomplete: 10:00, 14:00
    expect(sorted[0].time).toBe('10:00');
    expect(sorted[1].time).toBe('14:00');
    // Completed: 08:00, 09:00
    expect(sorted[2].time).toBe('08:00');
    expect(sorted[3].time).toBe('09:00');
  });
});

// ==================== isDateInRepeatSchedule ====================

describe('isDateInRepeatSchedule', () => {
  const baseEvent: CalendarEvent = {
    id: '1',
    title: 'Test',
    date: '2024-01-15',
  };

  it('returns true for exact date match (no repeat)', () => {
    expect(isDateInRepeatSchedule('2024-01-15', baseEvent)).toBe(true);
  });

  it('returns false for non-matching date (no repeat)', () => {
    expect(isDateInRepeatSchedule('2024-01-16', baseEvent)).toBe(false);
  });

  it('returns false for date before start', () => {
    const event = { ...baseEvent, repeat: { type: 'daily' as const, interval: 1 } };
    expect(isDateInRepeatSchedule('2024-01-14', event)).toBe(false);
  });

  describe('daily repeat', () => {
    const event = { ...baseEvent, repeat: { type: 'daily' as const, interval: 2 } };

    it('matches every 2 days', () => {
      expect(isDateInRepeatSchedule('2024-01-15', event)).toBe(true); // start
      expect(isDateInRepeatSchedule('2024-01-16', event)).toBe(false);
      expect(isDateInRepeatSchedule('2024-01-17', event)).toBe(true);
      expect(isDateInRepeatSchedule('2024-01-19', event)).toBe(true);
    });
  });

  describe('weekly repeat', () => {
    const event = { ...baseEvent, repeat: { type: 'weekly' as const, interval: 1 } };

    it('matches every week', () => {
      expect(isDateInRepeatSchedule('2024-01-15', event)).toBe(true);
      expect(isDateInRepeatSchedule('2024-01-22', event)).toBe(true);
      expect(isDateInRepeatSchedule('2024-01-16', event)).toBe(false);
    });
  });

  describe('monthly repeat', () => {
    const event = { ...baseEvent, repeat: { type: 'monthly' as const, interval: 1 } };

    it('matches same day each month', () => {
      expect(isDateInRepeatSchedule('2024-01-15', event)).toBe(true);
      expect(isDateInRepeatSchedule('2024-02-15', event)).toBe(true);
      expect(isDateInRepeatSchedule('2024-02-16', event)).toBe(false);
    });
  });

  describe('yearly repeat', () => {
    const event = { ...baseEvent, repeat: { type: 'yearly' as const, interval: 1 } };

    it('matches same date each year', () => {
      expect(isDateInRepeatSchedule('2024-01-15', event)).toBe(true);
      expect(isDateInRepeatSchedule('2025-01-15', event)).toBe(true);
      expect(isDateInRepeatSchedule('2025-01-16', event)).toBe(false);
    });
  });

  describe('with endDate', () => {
    const event = {
      ...baseEvent,
      repeat: { type: 'daily' as const, interval: 1, endDate: '2024-01-20' },
    };

    it('returns false after endDate', () => {
      expect(isDateInRepeatSchedule('2024-01-20', event)).toBe(true);
      expect(isDateInRepeatSchedule('2024-01-21', event)).toBe(false);
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

  it('preserves other properties', () => {
    const instance = createRepeatInstance(event, '2024-01-22');
    expect(instance.title).toBe('Weekly Meeting');
    expect(instance.time).toBe('10:00');
  });
});

// ==================== getEventsForDateString ====================

describe('getEventsForDateString', () => {
  const events: CalendarEvent[] = [
    { id: '1', title: 'Normal Event', date: '2024-01-15' },
    { id: '2', title: 'Different Day', date: '2024-01-16' },
    { id: '3', title: 'Weekly', date: '2024-01-08', repeat: { type: 'weekly', interval: 1 } },
  ];

  it('returns normal events matching date', () => {
    const result = getEventsForDateString('2024-01-15', events);
    expect(result.find(e => e.id === '1')).toBeDefined();
    expect(result.find(e => e.id === '2')).toBeUndefined();
  });

  it('returns repeat instances for matching dates', () => {
    const result = getEventsForDateString('2024-01-15', events);
    // Weekly from Jan 8 should appear on Jan 15
    const weeklyInstance = result.find(e => e.repeatGroupId === '3');
    expect(weeklyInstance).toBeDefined();
    expect(weeklyInstance?.isRepeatInstance).toBe(true);
  });

  it('returns original event on start date (not instance)', () => {
    const result = getEventsForDateString('2024-01-08', events);
    const weekly = result.find(e => e.id === '3');
    expect(weekly).toBeDefined();
    expect(weekly?.isRepeatInstance).toBeUndefined();
  });
});

// ==================== getDDay ====================

describe('getDDay', () => {
  let originalDate: DateConstructor;

  beforeEach(() => {
    // Mock Date to control "today"
    originalDate = global.Date;
    const mockDate = new Date(2024, 5, 15); // June 15, 2024
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns D-Day for today', () => {
    expect(getDDay('2024-06-15')).toBe('D-Day');
  });

  it('returns D-N for future dates', () => {
    expect(getDDay('2024-06-16')).toBe('D-1');
    expect(getDDay('2024-06-25')).toBe('D-10');
  });

  it('returns D+N for past dates', () => {
    expect(getDDay('2024-06-14')).toBe('D+1');
    expect(getDDay('2024-06-05')).toBe('D+10');
  });
});

// ==================== getTodayString ====================

describe('getTodayString', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 5, 15)); // June 15, 2024
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns today in YYYY-MM-DD format', () => {
    expect(getTodayString()).toBe('2024-06-15');
  });
});
