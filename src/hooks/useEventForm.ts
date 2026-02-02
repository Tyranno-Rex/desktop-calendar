import { useState, useEffect, useRef, useCallback } from 'react';
import type { CalendarEvent, RepeatConfig, RepeatType, ReminderConfig } from '../types';
import { parseTime, formatTime } from '../utils/date';

export interface EventFormState {
  title: string;
  time: string;
  description: string;
  repeatType: RepeatType;
  repeatInterval: number;
  repeatEndDate: string;
  reminderMinutes: number;
  isDDay: boolean;
  syncToGoogle: boolean;
  selectedPeriod: 'AM' | 'PM';
  selectedHour: number;
  selectedMinute: number;
  openDropdown: 'period' | 'hour' | 'minute' | null;
  showRepeatDropdown: boolean;
  showReminderDropdown: boolean;
}

export interface EventFormActions {
  setTitle: (title: string) => void;
  setTime: (time: string) => void;
  setDescription: (description: string) => void;
  setRepeatType: (type: RepeatType) => void;
  setRepeatInterval: (interval: number) => void;
  setRepeatEndDate: (date: string) => void;
  setReminderMinutes: (minutes: number) => void;
  setIsDDay: (isDDay: boolean) => void;
  setSyncToGoogle: (sync: boolean) => void;
  setOpenDropdown: (dropdown: 'period' | 'hour' | 'minute' | null) => void;
  setShowRepeatDropdown: (show: boolean) => void;
  setShowReminderDropdown: (show: boolean) => void;
  handlePeriodSelect: (period: 'AM' | 'PM') => void;
  handleHourSelect: (hour: number) => void;
  handleMinuteSelect: (minute: number) => void;
  handleClearTime: () => void;
  resetForm: () => void;
  loadFromEvent: (event: CalendarEvent) => void;
  buildRepeatConfig: () => RepeatConfig | undefined;
  buildReminderConfig: () => ReminderConfig | undefined;
}

export interface EventFormRefs {
  timePickerRef: React.RefObject<HTMLDivElement | null>;
  repeatPickerRef: React.RefObject<HTMLDivElement | null>;
  reminderPickerRef: React.RefObject<HTMLDivElement | null>;
}

interface UseEventFormOptions {
  initialEvent?: CalendarEvent;
}

export function useEventForm(options: UseEventFormOptions = {}): {
  state: EventFormState;
  actions: EventFormActions;
  refs: EventFormRefs;
} {
  const { initialEvent } = options;

  // Form state
  const [title, setTitle] = useState(initialEvent?.title || '');
  const [time, setTime] = useState(initialEvent?.time || '');
  const [description, setDescription] = useState(initialEvent?.description || '');
  const [repeatType, setRepeatType] = useState<RepeatType>(initialEvent?.repeat?.type || 'none');
  const [repeatInterval, setRepeatInterval] = useState(initialEvent?.repeat?.interval || 1);
  const [repeatEndDate, setRepeatEndDate] = useState(initialEvent?.repeat?.endDate || '');
  const [reminderMinutes, setReminderMinutes] = useState<number>(
    initialEvent?.reminder?.enabled ? initialEvent.reminder.minutesBefore : 0
  );
  const [isDDay, setIsDDay] = useState(initialEvent?.isDDay || false);
  const [syncToGoogle, setSyncToGoogle] = useState(false);

  // Time picker state
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('AM');
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [openDropdown, setOpenDropdown] = useState<'period' | 'hour' | 'minute' | null>(null);

  // Dropdown visibility
  const [showRepeatDropdown, setShowRepeatDropdown] = useState(false);
  const [showReminderDropdown, setShowReminderDropdown] = useState(false);

  // Refs
  const timePickerRef = useRef<HTMLDivElement>(null);
  const repeatPickerRef = useRef<HTMLDivElement>(null);
  const reminderPickerRef = useRef<HTMLDivElement>(null);

  // Sync time state when time changes
  useEffect(() => {
    if (time) {
      const parsed = parseTime(time);
      setSelectedPeriod(parsed.period as 'AM' | 'PM');
      setSelectedHour(parsed.hour);
      setSelectedMinute(parsed.minute);
    }
  }, [time]);

  // Outside click detection
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (timePickerRef.current && !timePickerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
      if (repeatPickerRef.current && !repeatPickerRef.current.contains(e.target as Node)) {
        setShowRepeatDropdown(false);
      }
      if (reminderPickerRef.current && !reminderPickerRef.current.contains(e.target as Node)) {
        setShowReminderDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Time selection handlers
  const handlePeriodSelect = useCallback((period: 'AM' | 'PM') => {
    setSelectedPeriod(period);
    setTime(formatTime(period, selectedHour, selectedMinute));
    setOpenDropdown(null);
  }, [selectedHour, selectedMinute]);

  const handleHourSelect = useCallback((hour: number) => {
    setSelectedHour(hour);
    setTime(formatTime(selectedPeriod, hour, selectedMinute));
    setOpenDropdown(null);
  }, [selectedPeriod, selectedMinute]);

  const handleMinuteSelect = useCallback((minute: number) => {
    setSelectedMinute(minute);
    setTime(formatTime(selectedPeriod, selectedHour, minute));
    setOpenDropdown(null);
  }, [selectedPeriod, selectedHour]);

  const handleClearTime = useCallback(() => {
    setTime('');
    setOpenDropdown(null);
  }, []);

  // Reset form
  const resetForm = useCallback(() => {
    setTitle('');
    setTime('');
    setDescription('');
    setRepeatType('none');
    setRepeatInterval(1);
    setRepeatEndDate('');
    setReminderMinutes(0);
    setIsDDay(false);
    setSyncToGoogle(false);
    setSelectedPeriod('AM');
    setSelectedHour(12);
    setSelectedMinute(0);
    setOpenDropdown(null);
    setShowRepeatDropdown(false);
    setShowReminderDropdown(false);
  }, []);

  // Load from event
  const loadFromEvent = useCallback((event: CalendarEvent) => {
    setTitle(event.title || '');
    setTime(event.time || '');
    setDescription(event.description || '');
    if (event.repeat) {
      setRepeatType(event.repeat.type);
      setRepeatInterval(event.repeat.interval || 1);
      setRepeatEndDate(event.repeat.endDate || '');
    } else {
      setRepeatType('none');
      setRepeatInterval(1);
      setRepeatEndDate('');
    }
    if (event.reminder?.enabled) {
      setReminderMinutes(event.reminder.minutesBefore);
    } else {
      setReminderMinutes(0);
    }
    setIsDDay(event.isDDay || false);
  }, []);

  // Build config objects
  const buildRepeatConfig = useCallback((): RepeatConfig | undefined => {
    if (repeatType === 'none') return undefined;
    return {
      type: repeatType,
      interval: repeatInterval,
      endDate: repeatEndDate || undefined,
    };
  }, [repeatType, repeatInterval, repeatEndDate]);

  const buildReminderConfig = useCallback((): ReminderConfig | undefined => {
    if (reminderMinutes <= 0) return undefined;
    return {
      enabled: true,
      minutesBefore: reminderMinutes,
    };
  }, [reminderMinutes]);

  return {
    state: {
      title,
      time,
      description,
      repeatType,
      repeatInterval,
      repeatEndDate,
      reminderMinutes,
      isDDay,
      syncToGoogle,
      selectedPeriod,
      selectedHour,
      selectedMinute,
      openDropdown,
      showRepeatDropdown,
      showReminderDropdown,
    },
    actions: {
      setTitle,
      setTime,
      setDescription,
      setRepeatType,
      setRepeatInterval,
      setRepeatEndDate,
      setReminderMinutes,
      setIsDDay,
      setSyncToGoogle,
      setOpenDropdown,
      setShowRepeatDropdown,
      setShowReminderDropdown,
      handlePeriodSelect,
      handleHourSelect,
      handleMinuteSelect,
      handleClearTime,
      resetForm,
      loadFromEvent,
      buildRepeatConfig,
      buildReminderConfig,
    },
    refs: {
      timePickerRef,
      repeatPickerRef,
      reminderPickerRef,
    },
  };
}
