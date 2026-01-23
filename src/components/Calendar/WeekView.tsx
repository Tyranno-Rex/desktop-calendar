import { useMemo, useRef, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import type { CalendarEvent } from '../../types';
import './WeekView.css';

// 시간대 (0시 ~ 23시)
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface WeekViewProps {
  weekDays: Date[];
  events: CalendarEvent[];
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onEventClick?: (event: CalendarEvent, e: React.MouseEvent) => void;
  showHolidays?: boolean;
  hiddenDays?: number[];
}

export function WeekView({
  weekDays,
  events,
  selectedDate,
  onSelectDate,
  onEventClick,
  showHolidays = true,
  hiddenDays = [],
}: WeekViewProps) {
  const weekBodyRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const lastYRef = useRef(0);

  // Desktop Mode 드래그 스크롤 지원
  useEffect(() => {
    const handleDesktopMouseDown = (_e: Event, data: { x: number; y: number }) => {
      if (!weekBodyRef.current) return;
      const rect = weekBodyRef.current.getBoundingClientRect();
      // week-body 영역 내에서만 드래그 스크롤 활성화
      if (data.x >= rect.left && data.x <= rect.right &&
          data.y >= rect.top && data.y <= rect.bottom) {
        isDraggingRef.current = true;
        lastYRef.current = data.y;
      }
    };

    const handleDesktopMouseMove = (_e: Event, data: { x: number; y: number }) => {
      if (!isDraggingRef.current || !weekBodyRef.current) return;
      const deltaY = lastYRef.current - data.y;
      weekBodyRef.current.scrollTop += deltaY;
      lastYRef.current = data.y;
    };

    const handleDesktopMouseUp = () => {
      isDraggingRef.current = false;
    };

    // @ts-expect-error electron IPC
    const { ipcRenderer } = window.electron || {};
    if (ipcRenderer) {
      ipcRenderer.on('desktop-mousedown', handleDesktopMouseDown);
      ipcRenderer.on('desktop-mousemove', handleDesktopMouseMove);
      ipcRenderer.on('desktop-mouseup', handleDesktopMouseUp);

      return () => {
        ipcRenderer.removeListener('desktop-mousedown', handleDesktopMouseDown);
        ipcRenderer.removeListener('desktop-mousemove', handleDesktopMouseMove);
        ipcRenderer.removeListener('desktop-mouseup', handleDesktopMouseUp);
      };
    }
  }, []);

  // 일반 모드 드래그 스크롤 지원
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // 좌클릭만
    isDraggingRef.current = true;
    lastYRef.current = e.clientY;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current || !weekBodyRef.current) return;
    const deltaY = lastYRef.current - e.clientY;
    weekBodyRef.current.scrollTop += deltaY;
    lastYRef.current = e.clientY;
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleMouseLeave = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // 스크롤 버튼 핸들러
  const scrollUp = useCallback(() => {
    if (!weekBodyRef.current) return;
    weekBodyRef.current.scrollBy({ top: -200, behavior: 'smooth' });
  }, []);

  const scrollDown = useCallback(() => {
    if (!weekBodyRef.current) return;
    weekBodyRef.current.scrollBy({ top: 200, behavior: 'smooth' });
  }, []);

  // 현재 시간으로 스크롤
  const scrollToNow = useCallback(() => {
    if (!weekBodyRef.current) return;
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const targetScroll = (minutes / 60) * 60 - weekBodyRef.current.clientHeight / 2;
    weekBodyRef.current.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
  }, []);
  // 표시할 요일 필터링
  const visibleDays = useMemo(() => {
    return weekDays.filter(date => !hiddenDays.includes(date.getDay()));
  }, [weekDays, hiddenDays]);

  const columnCount = visibleDays.length;

  // 해당 날짜의 이벤트 가져오기
  const getEventsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return events.filter(event => event.date === dateStr);
  };

  // 이벤트 위치 및 높이 계산 (시간 기반)
  const getEventStyle = (event: CalendarEvent) => {
    if (!event.time) {
      // 종일 이벤트는 상단에 표시
      return { top: 0, height: 20, isAllDay: true };
    }

    const [hours, minutes] = event.time.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;

    // 기본 1시간 길이
    const endMinutes = startMinutes + 60;

    const top = (startMinutes / 60) * 60; // 시간당 60px
    const height = Math.max(((endMinutes - startMinutes) / 60) * 60, 20);

    return { top, height, isAllDay: false };
  };

  // 오늘 날짜인지 확인
  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  // 선택된 날짜인지 확인
  const isSelected = (date: Date) => {
    if (!selectedDate) return false;
    return (
      date.getFullYear() === selectedDate.getFullYear() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getDate() === selectedDate.getDate()
    );
  };

  // 주말인지 확인
  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  // 현재 시간 라인 위치
  const currentTimePosition = useMemo(() => {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    return (minutes / 60) * 60; // 시간당 60px
  }, []);

  // 현재 주에 오늘이 포함되어 있는지
  const todayInWeek = visibleDays.some(isToday);

  return (
    <div className="week-view">
      {/* 헤더: 요일 + 날짜 */}
      <div
        className="week-header"
        style={{ gridTemplateColumns: `50px repeat(${columnCount}, 1fr)` }}
      >
        <div className="week-time-gutter" />
        {visibleDays.map((date) => (
          <div
            key={date.toISOString()}
            className={`week-day-header ${isToday(date) ? 'today' : ''} ${isSelected(date) ? 'selected' : ''} ${showHolidays && isWeekend(date) ? 'weekend' : ''}`}
            onClick={() => onSelectDate(date)}
          >
            <span className="week-day-name">{format(date, 'EEE')}</span>
            <span className={`week-day-number ${isToday(date) ? 'today-badge' : ''}`}>
              {format(date, 'd')}
            </span>
          </div>
        ))}
      </div>

      {/* 시간 그리드 */}
      <div
        ref={weekBodyRef}
        className="week-body"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className="week-grid"
          style={{ gridTemplateColumns: `50px repeat(${columnCount}, 1fr)` }}
        >
          {/* 시간 라벨 */}
          <div className="week-time-column">
            {HOURS.map((hour) => (
              <div key={hour} className="week-time-slot">
                <span className="week-time-label">
                  {hour === 0 ? '' : `${hour.toString().padStart(2, '0')}:00`}
                </span>
              </div>
            ))}
          </div>

          {/* 날짜별 열 */}
          {visibleDays.map((date) => (
            <div
              key={date.toISOString()}
              className={`week-day-column ${isToday(date) ? 'today' : ''} ${showHolidays && isWeekend(date) ? 'weekend' : ''}`}
              onClick={() => onSelectDate(date)}
            >
              {/* 시간 슬롯 */}
              {HOURS.map((hour) => (
                <div key={hour} className="week-hour-cell" />
              ))}

              {/* 이벤트 */}
              {getEventsForDate(date).map((event) => {
                const style = getEventStyle(event);
                if (style.isAllDay) return null; // 종일 이벤트는 별도 처리

                return (
                  <div
                    key={event.id}
                    className={`week-event ${event.completed ? 'completed' : ''}`}
                    style={{
                      top: `${style.top}px`,
                      height: `${style.height}px`,
                      backgroundColor: event.color || 'var(--accent-color)',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(event, e);
                    }}
                  >
                    <span className="week-event-time">{event.time}</span>
                    <span className="week-event-title">{event.title}</span>
                  </div>
                );
              })}
            </div>
          ))}

          {/* 현재 시간 라인 */}
          {todayInWeek && (
            <div
              className="week-current-time-line"
              style={{
                top: `${currentTimePosition}px`,
                left: '50px',
                width: `calc(100% - 50px)`,
              }}
            >
              <div className="week-current-time-dot" />
            </div>
          )}
        </div>
      </div>

      {/* 스크롤 버튼 - 스크롤바 옆에 고정 */}
      <div className="week-scroll-buttons">
        <button className="week-scroll-btn" onClick={scrollUp} title="Scroll up">
          ▲
        </button>
        <button className="week-scroll-btn week-scroll-btn-now" onClick={scrollToNow} title="Go to current time">
          ●
        </button>
        <button className="week-scroll-btn" onClick={scrollDown} title="Scroll down">
          ▼
        </button>
      </div>
    </div>
  );
}
