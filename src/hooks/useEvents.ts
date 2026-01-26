import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { CalendarEvent } from '../types';
import { getLocalDateString, isDateInRepeatSchedule, createRepeatInstance } from '../utils/date';

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
    if (!window.electronAPI?.googleCalendarGetEvents) {
      return;
    }

    try {
      const result = await window.electronAPI.googleCalendarGetEvents();
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
        setEvents(mergedEvents);
        await window.electronAPI.saveEvents(mergedEvents);
      }
    } catch (error) {
      console.error('Failed to sync with Google Calendar:', error);
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
    // 반복 인스턴스인 경우 (id에 날짜가 포함됨)
    if (id.includes('_')) {
      const [originalId, instanceDate] = id.split('_');
      const originalEvent = events.find(e => e.id === originalId);

      if (originalEvent) {
        // 인스턴스를 독립 일정으로 변환
        const newEvent: CalendarEvent = {
          ...originalEvent,
          ...updates,
          id: uuidv4(),
          date: instanceDate,
          repeat: undefined, // 반복 설정 제거
          repeatGroupId: originalId,
          isRepeatInstance: false,
        };

        const newEvents = [...events, newEvent];
        setEvents(newEvents);
        await saveEvents(newEvents);
        return;
      }
    }

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
    // 반복 인스턴스인 경우 - 원본 반복 일정 전체를 삭제할지 확인 필요
    // 현재는 원본 이벤트를 삭제하면 모든 반복이 삭제됨
    const actualId = id.includes('_') ? id.split('_')[0] : id;

    const eventToDelete = events.find(e => e.id === actualId);

    // Google 이벤트면 Google에서도 삭제
    if (eventToDelete?.googleEventId && window.electronAPI?.googleCalendarDeleteEvent) {
      try {
        await window.electronAPI.googleCalendarDeleteEvent(eventToDelete.googleEventId);
      } catch (error) {
        console.error('Failed to delete Google event:', error);
      }
    }

    const newEvents = events.filter((event) => event.id !== actualId);
    setEvents(newEvents);
    await saveEvents(newEvents);
  }, [events, saveEvents]);

  const getEventsForDate = useCallback((date: Date) => {
    const dateStr = getLocalDateString(date);
    const result: CalendarEvent[] = [];

    for (const event of events) {
      // 반복 일정이 아니면 단순 비교
      if (!event.repeat || event.repeat.type === 'none') {
        if (event.date === dateStr) {
          result.push(event);
        }
      } else {
        // 반복 일정이면 해당 날짜가 반복 패턴에 맞는지 확인
        if (isDateInRepeatSchedule(dateStr, event)) {
          // 원본 날짜면 원본 이벤트, 아니면 인스턴스 생성
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
  };
}
