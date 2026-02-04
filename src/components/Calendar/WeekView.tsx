import { useMemo, useRef, useCallback, memo, useState } from 'react';
import { format } from 'date-fns';
import type { CalendarEvent } from '../../types';
import { isDateInRepeatSchedule, createRepeatInstance, getLocalDateString, sortEventsByCompletion } from '../../utils/date';
import './WeekView.css';

// 시간대 (0시 ~ 23시)
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// 종일 이벤트 최대 표시 줄 수
const MAX_ALL_DAY_ROWS = 3;

interface WeekViewProps {
  weekDays: Date[];
  events: CalendarEvent[];
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onOpenDate?: (date: Date, e: React.MouseEvent) => void;
  onEventClick?: (event: CalendarEvent, e: React.MouseEvent) => void;
  showHolidays?: boolean;
  hiddenDays?: number[];
}

export const WeekView = memo(function WeekView({
  weekDays,
  events,
  selectedDate,
  onSelectDate,
  onOpenDate,
  onEventClick,
  showHolidays = true,
  hiddenDays = [],
}: WeekViewProps) {
  const weekBodyRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const lastYRef = useRef(0);

  // 스크롤 버튼 위치 상태 (트리플 클릭 시 왼쪽으로 이동)
  const [scrollButtonsLeft, setScrollButtonsLeft] = useState(false);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 드래그 스크롤 지원
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

  // 현재 시간으로 스크롤 (트리플 클릭 시 위치 토글)
  const scrollToNow = useCallback(() => {
    if (!weekBodyRef.current) return;

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
    const targetScroll = (minutes / 60) * 60 - weekBodyRef.current.clientHeight / 2;
    weekBodyRef.current.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
  }, []);
  // 표시할 요일 필터링
  const visibleDays = useMemo(() => {
    return weekDays.filter(date => !hiddenDays.includes(date.getDay()));
  }, [weekDays, hiddenDays]);

  const columnCount = visibleDays.length;

  // 해당 날짜의 이벤트 가져오기 (반복 일정 포함)
  const getEventsForDate = useCallback((date: Date): CalendarEvent[] => {
    const dateStr = getLocalDateString(date);
    const result: CalendarEvent[] = [];

    for (const event of events) {
      if (isDateInRepeatSchedule(dateStr, event)) {
        // 반복 일정의 경우 해당 날짜에 대한 인스턴스 생성
        if (event.repeat && event.repeat.type !== 'none' && event.date !== dateStr) {
          result.push(createRepeatInstance(event, dateStr));
        } else {
          result.push(event);
        }
      }
    }

    return result;
  }, [events]);

  // 종일 이벤트 (시간 없는 이벤트) 분리 - 미완료가 먼저 표시
  const allDayEventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    for (const date of visibleDays) {
      const dateStr = getLocalDateString(date);
      const eventsForDate = getEventsForDate(date);
      const allDayEvents = eventsForDate.filter(e => !e.time);
      if (allDayEvents.length > 0) {
        // 미완료 먼저, 완료는 나중에 정렬
        map.set(dateStr, sortEventsByCompletion(allDayEvents));
      }
    }

    return map;
  }, [visibleDays, getEventsForDate]);

  // 종일 이벤트가 있는지 확인
  const hasAllDayEvents = useMemo(() => {
    return allDayEventsByDate.size > 0;
  }, [allDayEventsByDate]);


  // 이벤트 위치 및 높이 계산 (시간 기반)
  const getEventStyle = (event: CalendarEvent) => {
    const [hours, minutes] = (event.time || '00:00').split(':').map(Number);
    const startMinutes = hours * 60 + minutes;

    // 기본 1시간 길이
    const endMinutes = startMinutes + 60;

    const top = (startMinutes / 60) * 60; // 시간당 60px
    const height = Math.max(((endMinutes - startMinutes) / 60) * 60, 20);

    return { top, height };
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

      {/* 종일 이벤트 영역 */}
      {hasAllDayEvents && (
        <div
          className="week-allday-section"
          style={{ gridTemplateColumns: `50px repeat(${columnCount}, 1fr)` }}
        >
          <div className="week-allday-gutter" />
          {visibleDays.map((date) => {
            const dateStr = getLocalDateString(date);
            const allDayEvents = allDayEventsByDate.get(dateStr) || [];
            const displayEvents = allDayEvents.slice(0, MAX_ALL_DAY_ROWS);
            const moreCount = allDayEvents.length - MAX_ALL_DAY_ROWS;

            return (
              <div
                key={date.toISOString()}
                className={`week-allday-cell ${isToday(date) ? 'today' : ''} ${showHolidays && isWeekend(date) ? 'weekend' : ''}`}
              >
                {displayEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`week-allday-event ${event.completed ? 'completed' : ''}`}
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
                  <div className="week-allday-more">+{moreCount}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
              data-date={format(date, 'yyyy-MM-dd')}
              onClick={() => onSelectDate(date)}
              onDoubleClick={(e) => onOpenDate?.(date, e)}
            >
              {/* 시간 슬롯 */}
              {HOURS.map((hour) => (
                <div key={hour} className="week-hour-cell" />
              ))}

              {/* 시간 있는 이벤트만 표시 */}
              {getEventsForDate(date)
                .filter(event => event.time)
                .map((event) => {
                  const style = getEventStyle(event);

                  return (
                    <div
                      key={event.id}
                      className={`week-event ${event.completed ? 'completed' : ''}`}
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

      {/* 스크롤 버튼 - 트리플 클릭 시 왼쪽/오른쪽 토글 */}
      <div className={`week-scroll-buttons ${scrollButtonsLeft ? 'left' : ''}`}>
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
});
