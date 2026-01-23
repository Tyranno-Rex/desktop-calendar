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
import type { CalendarEvent } from './types';
import './App.css';

function App() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [showSettings, setShowSettings] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showSchedulePanel, setShowSchedulePanel] = useState(true);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>();

  const { events, addEvent, updateEvent, deleteEvent, getEventsForDate, refreshEvents, syncWithGoogle, googleConnected, loading: eventsLoading } = useEvents();
  const { settings, updateSettings, loading: settingsLoading } = useSettings();

  // 팝업에서 이벤트가 변경되면 메인 창에서 새로고침
  useEffect(() => {
    if (window.electronAPI?.onEventsUpdated) {
      window.electronAPI.onEventsUpdated(() => {
        refreshEvents();
      });
    }
  }, [refreshEvents]);

  // Desktop Mode: 마우스 이벤트를 받아서 해당 위치의 요소에 이벤트 발생
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    // 클릭 이벤트
    api.onDesktopClick?.((data) => {
      const element = document.elementFromPoint(data.x, data.y);
      if (element) {
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: data.x,
          clientY: data.y,
          screenX: data.screenX,
          screenY: data.screenY
        });
        element.dispatchEvent(clickEvent);
      }
    });

    // mousedown 이벤트
    api.onDesktopMouseDown?.((data) => {
      const element = document.elementFromPoint(data.x, data.y);
      if (element) {
        const mousedownEvent = new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: data.x,
          clientY: data.y,
          screenX: data.screenX,
          screenY: data.screenY
        });
        element.dispatchEvent(mousedownEvent);
      }
    });

    // mousemove 이벤트 (window에 전달)
    api.onDesktopMouseMove?.((data) => {
      const mousemoveEvent = new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: data.x,
        clientY: data.y,
        screenX: data.screenX,
        screenY: data.screenY
      });
      window.dispatchEvent(mousemoveEvent);
    });

    // mouseup 이벤트 (window에 전달)
    api.onDesktopMouseUp?.((data) => {
      const mouseupEvent = new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: data.x,
        clientY: data.y,
        screenX: data.screenX,
        screenY: data.screenY
      });
      window.dispatchEvent(mouseupEvent);
    });

    // 더블클릭 이벤트 (날짜 셀의 data-date 속성으로 날짜 찾기)
    api.onDesktopDblClick?.((data) => {
      const element = document.elementFromPoint(data.x, data.y);
      if (element) {
        // 클릭된 요소 또는 부모에서 data-date 찾기
        const dateCell = element.closest('[data-date]');
        if (dateCell) {
          const dateStr = dateCell.getAttribute('data-date');
          if (dateStr) {
            api.openPopup?.({
              type: 'add-event',
              date: dateStr,
              x: data.screenX,
              y: data.screenY
            });
          }
        }
      }
    });
  }, []);

  // 단일 클릭: 날짜 선택 + 패널 열기
  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(date);
    if (!showSchedulePanel) {
      setShowSchedulePanel(true);
    }
  }, [showSchedulePanel]);

  // 더블 클릭: 팝업/모달 열기
  const handleOpenDate = useCallback((date: Date, clickEvent: React.MouseEvent) => {
    setSelectedDate(date);

    if (settings.desktopMode && window.electronAPI?.openPopup) {
      // Desktop Mode: 별도 팝업 창 열기
      window.electronAPI.openPopup({
        type: 'add-event',
        date: getLocalDateString(date),
        x: clickEvent.screenX,
        y: clickEvent.screenY,
      });
    } else {
      // 일반 모드: EventModal 열기
      setEditingEvent(undefined);
      setShowEventModal(true);
    }
  }, [settings.desktopMode]);

  const handleEditEvent = (event: CalendarEvent) => {
    if (settings.desktopMode && window.electronAPI?.openPopup) {
      window.electronAPI.openPopup({
        type: 'edit-event',
        date: event.date,
        event,
        x: 100,
        y: 100,
      });
    } else {
      setEditingEvent(event);
      setShowEventModal(true);
    }
  };

  // 캘린더에서 이벤트 클릭 시 편집 팝업 열기
  const handleEventClick = useCallback((event: CalendarEvent, clickEvent: React.MouseEvent) => {
    if (settings.desktopMode && window.electronAPI?.openPopup) {
      window.electronAPI.openPopup({
        type: 'edit-event',
        date: event.date,
        event,
        x: clickEvent.screenX,
        y: clickEvent.screenY,
      });
    } else {
      setEditingEvent(event);
      setShowEventModal(true);
    }
  }, [settings.desktopMode]);

  const handleSaveEvent = async (event: Omit<CalendarEvent, 'id'>, syncToGoogle?: boolean) => {
    await addEvent(event, syncToGoogle);
  };

  const handleUpdateEvent = async (id: string, updates: Partial<CalendarEvent>) => {
    await updateEvent(id, updates);
  };

  const handleDeleteEvent = async (id: string) => {
    await deleteEvent(id);
  };

  // 패널에서 일정 추가
  const handlePanelAddEvent = useCallback(async (event: Omit<CalendarEvent, 'id'>) => {
    await addEvent(event);
  }, [addEvent]);

  // 패널에서 일정 삭제
  const handlePanelDeleteEvent = useCallback(async (id: string) => {
    await deleteEvent(id);
  }, [deleteEvent]);

  // 패널에서 일정 완료 토글
  const handleToggleComplete = useCallback(async (id: string) => {
    const event = events.find(e => e.id === id);
    if (event) {
      await updateEvent(id, { completed: !event.completed });
    }
  }, [events, updateEvent]);

  if (eventsLoading || settingsLoading) {
    return (
      <div className={`app ${settings.theme}`} style={{ fontSize: settings.fontSize }}>
        <TitleBar onSettings={() => setShowSettings(true)} />
        <div className="app-content loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className={`app ${settings.theme}`} style={{ fontSize: settings.fontSize }}>
      <TitleBar
        onSettings={() => setShowSettings(true)}
        resizeMode={settings.resizeMode}
        onSync={syncWithGoogle}
        googleConnected={googleConnected}
      />

      <div className={`app-content ${settings.schedulePanelPosition === 'left' ? 'panel-left' : ''}`}>
        {/* 사이드 패널 - 왼쪽일 때 먼저 렌더링 */}
        {settings.schedulePanelPosition === 'left' && (
          <AnimatePresence>
            {showSchedulePanel && (
              <SchedulePanel
                selectedDate={selectedDate}
                events={events}
                onAddEvent={handlePanelAddEvent}
                onEditEvent={handleEditEvent}
                onDeleteEvent={handlePanelDeleteEvent}
                onToggleComplete={handleToggleComplete}
                onClose={() => setShowSchedulePanel(false)}
                position="left"
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
            showEventDetails={!showSchedulePanel}
            showHolidays={settings.showHolidays}
            showAdjacentMonths={settings.showAdjacentMonths}
            hiddenDays={settings.hiddenDays}
          />
        </div>

        {/* 사이드 패널 - 오른쪽일 때 */}
        {settings.schedulePanelPosition === 'right' && (
          <AnimatePresence>
            {showSchedulePanel && (
              <SchedulePanel
                selectedDate={selectedDate}
                events={events}
                onAddEvent={handlePanelAddEvent}
                onEditEvent={handleEditEvent}
                onDeleteEvent={handlePanelDeleteEvent}
                onToggleComplete={handleToggleComplete}
                onClose={() => setShowSchedulePanel(false)}
                position="right"
              />
            )}
          </AnimatePresence>
        )}
      </div>

      {/* 리사이즈 핸들 - 4방향 모서리 */}
      <ResizeHandle direction="nw" visible={settings.resizeMode} />
      <ResizeHandle direction="ne" visible={settings.resizeMode} />
      <ResizeHandle direction="sw" visible={settings.resizeMode} />
      <ResizeHandle direction="se" visible={settings.resizeMode} />
      {/* 리사이즈 핸들 - 4방향 변 */}
      <ResizeHandle direction="n" visible={settings.resizeMode} />
      <ResizeHandle direction="s" visible={settings.resizeMode} />
      <ResizeHandle direction="w" visible={settings.resizeMode} />
      <ResizeHandle direction="e" visible={settings.resizeMode} />

      {showEventModal && selectedDate && (
        <EventModal
          date={selectedDate}
          event={editingEvent}
          onSave={handleSaveEvent}
          onUpdate={handleUpdateEvent}
          onDelete={handleDeleteEvent}
          onClose={() => {
            setShowEventModal(false);
            setEditingEvent(undefined);
          }}
          googleConnected={googleConnected}
        />
      )}

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onUpdateSettings={updateSettings}
          onClose={() => setShowSettings(false)}
          onGoogleSync={syncWithGoogle}
        />
      )}
    </div>
  );
}

export default App;
