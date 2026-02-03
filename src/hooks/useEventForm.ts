import { useReducer, useEffect, useRef, useMemo } from 'react';
import type { CalendarEvent, RepeatConfig, RepeatType, ReminderConfig } from '../types';
import { parseTime, formatTime } from '../utils/date';

// State interface
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

// Action types
type EventFormAction =
  | { type: 'SET_TITLE'; payload: string }
  | { type: 'SET_TIME'; payload: string }
  | { type: 'SET_DESCRIPTION'; payload: string }
  | { type: 'SET_REPEAT_TYPE'; payload: RepeatType }
  | { type: 'SET_REPEAT_INTERVAL'; payload: number }
  | { type: 'SET_REPEAT_END_DATE'; payload: string }
  | { type: 'SET_REMINDER_MINUTES'; payload: number }
  | { type: 'SET_IS_DDAY'; payload: boolean }
  | { type: 'SET_SYNC_TO_GOOGLE'; payload: boolean }
  | { type: 'SET_SELECTED_PERIOD'; payload: 'AM' | 'PM' }
  | { type: 'SET_SELECTED_HOUR'; payload: number }
  | { type: 'SET_SELECTED_MINUTE'; payload: number }
  | { type: 'SET_OPEN_DROPDOWN'; payload: 'period' | 'hour' | 'minute' | null }
  | { type: 'SET_SHOW_REPEAT_DROPDOWN'; payload: boolean }
  | { type: 'SET_SHOW_REMINDER_DROPDOWN'; payload: boolean }
  | { type: 'RESET_FORM' }
  | { type: 'LOAD_FROM_EVENT'; payload: CalendarEvent }
  | { type: 'SELECT_PERIOD'; payload: { period: 'AM' | 'PM'; hour: number; minute: number } }
  | { type: 'SELECT_HOUR'; payload: { period: 'AM' | 'PM'; hour: number; minute: number } }
  | { type: 'SELECT_MINUTE'; payload: { period: 'AM' | 'PM'; hour: number; minute: number } }
  | { type: 'CLEAR_TIME' }
  | { type: 'SYNC_TIME_STATE'; payload: { period: 'AM' | 'PM'; hour: number; minute: number } };

// Initial state factory
const createInitialState = (event?: CalendarEvent): EventFormState => ({
  title: event?.title || '',
  time: event?.time || '',
  description: event?.description || '',
  repeatType: event?.repeat?.type || 'none',
  repeatInterval: event?.repeat?.interval || 1,
  repeatEndDate: event?.repeat?.endDate || '',
  reminderMinutes: event?.reminder?.enabled ? event.reminder.minutesBefore : 0,
  isDDay: event?.isDDay || false,
  syncToGoogle: false,
  selectedPeriod: 'AM',
  selectedHour: 12,
  selectedMinute: 0,
  openDropdown: null,
  showRepeatDropdown: false,
  showReminderDropdown: false,
});

// Reducer
function eventFormReducer(state: EventFormState, action: EventFormAction): EventFormState {
  switch (action.type) {
    case 'SET_TITLE':
      return { ...state, title: action.payload };
    case 'SET_TIME':
      return { ...state, time: action.payload };
    case 'SET_DESCRIPTION':
      return { ...state, description: action.payload };
    case 'SET_REPEAT_TYPE':
      return { ...state, repeatType: action.payload };
    case 'SET_REPEAT_INTERVAL':
      return { ...state, repeatInterval: action.payload };
    case 'SET_REPEAT_END_DATE':
      return { ...state, repeatEndDate: action.payload };
    case 'SET_REMINDER_MINUTES':
      return { ...state, reminderMinutes: action.payload };
    case 'SET_IS_DDAY':
      return { ...state, isDDay: action.payload };
    case 'SET_SYNC_TO_GOOGLE':
      return { ...state, syncToGoogle: action.payload };
    case 'SET_SELECTED_PERIOD':
      return { ...state, selectedPeriod: action.payload };
    case 'SET_SELECTED_HOUR':
      return { ...state, selectedHour: action.payload };
    case 'SET_SELECTED_MINUTE':
      return { ...state, selectedMinute: action.payload };
    case 'SET_OPEN_DROPDOWN':
      return { ...state, openDropdown: action.payload };
    case 'SET_SHOW_REPEAT_DROPDOWN':
      return { ...state, showRepeatDropdown: action.payload };
    case 'SET_SHOW_REMINDER_DROPDOWN':
      return { ...state, showReminderDropdown: action.payload };
    case 'RESET_FORM':
      return createInitialState();
    case 'LOAD_FROM_EVENT': {
      const event = action.payload;
      return {
        ...state,
        title: event.title || '',
        time: event.time || '',
        description: event.description || '',
        repeatType: event.repeat?.type || 'none',
        repeatInterval: event.repeat?.interval || 1,
        repeatEndDate: event.repeat?.endDate || '',
        reminderMinutes: event.reminder?.enabled ? event.reminder.minutesBefore : 0,
        isDDay: event.isDDay || false,
      };
    }
    case 'SELECT_PERIOD': {
      const { period, hour, minute } = action.payload;
      return {
        ...state,
        selectedPeriod: period,
        time: formatTime(period, hour, minute),
        openDropdown: null,
      };
    }
    case 'SELECT_HOUR': {
      const { period, hour, minute } = action.payload;
      return {
        ...state,
        selectedHour: hour,
        time: formatTime(period, hour, minute),
        openDropdown: null,
      };
    }
    case 'SELECT_MINUTE': {
      const { period, hour, minute } = action.payload;
      return {
        ...state,
        selectedMinute: minute,
        time: formatTime(period, hour, minute),
        openDropdown: null,
      };
    }
    case 'CLEAR_TIME':
      return { ...state, time: '', openDropdown: null };
    case 'SYNC_TIME_STATE':
      return {
        ...state,
        selectedPeriod: action.payload.period,
        selectedHour: action.payload.hour,
        selectedMinute: action.payload.minute,
      };
    default:
      return state;
  }
}

// Actions interface (for external use)
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

  const [state, dispatch] = useReducer(eventFormReducer, initialEvent, createInitialState);

  // Refs
  const timePickerRef = useRef<HTMLDivElement>(null);
  const repeatPickerRef = useRef<HTMLDivElement>(null);
  const reminderPickerRef = useRef<HTMLDivElement>(null);

  // Sync time state when time changes
  useEffect(() => {
    if (state.time) {
      const parsed = parseTime(state.time);
      dispatch({
        type: 'SYNC_TIME_STATE',
        payload: { period: parsed.period as 'AM' | 'PM', hour: parsed.hour, minute: parsed.minute },
      });
    }
  }, [state.time]);

  // Outside click detection
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (timePickerRef.current && !timePickerRef.current.contains(e.target as Node)) {
        dispatch({ type: 'SET_OPEN_DROPDOWN', payload: null });
      }
      if (repeatPickerRef.current && !repeatPickerRef.current.contains(e.target as Node)) {
        dispatch({ type: 'SET_SHOW_REPEAT_DROPDOWN', payload: false });
      }
      if (reminderPickerRef.current && !reminderPickerRef.current.contains(e.target as Node)) {
        dispatch({ type: 'SET_SHOW_REMINDER_DROPDOWN', payload: false });
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Memoized actions
  const actions = useMemo<EventFormActions>(() => ({
    setTitle: (title) => dispatch({ type: 'SET_TITLE', payload: title }),
    setTime: (time) => dispatch({ type: 'SET_TIME', payload: time }),
    setDescription: (desc) => dispatch({ type: 'SET_DESCRIPTION', payload: desc }),
    setRepeatType: (type) => dispatch({ type: 'SET_REPEAT_TYPE', payload: type }),
    setRepeatInterval: (interval) => dispatch({ type: 'SET_REPEAT_INTERVAL', payload: interval }),
    setRepeatEndDate: (date) => dispatch({ type: 'SET_REPEAT_END_DATE', payload: date }),
    setReminderMinutes: (minutes) => dispatch({ type: 'SET_REMINDER_MINUTES', payload: minutes }),
    setIsDDay: (isDDay) => dispatch({ type: 'SET_IS_DDAY', payload: isDDay }),
    setSyncToGoogle: (sync) => dispatch({ type: 'SET_SYNC_TO_GOOGLE', payload: sync }),
    setOpenDropdown: (dropdown) => dispatch({ type: 'SET_OPEN_DROPDOWN', payload: dropdown }),
    setShowRepeatDropdown: (show) => dispatch({ type: 'SET_SHOW_REPEAT_DROPDOWN', payload: show }),
    setShowReminderDropdown: (show) => dispatch({ type: 'SET_SHOW_REMINDER_DROPDOWN', payload: show }),
    handlePeriodSelect: (period) => dispatch({
      type: 'SELECT_PERIOD',
      payload: { period, hour: state.selectedHour, minute: state.selectedMinute },
    }),
    handleHourSelect: (hour) => dispatch({
      type: 'SELECT_HOUR',
      payload: { period: state.selectedPeriod, hour, minute: state.selectedMinute },
    }),
    handleMinuteSelect: (minute) => dispatch({
      type: 'SELECT_MINUTE',
      payload: { period: state.selectedPeriod, hour: state.selectedHour, minute },
    }),
    handleClearTime: () => dispatch({ type: 'CLEAR_TIME' }),
    resetForm: () => dispatch({ type: 'RESET_FORM' }),
    loadFromEvent: (event) => dispatch({ type: 'LOAD_FROM_EVENT', payload: event }),
    buildRepeatConfig: () => {
      if (state.repeatType === 'none') return undefined;
      return {
        type: state.repeatType,
        interval: state.repeatInterval,
        endDate: state.repeatEndDate || undefined,
      };
    },
    buildReminderConfig: () => {
      if (state.reminderMinutes <= 0) return undefined;
      return { enabled: true, minutesBefore: state.reminderMinutes };
    },
  }), [state.selectedHour, state.selectedMinute, state.selectedPeriod, state.repeatType, state.repeatInterval, state.repeatEndDate, state.reminderMinutes]);

  const refs = useMemo<EventFormRefs>(() => ({
    timePickerRef,
    repeatPickerRef,
    reminderPickerRef,
  }), []);

  return { state, actions, refs };
}
