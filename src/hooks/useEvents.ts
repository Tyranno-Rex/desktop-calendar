import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { CalendarEvent, RepeatInstanceState } from '../types';
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
  // 반복 인스턴스별 완료 상태
  const [repeatInstanceStates, setRepeatInstanceStates] = useState<RepeatInstanceState[]>([]);
  // 삭제된 이벤트 ID 추적 (클라우드 동기화용)
  const [deletedEventIds, setDeletedEventIds] = useState<string[]>([]);

  // 중복 방지 refs
  const syncInProgressRef = useRef(false);
  const deletingEventsRef = useRef(new Set<string>());
  const updatingEventsRef = useRef(new Set<string>());
  const authCheckInProgressRef = useRef(false);

  // Google 인증 상태 확인 (중복 호출 방지)
  const checkGoogleAuth = useCallback(async () => {
    if (authCheckInProgressRef.current) return;
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
        // 반복 인스턴스 상태 로드
        if (window.electronAPI.getRepeatInstanceStates) {
          const states = await window.electronAPI.getRepeatInstanceStates();
          setRepeatInstanceStates(states);
        }
      } else {
        const savedEvents = localStorage.getItem('calendar-events');
        if (savedEvents) {
          setEvents(JSON.parse(savedEvents));
        }
        // localStorage에서 인스턴스 상태 로드
        const savedStates = localStorage.getItem('repeat-instance-states');
        if (savedStates) {
          setRepeatInstanceStates(JSON.parse(savedStates));
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
    if (syncInProgressRef.current) return;
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

  // 클라우드에서 가져온 이벤트 병합 (서버 데이터 우선)
  const mergeFromCloud = useCallback(async (cloudEvents: CalendarEvent[]) => {
    if (!cloudEvents || cloudEvents.length === 0) return;

    setEvents(prev => {
      // 서버 이벤트 ID 맵
      const cloudEventMap = new Map(cloudEvents.map(e => [e.id, e]));

      // 로컬에만 있는 이벤트 (서버에 없는 것)
      const localOnlyEvents = prev.filter(e => !cloudEventMap.has(e.id));

      // 서버 이벤트 + 로컬 전용 이벤트 병합
      const mergedEvents = [...cloudEvents, ...localOnlyEvents];

      persistEvents(mergedEvents);
      return mergedEvents;
    });
  }, []);

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
    // 반복 인스턴스 처리 (단, 구글 이벤트 ID는 제외 - google_로 시작하는 ID)
    if (id.includes('_') && !id.startsWith('google_')) {
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
    if (updatingEventsRef.current.has(id)) return;
    updatingEventsRef.current.add(id);

    try {
      // 먼저 이벤트 정보를 가져와서 Google 업데이트 필요 여부 확인
      let googleEventId: string | undefined;

      setEvents(prev => {
        const eventToUpdate = prev.find(e => e.id === id);
        if (eventToUpdate?.googleEventId) {
          googleEventId = eventToUpdate.googleEventId;
        }

        const newEvents = prev.map(event =>
          event.id === id ? { ...event, ...updates } : event
        );
        persistEvents(newEvents);
        return newEvents;
      });

      // Google 업데이트는 setEvents 외부에서 비동기로 처리 (completed 제외)
      if (googleEventId && window.electronAPI?.googleCalendarUpdateEvent) {
        const { completed, ...googleUpdates } = updates;
        if (Object.keys(googleUpdates).length > 0) {
          try {
            await window.electronAPI.googleCalendarUpdateEvent(googleEventId, googleUpdates);
          } catch (error) {
            console.error('Failed to update Google event:', error);
          }
        }
      }
    } finally {
      updatingEventsRef.current.delete(id);
    }
  }, []);

  // 반복 인스턴스 완료 상태 토글
  const toggleRepeatInstanceComplete = useCallback(async (eventId: string, instanceDate: string, completed: boolean) => {
    const newState: RepeatInstanceState = { eventId, instanceDate, completed };

    // 상태 업데이트
    setRepeatInstanceStates(prev => {
      const key = `${eventId}_${instanceDate}`;
      const existingIndex = prev.findIndex(s => `${s.eventId}_${s.instanceDate}` === key);

      let newStates: RepeatInstanceState[];
      if (existingIndex >= 0) {
        newStates = [...prev];
        newStates[existingIndex] = newState;
      } else {
        newStates = [...prev, newState];
      }

      // localStorage에도 저장 (electron 없을 때)
      if (!window.electronAPI) {
        localStorage.setItem('repeat-instance-states', JSON.stringify(newStates));
      }

      return newStates;
    });

    // Electron API로 저장
    if (window.electronAPI?.setRepeatInstanceState) {
      await window.electronAPI.setRepeatInstanceState(newState);
    }
  }, []);

  // 반복 인스턴스 완료 상태 조회
  const getRepeatInstanceCompleted = useCallback((eventId: string, instanceDate: string): boolean | undefined => {
    const state = repeatInstanceStates.find(
      s => s.eventId === eventId && s.instanceDate === instanceDate
    );
    return state?.completed;
  }, [repeatInstanceStates]);

  // 이벤트 삭제 (함수형 업데이트로 events 의존성 제거)
  const deleteEvent = useCallback(async (id: string) => {
    console.log('[useEvents] deleteEvent called with id:', id);

    // 반복 인스턴스 ID 처리 (단, 구글 이벤트 ID는 제외)
    const actualId = (id.includes('_') && !id.startsWith('google_'))
      ? id.split('_')[0]
      : id;

    console.log('[useEvents] actualId:', actualId);

    // 중복 삭제 방지
    if (deletingEventsRef.current.has(actualId)) {
      console.log('[useEvents] Duplicate delete prevented for:', actualId);
      return;
    }
    deletingEventsRef.current.add(actualId);

    try {
      // Google 삭제 플래그 (setEvents 콜백이 2번 실행되어도 1회만 삭제)
      let googleDeleteTriggered = false;

      setEvents(prev => {
        const eventToDelete = prev.find(e => e.id === actualId);
        console.log('[useEvents] Event to delete:', eventToDelete);

        // Google 삭제 (첫 번째 실행에서만)
        if (eventToDelete?.googleEventId && !googleDeleteTriggered) {
          googleDeleteTriggered = true;
          window.electronAPI?.googleCalendarDeleteEvent?.(eventToDelete.googleEventId)
            .catch(error => console.error('Failed to delete Google event:', error));
        }

        const newEvents = prev.filter(event => event.id !== actualId);
        console.log('[useEvents] Events after delete:', newEvents.length);
        persistEvents(newEvents);
        return newEvents;
      });

      // 삭제된 이벤트 ID 추적 (클라우드 동기화용)
      console.log('[useEvents] Adding to deletedEventIds:', actualId);
      setDeletedEventIds(prev => {
        const newIds = [...prev, actualId];
        console.log('[useEvents] deletedEventIds now:', newIds);
        return newIds;
      });

      // 반복 인스턴스 상태도 삭제
      if (window.electronAPI?.deleteRepeatInstanceStates) {
        await window.electronAPI.deleteRepeatInstanceStates(actualId);
      }
      setRepeatInstanceStates(prev => prev.filter(s => s.eventId !== actualId));
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
            // 반복 원본의 시작일 - 인스턴스 상태 적용
            const instanceState = repeatInstanceStates.find(
              s => s.eventId === event.id && s.instanceDate === dateStr
            );
            if (instanceState !== undefined) {
              result.push({ ...event, completed: instanceState.completed });
            } else {
              result.push(event);
            }
          } else {
            // 반복 인스턴스 생성 후 상태 적용
            const instance = createRepeatInstance(event, dateStr);
            const instanceState = repeatInstanceStates.find(
              s => s.eventId === event.id && s.instanceDate === dateStr
            );
            if (instanceState !== undefined) {
              instance.completed = instanceState.completed;
            }
            result.push(instance);
          }
        }
      }
    }

    return result;
  }, [events, repeatInstanceStates]);

  // 삭제된 이벤트 ID 초기화 (동기화 완료 후 호출)
  const clearDeletedEventIds = useCallback(() => {
    setDeletedEventIds([]);
  }, []);

  // 삭제된 이벤트 원복 (rate limit 시 호출)
  const restoreDeletedEvents = useCallback(async () => {
    console.log('[useEvents] Restoring deleted events - reloading from storage');
    // 로컬 스토리지에서 이벤트 다시 로드 (삭제 전 상태로 복원)
    await loadEvents();
    // 삭제 추적 초기화
    setDeletedEventIds([]);
  }, [loadEvents]);

  return {
    events,
    loading,
    addEvent,
    updateEvent,
    deleteEvent,
    getEventsForDate,
    refreshEvents,
    mergeFromCloud,
    syncWithGoogle,
    googleConnected,
    setGoogleConnected,
    // 반복 인스턴스 완료 상태 관리
    toggleRepeatInstanceComplete,
    getRepeatInstanceCompleted,
    // 삭제된 이벤트 추적 (클라우드 동기화용)
    deletedEventIds,
    clearDeletedEventIds,
    restoreDeletedEvents,
  };
}
