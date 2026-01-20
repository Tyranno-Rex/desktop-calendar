import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import type { CalendarEvent } from '../types';

export function useEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
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

  const refreshEvents = useCallback(async () => {
    await loadEvents();
  }, [loadEvents]);

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

  const addEvent = useCallback(async (event: Omit<CalendarEvent, 'id'>) => {
    const newEvent: CalendarEvent = {
      ...event,
      id: uuidv4(),
    };
    const newEvents = [...events, newEvent];
    setEvents(newEvents);
    await saveEvents(newEvents);
    return newEvent;
  }, [events, saveEvents]);

  const updateEvent = useCallback(async (id: string, updates: Partial<CalendarEvent>) => {
    const newEvents = events.map((event) =>
      event.id === id ? { ...event, ...updates } : event
    );
    setEvents(newEvents);
    await saveEvents(newEvents);
  }, [events, saveEvents]);

  const deleteEvent = useCallback(async (id: string) => {
    const newEvents = events.filter((event) => event.id !== id);
    setEvents(newEvents);
    await saveEvents(newEvents);
  }, [events, saveEvents]);

  const getEventsForDate = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return events.filter((event) => event.date === dateStr);
  }, [events]);

  const hasEventsOnDate = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
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
  };
}
