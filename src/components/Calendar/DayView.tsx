import { useMemo, useRef, useCallback, memo, useState } from 'react';
import { format } from 'date-fns';
import type { CalendarEvent } from '../../types';
import { getLocalDateString, getEventsForDateString, sortEventsByCompletion } from '../../utils/date';
import './DayView.css';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MAX_ALL_DAY_ROWS = 5;

interface DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onOpenDate?: (date: Date, e: React.MouseEvent) => void;
  onEventClick?: (event: CalendarEvent, e: React.MouseEvent) => void;
  showHolidays?: boolean;
}

export const DayView = memo(function DayView({
  currentDate,
  events,
  onOpenDate,
  onEventClick,
  showHolidays = true,
}: DayViewProps) {
  const dayBodyRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const lastYRef = useRef(0);

  // 스크롤 버튼 위치 상태 (트리플 클릭 시 왼쪽으로 이동)
  const [scrollButtonsLeft, setScrollButtonsLeft] = useState(false);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 드래그 스크롤
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    lastYRef.current = e.clientY;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current || !dayBodyRef.current) return;
    const deltaY = lastYRef.current - e.clientY;
    dayBodyRef.current.scrollTop += deltaY;
    lastYRef.current = e.clientY;
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleMouseLeave = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // 스크롤 버튼
  const scrollUp = useCallback(() => {
    if (!dayBodyRef.current) return;
    dayBodyRef.current.scrollBy({ top: -200, behavior: 'smooth' });
  }, []);

  const scrollDown = useCallback(() => {
    if (!dayBodyRef.current) return;
    dayBodyRef.current.scrollBy({ top: 200, behavior: 'smooth' });
  }, []);

  // 현재 시간으로 스크롤 (트리플 클릭 시 위치 토글)
  const scrollToNow = useCallback(() => {
    if (!dayBodyRef.current) return;

    // 클릭 카운트 증가
    clickCountRef.current += 1;

    // 타이머 리셋
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }

    // 500ms 내에 3번 클릭하면 위치 토글
    if (clickCountRef.current >= 3) {
      setScrollButtonsLeft(prev => !prev);
      clickCountRef.current = 0;
      return;
    }

    // 500ms 후 카운트 리셋
    clickTimerRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, 500);

    // 현재 시간으로 스크롤
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const targetScroll = (minutes / 60) * 60 - dayBodyRef.current.clientHeight / 2;
    dayBodyRef.current.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
  }, []);

  // 해당 날짜의 이벤트 가져오기
  const getEventsForDate = useCallback((date: Date): CalendarEvent[] => {
    return getEventsForDateString(getLocalDateString(date), events);
  }, [events]);

  // 종일 이벤트
  const allDayEvents = useMemo(() => {
    const eventsForDate = getEventsForDate(currentDate);
    const allDay = eventsForDate.filter(e => !e.time);
    return sortEventsByCompletion(allDay);
  }, [currentDate, getEventsForDate]);

  // 시간 있는 이벤트
  const timedEvents = useMemo(() => {
    const eventsForDate = getEventsForDate(currentDate);
    return eventsForDate.filter(e => e.time);
  }, [currentDate, getEventsForDate]);

  const hasAllDayEvents = allDayEvents.length > 0;

  // 이벤트 스타일 계산
  const getEventStyle = (event: CalendarEvent) => {
    const [hours, minutes] = (event.time || '00:00').split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + 60;

    const top = (startMinutes / 60) * 60;
    const height = Math.max(((endMinutes - startMinutes) / 60) * 60, 20);

    return { top, height };
  };

  // 오늘인지 확인
  const isToday = useMemo(() => {
    const today = new Date();
    return (
      currentDate.getFullYear() === today.getFullYear() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getDate() === today.getDate()
    );
  }, [currentDate]);

  // 주말인지 확인
  const isWeekend = useMemo(() => {
    const day = currentDate.getDay();
    return day === 0 || day === 6;
  }, [currentDate]);

  // 현재 시간 라인 위치
  const currentTimePosition = useMemo(() => {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    return (minutes / 60) * 60;
  }, []);

  const displayAllDayEvents = allDayEvents.slice(0, MAX_ALL_DAY_ROWS);
  const moreCount = allDayEvents.length - MAX_ALL_DAY_ROWS;

  return (
    <div className="day-view">
      {/* 날짜 헤더 */}
      <div className="day-header">
        <div className="day-time-gutter" />
        <div className={`day-date-header ${isToday ? 'today' : ''} ${showHolidays && isWeekend ? 'weekend' : ''}`}>
          <span className="day-date-name">{format(currentDate, 'EEEE')}</span>
          <span className={`day-date-number ${isToday ? 'today-badge' : ''}`}>
            {format(currentDate, 'd')}
          </span>
        </div>
      </div>

      {/* 종일 이벤트 영역 */}
      {hasAllDayEvents && (
        <div className="day-allday-section">
          <div className="day-allday-gutter" />
          <div className={`day-allday-cell ${isToday ? 'today' : ''} ${showHolidays && isWeekend ? 'weekend' : ''}`}>
            {displayAllDayEvents.map((event) => (
              <div
                key={event.id}
                className={`day-allday-event ${event.completed ? 'completed' : ''}`}
                style={{ backgroundColor: 'var(--accent-color)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick?.(event, e);
                }}
              >
                {event.title}
              </div>
            ))}
            {moreCount > 0 && (
              <div className="day-allday-more">+{moreCount}</div>
            )}
          </div>
        </div>
      )}

      {/* 시간 그리드 */}
      <div
        ref={dayBodyRef}
        className="day-body"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <div className="day-grid">
          {/* 시간 라벨 */}
          <div className="day-time-column">
            {HOURS.map((hour) => (
              <div key={hour} className="day-time-slot">
                <span className="day-time-label">
                  {hour === 0 ? '' : `${hour.toString().padStart(2, '0')}:00`}
                </span>
              </div>
            ))}
          </div>

          {/* 이벤트 영역 */}
          <div
            className={`day-events-column ${isToday ? 'today' : ''} ${showHolidays && isWeekend ? 'weekend' : ''}`}
            onDoubleClick={(e) => onOpenDate?.(currentDate, e)}
          >
            {/* 시간 슬롯 */}
            {HOURS.map((hour) => (
              <div key={hour} className="day-hour-cell" />
            ))}

            {/* 이벤트 */}
            {timedEvents.map((event) => {
              const style = getEventStyle(event);

              return (
                <div
                  key={event.id}
                  className={`day-event ${event.completed ? 'completed' : ''}`}
                  style={{
                    top: `${style.top}px`,
                    height: `${style.height}px`,
                    backgroundColor: 'var(--accent-color)',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick?.(event, e);
                  }}
                >
                  <span className="day-event-time">{event.time}</span>
                  <span className="day-event-title">{event.title}</span>
                </div>
              );
            })}

            {/* 현재 시간 라인 */}
            {isToday && (
              <div
                className="day-current-time-line"
                style={{ top: `${currentTimePosition}px` }}
              >
                <div className="day-current-time-dot" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 스크롤 버튼 - 트리플 클릭 시 왼쪽/오른쪽 토글 */}
      <div className={`day-scroll-buttons ${scrollButtonsLeft ? 'left' : ''}`}>
        <button className="day-scroll-btn" onClick={scrollUp} title="Scroll up">
          ▲
        </button>
        <button className="day-scroll-btn day-scroll-btn-now" onClick={scrollToNow} title="Go to current time">
          ●
        </button>
        <button className="day-scroll-btn" onClick={scrollDown} title="Scroll down">
          ▼
        </button>
      </div>
    </div>
  );
});
