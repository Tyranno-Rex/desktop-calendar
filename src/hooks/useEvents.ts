import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { CalendarEvent } from '../types';
import { getLocalDateString, isDateInRepeatSchedule, createRepeatInstance } from '../utils/date';

// 이벤트 저장 헬퍼 (외부로 분리하여 의존성 제거)
async function persistEvents(events: CalendarEvent[]): Promise<void> {
  try {
    if (window.electronAPI) {
      await window.electronAPI.saveEvents(events);
    } else {
      localStorage.setItem('calendar-events', JSON.stringify(events));
    }
  } catch (error) {
    console.error('Failed to save events:', error);
  }
}

export function useEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [googleConnected, setGoogleConnected] = useState(false);

  // 중복 방지 refs
  const syncInProgressRef = useRef(false);
  const deletingEventsRef = useRef(new Set<string>());
  const updatingEventsRef = useRef(new Set<string>());
  const authCheckInProgressRef = useRef(false);

  // Google 인증 상태 확인 (중복 호출 방지)
  const checkGoogleAuth = useCallback(async () => {
    if (authCheckInProgressRef.current) {
      console.log('Auth check already in progress, skipping...');
      return;
    }
    authCheckInProgressRef.current = true;

    try {
      if (window.electronAPI?.googleAuthStatus) {
        const isConnected = await window.electronAPI.googleAuthStatus();
        setGoogleConnected(isConnected);
      }
    } finally {
      authCheckInProgressRef.current = false;
    }
  }, []);

  // 이벤트 로드
  const loadEvents = useCallback(async () => {
    try {
      if (window.electronAPI) {
        const savedEvents = await window.electronAPI.getEvents();
        setEvents(savedEvents);
      } else {
        const savedEvents = localStorage.getItem('calendar-events');
        if (savedEvents) {
          setEvents(JSON.parse(savedEvents));
        }
      }
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
    checkGoogleAuth();
  }, [loadEvents, checkGoogleAuth]);

  // Google Calendar 동기화
  const syncWithGoogle = useCallback(async () => {
    if (!window.electronAPI?.googleCalendarGetEvents) return;
    if (syncInProgressRef.current) {
      console.log('Sync already in progress, skipping...');
      return;
    }
    syncInProgressRef.current = true;

    try {
      const result = await window.electronAPI.googleCalendarGetEvents();
      if (!result.success || !result.events) return;

      const localEvents = await window.electronAPI.getEvents();

      // 기존 Google 이벤트의 로컬 상태 보존용 맵
      const existingGoogleEventsMap = new Map<string, CalendarEvent>();
      localEvents.forEach((e: CalendarEvent) => {
        if (e.googleEventId || e.isGoogleEvent) {
          existingGoogleEventsMap.set(e.id, e);
        }
      });

      // Google 이벤트 변환 (로컬 상태 보존)
      const googleEvents: CalendarEvent[] = result.events.map((ge) => {
        const existingEvent = existingGoogleEventsMap.get(ge.id);
        return {
          id: ge.id,
          title: ge.title,
          date: ge.date,
          time: ge.time,
          description: ge.description,
          googleEventId: ge.googleEventId,
          isGoogleEvent: true,
          completed: existingEvent?.completed,
        };
      });

      // 로컬 전용 이벤트와 병합
      const localOnlyEvents = localEvents.filter(
        (e: CalendarEvent) => !e.googleEventId && !e.isGoogleEvent
      );
      const mergedEvents = [...localOnlyEvents, ...googleEvents];

      setEvents(mergedEvents);
      await persistEvents(mergedEvents);
    } catch (error) {
      console.error('Failed to sync with Google Calendar:', error);
    } finally {
      syncInProgressRef.current = false;
    }
  }, []);

  // 이벤트 새로고침
  const refreshEvents = useCallback(async () => {
    await loadEvents();
  }, [loadEvents]);

  // 이벤트 추가 (함수형 업데이트로 events 의존성 제거)
  const addEvent = useCallback(async (event: Omit<CalendarEvent, 'id'>, syncToGoogle = false) => {
    const newEvent: CalendarEvent = { ...event, id: uuidv4() };

    // Google 동기화
    if (syncToGoogle && window.electronAPI?.googleCalendarCreateEvent) {
      try {
        const result = await window.electronAPI.googleCalendarCreateEvent({
          title: newEvent.title,
          date: newEvent.date,
          time: newEvent.time,
          description: newEvent.description,
        });
        if (result.success && result.event) {
          newEvent.googleEventId = result.event.googleEventId;
          newEvent.isGoogleEvent = true;
        }
      } catch (error) {
        console.error('Failed to create Google event:', error);
      }
    }

    setEvents(prev => {
      const newEvents = [...prev, newEvent];
      persistEvents(newEvents);
      return newEvents;
    });

    return newEvent;
  }, []);

  // 이벤트 업데이트 (함수형 업데이트로 events 의존성 제거)
  const updateEvent = useCallback(async (id: string, updates: Partial<CalendarEvent>) => {
    // 반복 인스턴스 처리
    if (id.includes('_')) {
      const [originalId, instanceDate] = id.split('_');

      setEvents(prev => {
        const originalEvent = prev.find(e => e.id === originalId);
        if (!originalEvent) return prev;

        const newEvent: CalendarEvent = {
          ...originalEvent,
          ...updates,
          id: uuidv4(),
          date: instanceDate,
          repeat: undefined,
          repeatGroupId: originalId,
          isRepeatInstance: false,
        };

        const newEvents = [...prev, newEvent];
        persistEvents(newEvents);
        return newEvents;
      });
      return;
    }

    // 중복 업데이트 방지
    if (updatingEventsRef.current.has(id)) {
      console.log('Update already in progress for:', id);
      return;
    }
    updatingEventsRef.current.add(id);

    try {
      // Google 업데이트 (completed 제외)
      setEvents(prev => {
        const eventToUpdate = prev.find(e => e.id === id);

        if (eventToUpdate?.googleEventId && window.electronAPI?.googleCalendarUpdateEvent) {
          const { completed, ...googleUpdates } = updates;
          if (Object.keys(googleUpdates).length > 0) {
            window.electronAPI.googleCalendarUpdateEvent(
              eventToUpdate.googleEventId,
              googleUpdates
            ).catch(error => console.error('Failed to update Google event:', error));
          }
        }

        const newEvents = prev.map(event =>
          event.id === id ? { ...event, ...updates } : event
        );
        persistEvents(newEvents);
        return newEvents;
      });
    } finally {
      updatingEventsRef.current.delete(id);
    }
  }, []);

  // 이벤트 삭제 (함수형 업데이트로 events 의존성 제거)
  const deleteEvent = useCallback(async (id: string) => {
    const actualId = id.includes('_') ? id.split('_')[0] : id;

    // 중복 삭제 방지
    if (deletingEventsRef.current.has(actualId)) {
      console.log('Delete already in progress for:', actualId);
      return;
    }
    deletingEventsRef.current.add(actualId);

    try {
      setEvents(prev => {
        const eventToDelete = prev.find(e => e.id === actualId);

        // Google 삭제
        if (eventToDelete?.googleEventId && window.electronAPI?.googleCalendarDeleteEvent) {
          window.electronAPI.googleCalendarDeleteEvent(eventToDelete.googleEventId)
            .catch(error => console.error('Failed to delete Google event:', error));
        }

        const newEvents = prev.filter(event => event.id !== actualId);
        persistEvents(newEvents);
        return newEvents;
      });
    } finally {
      deletingEventsRef.current.delete(actualId);
    }
  }, []);

  // 특정 날짜 이벤트 조회
  const getEventsForDate = useCallback((date: Date) => {
    const dateStr = getLocalDateString(date);
    const result: CalendarEvent[] = [];

    for (const event of events) {
      if (!event.repeat || event.repeat.type === 'none') {
        if (event.date === dateStr) {
          result.push(event);
        }
      } else {
        if (isDateInRepeatSchedule(dateStr, event)) {
          if (event.date === dateStr) {
            result.push(event);
          } else {
            result.push(createRepeatInstance(event, dateStr));
          }
        }
      }
    }

    return result;
  }, [events]);

  return {
    events,
    loading,
    addEvent,
    updateEvent,
    deleteEvent,
    getEventsForDate,
    refreshEvents,
    syncWithGoogle,
    googleConnected,
    setGoogleConnected,
  };
}
