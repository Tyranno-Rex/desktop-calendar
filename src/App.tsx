import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Calendar } from './components/Calendar';
import { EventModal, DayDetailModal } from './components/Event';
import { SettingsPanel } from './components/Settings';
import { TitleBar } from './components/TitleBar';
import { ResizeHandle } from './components/ResizeHandle';
import { useEvents } from './hooks/useEvents';
import { useSettings } from './hooks/useSettings';
import type { CalendarEvent } from './types';
import './App.css';

function App() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showDayDetail, setShowDayDetail] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>();

  const { addEvent, updateEvent, deleteEvent, getEventsForDate, refreshEvents, loading: eventsLoading } = useEvents();
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
  }, []);

  // 단일 클릭: 날짜 선택만
  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  // 더블 클릭: 팝업/모달 열기
  const handleOpenDate = useCallback((date: Date, clickEvent: React.MouseEvent) => {
    setSelectedDate(date);

    if (settings.desktopMode && window.electronAPI?.openPopup) {
      // Desktop Mode: 별도 팝업 창 열기
      const x = clickEvent.screenX;
      const y = clickEvent.screenY;

      window.electronAPI.openPopup({
        type: 'add-event',
        date: format(date, 'yyyy-MM-dd'),
        x,
        y,
      });
    } else {
      // 일반 모드: 기존 모달 사용
      setShowDayDetail(true);
    }
  }, [settings.desktopMode]);

  const handleAddEvent = () => {
    if (settings.desktopMode && window.electronAPI?.openPopup && selectedDate) {
      window.electronAPI.openPopup({
        type: 'add-event',
        date: format(selectedDate, 'yyyy-MM-dd'),
        x: 100,
        y: 100,
      });
      setShowDayDetail(false);
    } else {
      setEditingEvent(undefined);
      setShowDayDetail(false);
      setShowEventModal(true);
    }
  };

  const handleEditEvent = (event: CalendarEvent) => {
    if (settings.desktopMode && window.electronAPI?.openPopup) {
      window.electronAPI.openPopup({
        type: 'edit-event',
        date: event.date,
        event,
        x: 100,
        y: 100,
      });
      setShowDayDetail(false);
    } else {
      setEditingEvent(event);
      setShowDayDetail(false);
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

  const handleSaveEvent = async (event: Omit<CalendarEvent, 'id'>) => {
    await addEvent(event);
  };

  const handleUpdateEvent = async (id: string, updates: Partial<CalendarEvent>) => {
    await updateEvent(id, updates);
  };

  const handleDeleteEvent = async (id: string) => {
    await deleteEvent(id);
  };

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

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
      <TitleBar onSettings={() => setShowSettings(true)} resizeMode={settings.resizeMode} />

      <div className="app-content">
        <Calendar
          getEventsForDate={getEventsForDate}
          onSelectDate={handleSelectDate}
          onOpenDate={handleOpenDate}
          onEventClick={handleEventClick}
          selectedDate={selectedDate}
        />
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

      {/* 날짜 클릭 시 일정 상세 팝업 */}
      {showDayDetail && selectedDate && (
        <DayDetailModal
          date={selectedDate}
          events={selectedDateEvents}
          onAddEvent={handleAddEvent}
          onEditEvent={handleEditEvent}
          onClose={() => setShowDayDetail(false)}
        />
      )}

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
        />
      )}

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onUpdateSettings={updateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
