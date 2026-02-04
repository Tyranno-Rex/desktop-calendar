import { useState, useEffect, useCallback } from 'react';
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
    syncWithGoogle,
    googleConnected,
    setGoogleConnected,
    loading: eventsLoading
  } = useEvents();

  const { settings, updateSettings, loading: settingsLoading } = useSettings();

  // Desktop Mode 마우스 이벤트 핸들링
  useDesktopMouseEvents();

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
  const handleToggleComplete = useCallback((id: string) => {
    const event = events.find(e => e.id === id);
    if (event) {
      updateEvent(id, { completed: !event.completed });
    }
  }, [events, updateEvent]);

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
      />

      <div className={`app-content ${settings.schedulePanelPosition === 'left' ? 'panel-left' : ''}`}>
        {/* 사이드 패널 - 왼쪽 */}
        {settings.schedulePanelPosition === 'left' && (
          <AnimatePresence>
            {showSchedulePanel && (
              <SchedulePanel
                selectedDate={selectedDate}
                events={events}
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
