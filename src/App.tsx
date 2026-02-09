import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence } from 'motion/react';
import { Calendar } from './components/Calendar';
import { getLocalDateString } from './utils/date';
import { EventModal } from './components/Event';
import { SettingsPanel } from './components/Settings';
import { SchedulePanel } from './components/SchedulePanel';
import { TitleBar } from './components/TitleBar';
import { ResizeHandle } from './components/ResizeHandle';
import { useEvents } from './hooks/useEvents';
import { useSettings } from './hooks/useSettings';
import { useDesktopMouseEvents } from './hooks/useDesktopMouseEvents';
import { useCloudSync } from './hooks/useCloudSync';
import { useAuth } from './contexts/AuthContext';
import type { CalendarEvent } from './types';
import './App.css';

function App() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [showSettings, setShowSettings] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showSchedulePanel, setShowSchedulePanel] = useState(true);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>();

  const {
    events,
    addEvent,
    updateEvent,
    deleteEvent,
    getEventsForDate,
    refreshEvents,
    mergeFromCloud,
    syncWithGoogle,
    googleConnected,
    setGoogleConnected,
    loading: eventsLoading,
    toggleRepeatInstanceComplete,
    deletedEventIds,
    clearDeletedEventIds,
    restoreDeletedEvents,
  } = useEvents();

  const { settings, updateSettings, loading: settingsLoading } = useSettings();

  // Cloud Sync (Premium 전용)
  const { isAuthenticated } = useAuth();
  const {
    syncAll,
    fetchFromCloud,
    isSyncing: isCloudSyncing,
    startAutoSync,
    stopAutoSync,
  } = useCloudSync();

  // 이전 events 상태를 추적하여 변경 감지
  const prevEventsRef = useRef<CalendarEvent[]>([]);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Desktop Mode 마우스 이벤트 핸들링
  useDesktopMouseEvents();

  // Cloud Sync: Premium 유저 로그인 시 서버 데이터 가져오기 + 자동 동기화 시작
  const initialSyncDoneRef = useRef(false);
  useEffect(() => {
    if (isAuthenticated && !eventsLoading) {
      // 앱 시작 시 서버에서 데이터 가져와서 병합 (최초 1회)
      if (!initialSyncDoneRef.current) {
        initialSyncDoneRef.current = true;
        fetchFromCloud().then(result => {
          if (result.success && result.events) {
            mergeFromCloud(result.events);
          }
        });
      }
      startAutoSync();
    } else if (!isAuthenticated) {
      initialSyncDoneRef.current = false;
      stopAutoSync();
    }
    return () => stopAutoSync();
  }, [isAuthenticated, eventsLoading, fetchFromCloud, mergeFromCloud, startAutoSync, stopAutoSync]);

  // Cloud Sync: 이벤트 변경 시 서버에 동기화 (debounce 3초)
  // deletedEventIds를 ref로 추적 (closure 문제 해결)
  const deletedEventIdsRef = useRef<string[]>([]);
  deletedEventIdsRef.current = deletedEventIds;

  useEffect(() => {
    // 초기 로딩 시에는 스킵
    if (eventsLoading || events.length === 0 && prevEventsRef.current.length === 0) {
      prevEventsRef.current = events;
      return;
    }

    // 이벤트가 실제로 변경되었는지 확인
    const eventsChanged = JSON.stringify(events) !== JSON.stringify(prevEventsRef.current);
    if (!eventsChanged) return;

    prevEventsRef.current = events;

    // 이전 타이머 취소
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // 3초 후 동기화 (debounce)
    syncTimeoutRef.current = setTimeout(async () => {
      if (!isAuthenticated) return;

      // 메모 가져오기
      const memos = window.electronAPI?.getMemos
        ? await window.electronAPI.getMemos()
        : [];

      // 삭제된 이벤트를 deleted: true 플래그와 함께 추가 (ref에서 최신값 가져오기)
      const currentDeletedIds = deletedEventIdsRef.current;
      const deletedEvents = currentDeletedIds.map(id => ({ id, title: '', date: '', deleted: true }));
      const eventsWithDeleted = [
        ...events,
        ...deletedEvents,
      ];

      console.log('[App.tsx] Sync - deletedEventIds:', currentDeletedIds);
      console.log('[App.tsx] Sync - deletedEvents to send:', deletedEvents);
      console.log('[App.tsx] Sync - total events:', eventsWithDeleted.length, '(normal:', events.length, ', deleted:', deletedEvents.length, ')');

      const result = await syncAll({ events: eventsWithDeleted, memos, settings });
      console.log('[App.tsx] Sync result:', result);
      if (result.success) {
        console.log('[App.tsx] Clearing deletedEventIds');
        clearDeletedEventIds();
      } else if (result.clientRateLimited) {
        // 클라이언트 rate limit에 걸린 경우: 삭제 원복 + 알림
        console.log('[App.tsx] Client rate limited - restoring deleted events');
        await restoreDeletedEvents();
        alert('Too many requests. Please slow down.');
      }
    }, 3000);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [events, eventsLoading, isAuthenticated, syncAll, settings, clearDeletedEventIds, restoreDeletedEvents]);

  // 메모 팝업 열기
  const handleOpenMemo = useCallback((id?: string) => {
    window.electronAPI?.openMemo?.(id);
  }, []);

  // 팝업에서 이벤트 변경 시 새로고침
  useEffect(() => {
    window.electronAPI?.onEventsUpdated?.(() => refreshEvents());
  }, [refreshEvents]);

  // 날짜 선택 + 패널 토글
  const handleSelectDate = useCallback((date: Date) => {
    const isSameDate = selectedDate && date.toDateString() === selectedDate.toDateString();

    if (isSameDate && showSchedulePanel) {
      setShowSchedulePanel(false);
    } else {
      setSelectedDate(date);
      setShowSchedulePanel(true);
    }
  }, [selectedDate, showSchedulePanel]);

  // 더블 클릭: 팝업 열기 (항상 Electron 팝업 사용)
  const handleOpenDate = useCallback((date: Date, clickEvent: React.MouseEvent) => {
    setSelectedDate(date);

    if (window.electronAPI?.openPopup) {
      window.electronAPI.openPopup({
        type: 'add-event',
        date: getLocalDateString(date),
        x: clickEvent.screenX,
        y: clickEvent.screenY,
      });
    } else {
      // Fallback: 웹 환경에서만 모달 사용
      setEditingEvent(undefined);
      setShowEventModal(true);
    }
  }, []);

  // 이벤트 편집 (항상 Electron 팝업 사용)
  const handleEditEvent = useCallback((event: CalendarEvent) => {
    if (window.electronAPI?.openPopup) {
      window.electronAPI.openPopup({
        type: 'edit-event',
        date: event.date,
        event,
        x: 100,
        y: 100,
      });
    } else {
      // Fallback: 웹 환경에서만 모달 사용
      setEditingEvent(event);
      setShowEventModal(true);
    }
  }, []);

  // 캘린더에서 이벤트 클릭 (항상 Electron 팝업 사용)
  const handleEventClick = useCallback((event: CalendarEvent, clickEvent: React.MouseEvent) => {
    if (window.electronAPI?.openPopup) {
      window.electronAPI.openPopup({
        type: 'edit-event',
        date: event.date,
        event,
        x: clickEvent.screenX,
        y: clickEvent.screenY,
      });
    } else {
      // Fallback: 웹 환경에서만 모달 사용
      setEditingEvent(event);
      setShowEventModal(true);
    }
  }, []);

  // 완료 토글
  const handleToggleComplete = useCallback((id: string, instanceDate?: string) => {
    // 반복 인스턴스인 경우 (id에 _가 포함되어 있고 google_로 시작하지 않음)
    if (id.includes('_') && !id.startsWith('google_')) {
      const [originalId, date] = id.split('_');
      const originalEvent = events.find(e => e.id === originalId);
      if (originalEvent) {
        // 현재 완료 상태를 getEventsForDate로 확인 (인스턴스 상태 반영됨)
        const dateObj = new Date(date + 'T12:00:00');
        const eventsForDate = getEventsForDate(dateObj);
        const instanceEvent = eventsForDate.find(e =>
          e.id === id || (e.repeatGroupId === originalId && e.date === date)
        );
        const currentCompleted = instanceEvent?.completed ?? originalEvent.completed ?? false;
        toggleRepeatInstanceComplete(originalId, date, !currentCompleted);
      }
      return;
    }

    // 일반 이벤트 또는 반복 원본
    const event = events.find(e => e.id === id);
    if (event) {
      // 반복 일정의 원본인 경우에도 해당 날짜의 인스턴스 상태만 변경
      if (event.repeat && event.repeat.type !== 'none' && instanceDate) {
        const dateObj = new Date(instanceDate + 'T12:00:00');
        const eventsForDate = getEventsForDate(dateObj);
        const instanceEvent = eventsForDate.find(e => e.id === id || e.repeatGroupId === id);
        const currentCompleted = instanceEvent?.completed ?? event.completed ?? false;
        toggleRepeatInstanceComplete(id, instanceDate, !currentCompleted);
      } else {
        updateEvent(id, { completed: !event.completed });
      }
    }
  }, [events, updateEvent, toggleRepeatInstanceComplete, getEventsForDate]);

  // 모달 닫기
  const closeEventModal = useCallback(() => {
    setShowEventModal(false);
    setEditingEvent(undefined);
  }, []);

  // 설정 닫기
  const closeSettings = useCallback(() => setShowSettings(false), []);

  // 설정 열기
  const openSettings = useCallback(() => setShowSettings(true), []);

  // 패널 닫기
  const closePanel = useCallback(() => setShowSchedulePanel(false), []);

  if (eventsLoading || settingsLoading) {
    return (
      <div className={`app ${settings.theme} ${settings.accentColor}`} style={{ fontSize: settings.fontSize }}>
        <TitleBar onSettings={openSettings} />
        <div className="app-content loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className={`app ${settings.theme} ${settings.accentColor}`} style={{ fontSize: settings.fontSize }}>
      <TitleBar
        onSettings={openSettings}
        resizeMode={settings.resizeMode}
        onSync={syncWithGoogle}
        googleConnected={googleConnected}
        onMemo={handleOpenMemo}
        showMemoButton={true}
        isCloudSyncing={isCloudSyncing}
      />

      <div className={`app-content ${settings.schedulePanelPosition === 'left' ? 'panel-left' : ''}`}>
        {/* 사이드 패널 - 왼쪽 */}
        {settings.schedulePanelPosition === 'left' && (
          <AnimatePresence>
            {showSchedulePanel && (
              <SchedulePanel
                selectedDate={selectedDate}
                events={events}
                getEventsForDate={getEventsForDate}
                onAddEvent={addEvent}
                onEditEvent={handleEditEvent}
                onDeleteEvent={deleteEvent}
                onToggleComplete={handleToggleComplete}
                onClose={closePanel}
                position="left"
                showOverdueTasks={settings.showOverdueTasks}
              />
            )}
          </AnimatePresence>
        )}

        <div className={`app-main ${showSchedulePanel ? 'with-panel' : ''}`}>
          <Calendar
            events={events}
            getEventsForDate={getEventsForDate}
            onSelectDate={handleSelectDate}
            onOpenDate={handleOpenDate}
            onEventClick={handleEventClick}
            selectedDate={selectedDate}
            showEventDetails={!showSchedulePanel || !settings.showEventDots}
            showHolidays={settings.showHolidays}
            showAdjacentMonths={settings.showAdjacentMonths}
            showGridLines={settings.showGridLines}
            hiddenDays={settings.hiddenDays}
            weekStartDay={settings.weekStartDay}
          />
        </div>

        {/* 사이드 패널 - 오른쪽 */}
        {settings.schedulePanelPosition === 'right' && (
          <AnimatePresence>
            {showSchedulePanel && (
              <SchedulePanel
                selectedDate={selectedDate}
                events={events}
                getEventsForDate={getEventsForDate}
                onAddEvent={addEvent}
                onEditEvent={handleEditEvent}
                onDeleteEvent={deleteEvent}
                onToggleComplete={handleToggleComplete}
                onClose={closePanel}
                position="right"
                showOverdueTasks={settings.showOverdueTasks}
              />
            )}
          </AnimatePresence>
        )}
      </div>

      {/* 리사이즈 핸들 */}
      <ResizeHandle direction="nw" visible={settings.resizeMode} />
      <ResizeHandle direction="ne" visible={settings.resizeMode} />
      <ResizeHandle direction="sw" visible={settings.resizeMode} />
      <ResizeHandle direction="se" visible={settings.resizeMode} />
      <ResizeHandle direction="n" visible={settings.resizeMode} />
      <ResizeHandle direction="s" visible={settings.resizeMode} />
      <ResizeHandle direction="w" visible={settings.resizeMode} />
      <ResizeHandle direction="e" visible={settings.resizeMode} />

      {showEventModal && selectedDate && (
        <EventModal
          date={selectedDate}
          event={editingEvent}
          onSave={addEvent}
          onUpdate={updateEvent}
          onDelete={deleteEvent}
          onClose={closeEventModal}
          googleConnected={googleConnected}
          accentColor={settings.accentColor}
        />
      )}

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onUpdateSettings={updateSettings}
          onClose={closeSettings}
          onGoogleSync={syncWithGoogle}
          googleConnected={googleConnected}
          onGoogleConnectionChange={setGoogleConnected}
        />
      )}
    </div>
  );
}

export default App;
