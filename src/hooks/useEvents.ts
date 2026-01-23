import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { CalendarEvent } from '../types';

// 로컬 날짜를 yyyy-MM-dd 형식으로 변환 (타임존 문제 방지)
const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function useEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [googleConnected, setGoogleConnected] = useState(false);

  useEffect(() => {
    loadEvents();
    checkGoogleAuth();
  }, []);

  // Google 인증 상태 확인
  const checkGoogleAuth = useCallback(async () => {
    if (window.electronAPI?.googleAuthStatus) {
      const isConnected = await window.electronAPI.googleAuthStatus();
      setGoogleConnected(isConnected);
    }
  }, []);

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

  // Google Calendar에서 이벤트 가져와서 병합
  const syncWithGoogle = useCallback(async () => {
    console.log('[syncWithGoogle] Starting sync...');
    if (!window.electronAPI?.googleCalendarGetEvents) {
      console.log('[syncWithGoogle] googleCalendarGetEvents not available');
      return;
    }

    try {
      console.log('[syncWithGoogle] Calling googleCalendarGetEvents...');
      const result = await window.electronAPI.googleCalendarGetEvents();
      console.log('[syncWithGoogle] Result:', result);
      if (result.success && result.events) {
        // 현재 로컬 이벤트 가져오기
        const localEvents = await window.electronAPI.getEvents();

        // Google 이벤트와 로컬 이벤트 병합
        const googleEvents = result.events.map((ge: any) => ({
          id: ge.id,
          title: ge.title,
          date: ge.date,
          time: ge.time,
          description: ge.description,
          googleEventId: ge.googleEventId,
          isGoogleEvent: true,
        }));

        // 로컬 이벤트 중 Google 이벤트가 아닌 것만 유지
        const localOnlyEvents = localEvents.filter(
          (e: CalendarEvent) => !e.googleEventId && !e.isGoogleEvent
        );

        // 병합
        const mergedEvents = [...localOnlyEvents, ...googleEvents];
        console.log('[syncWithGoogle] Merged events:', mergedEvents.length, 'total');
        console.log('[syncWithGoogle] Google events:', googleEvents);
        setEvents(mergedEvents);
        await window.electronAPI.saveEvents(mergedEvents);

        console.log('[syncWithGoogle] Google Calendar synced:', googleEvents.length, 'events');
      } else {
        console.log('[syncWithGoogle] No events or failed:', result);
      }
    } catch (error) {
      console.error('[syncWithGoogle] Failed to sync with Google Calendar:', error);
    }
  }, []);

  const refreshEvents = useCallback(async () => {
    await loadEvents();

    // Google 연결되어 있으면 동기화도 실행
    if (window.electronAPI?.googleAuthStatus) {
      const isConnected = await window.electronAPI.googleAuthStatus();
      if (isConnected) {
        await syncWithGoogle();
      }
    }
  }, [loadEvents, syncWithGoogle]);

  const saveEvents = useCallback(async (newEvents: CalendarEvent[]) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.saveEvents(newEvents);
      } else {
        localStorage.setItem('calendar-events', JSON.stringify(newEvents));
      }
    } catch (error) {
      console.error('Failed to save events:', error);
    }
  }, []);

  const addEvent = useCallback(async (event: Omit<CalendarEvent, 'id'>, syncToGoogle: boolean = false) => {
    const newEvent: CalendarEvent = {
      ...event,
      id: uuidv4(),
    };

    // syncToGoogle이 true이고 Google 연결되어 있으면 Google에도 추가
    if (syncToGoogle && window.electronAPI?.googleCalendarCreateEvent) {
      try {
        const result = await window.electronAPI.googleCalendarCreateEvent({
          title: newEvent.title,
          date: newEvent.date,
          time: newEvent.time,
          description: newEvent.description,
        });

        if (result.success && result.event) {
          // Google에서 생성된 이벤트 정보로 업데이트
          newEvent.googleEventId = result.event.googleEventId;
          newEvent.isGoogleEvent = true;
          console.log('[addEvent] Created Google event:', result.event);
        }
      } catch (error) {
        console.error('Failed to create Google event:', error);
      }
    }

    const newEvents = [...events, newEvent];
    setEvents(newEvents);
    await saveEvents(newEvents);
    return newEvent;
  }, [events, saveEvents]);

  const updateEvent = useCallback(async (id: string, updates: Partial<CalendarEvent>) => {
    const eventToUpdate = events.find(e => e.id === id);

    // Google 이벤트면 Google에도 업데이트
    if (eventToUpdate?.googleEventId && window.electronAPI?.googleCalendarUpdateEvent) {
      try {
        await window.electronAPI.googleCalendarUpdateEvent(
          eventToUpdate.googleEventId,
          updates
        );
      } catch (error) {
        console.error('Failed to update Google event:', error);
      }
    }

    const newEvents = events.map((event) =>
      event.id === id ? { ...event, ...updates } : event
    );
    setEvents(newEvents);
    await saveEvents(newEvents);
  }, [events, saveEvents]);

  const deleteEvent = useCallback(async (id: string) => {
    const eventToDelete = events.find(e => e.id === id);

    // Google 이벤트면 Google에서도 삭제
    if (eventToDelete?.googleEventId && window.electronAPI?.googleCalendarDeleteEvent) {
      try {
        await window.electronAPI.googleCalendarDeleteEvent(eventToDelete.googleEventId);
      } catch (error) {
        console.error('Failed to delete Google event:', error);
      }
    }

    const newEvents = events.filter((event) => event.id !== id);
    setEvents(newEvents);
    await saveEvents(newEvents);
  }, [events, saveEvents]);

  const getEventsForDate = useCallback((date: Date) => {
    const dateStr = getLocalDateString(date);
    return events.filter((event) => event.date === dateStr);
  }, [events]);

  const hasEventsOnDate = useCallback((date: Date) => {
    const dateStr = getLocalDateString(date);
    return events.some((event) => event.date === dateStr);
  }, [events]);

  return {
    events,
    loading,
    addEvent,
    updateEvent,
    deleteEvent,
    getEventsForDate,
    hasEventsOnDate,
    refreshEvents,
    syncWithGoogle,
    googleConnected,
  };
}
