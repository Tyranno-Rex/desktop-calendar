import { memo, useCallback, useRef, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import './Calendar.css';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Desktop Mode에서 클릭 중복 방지를 위한 디바운스 시간 (ms)
const CLICK_DEBOUNCE_MS = 100;

export type ViewMode = 'month' | 'week' | 'day';

interface CalendarHeaderProps {
  currentMonth: number;
  currentYear: number;
  weekRangeText?: string;
  dayText?: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  onPrevDay?: () => void;
  onNextDay?: () => void;
  onToday: () => void;
  onMonthSelect: (month: number) => void;
  onYearSelect: (year: number) => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}

export const CalendarHeader = memo(function CalendarHeader({
  currentMonth,
  currentYear,
  weekRangeText,
  dayText,
  onPrevMonth,
  onNextMonth,
  onPrevWeek,
  onNextWeek,
  onPrevDay,
  onNextDay,
  onToday,
  onMonthSelect,
  onYearSelect,
  viewMode = 'month',
  onViewModeChange,
}: CalendarHeaderProps) {
  const [isDraggingMonth, setIsDraggingMonth] = useState(false);
  const [isDraggingYear, setIsDraggingYear] = useState(false);
  const dragStartY = useRef(0);
  const dragStartValue = useRef(0);
  const threshold = 30; // 드래그 임계값 (픽셀)

  // 월 드래그
  const handleMonthMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingMonth(true);
    dragStartY.current = e.clientY;
    dragStartValue.current = currentMonth;
  }, [currentMonth]);

  // 연도 드래그
  const handleYearMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingYear(true);
    dragStartY.current = e.clientY;
    dragStartValue.current = currentYear;
  }, [currentYear]);

  // 월 휠
  const handleMonthWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1 : -1;
    let newMonth = currentMonth + delta;
    if (newMonth > 11) newMonth = 0;
    if (newMonth < 0) newMonth = 11;
    onMonthSelect(newMonth);
  }, [currentMonth, onMonthSelect]);

  // 연도 휠
  const handleYearWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1 : -1;
    const newYear = currentYear + delta;
    if (newYear > 1900 && newYear < 2100) {
      onYearSelect(newYear);
    }
  }, [currentYear, onYearSelect]);

  // 드래그 처리
  useEffect(() => {
    if (!isDraggingMonth && !isDraggingYear) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = dragStartY.current - e.clientY;
      const steps = Math.floor(deltaY / threshold);

      if (isDraggingMonth) {
        let newMonth = dragStartValue.current + steps;
        // 월 범위 순환
        while (newMonth > 11) newMonth -= 12;
        while (newMonth < 0) newMonth += 12;
        if (newMonth !== currentMonth) {
          onMonthSelect(newMonth);
        }
      } else if (isDraggingYear) {
        const newYear = dragStartValue.current + steps;
        if (newYear !== currentYear && newYear > 1900 && newYear < 2100) {
          onYearSelect(newYear);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDraggingMonth(false);
      setIsDraggingYear(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingMonth, isDraggingYear, currentMonth, currentYear, onMonthSelect, onYearSelect]);

  // Desktop Mode 클릭 중복 방지
  const lastNavClickTime = useRef(0);

  const handlePrev = useCallback(() => {
    const now = Date.now();
    if (now - lastNavClickTime.current < CLICK_DEBOUNCE_MS) return;
    lastNavClickTime.current = now;

    if (viewMode === 'day') {
      onPrevDay?.();
    } else if (viewMode === 'week') {
      onPrevWeek?.();
    } else {
      onPrevMonth();
    }
  }, [viewMode, onPrevDay, onPrevWeek, onPrevMonth]);

  const handleNext = useCallback(() => {
    const now = Date.now();
    if (now - lastNavClickTime.current < CLICK_DEBOUNCE_MS) return;
    lastNavClickTime.current = now;

    if (viewMode === 'day') {
      onNextDay?.();
    } else if (viewMode === 'week') {
      onNextWeek?.();
    } else {
      onNextMonth();
    }
  }, [viewMode, onNextDay, onNextWeek, onNextMonth]);

  return (
    <div className="calendar-header">
      {/* 중앙: 화살표 + 월/년 or 주간 범위 + 화살표 */}
      <div className="nav-center">
        <motion.button
          className="nav-btn nav-arrow"
          onClick={handlePrev}
          title={viewMode === 'week' ? 'Previous week' : 'Previous month'}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          &lt;
        </motion.button>
        <div className="month-year">
          {viewMode === 'month' ? (
            <motion.span
              key={`${currentMonth}-${currentYear}`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="month-year-clickable"
            >
              <span
                className={`month-text ${isDraggingMonth ? 'dragging' : ''}`}
                onMouseDown={handleMonthMouseDown}
                onWheel={handleMonthWheel}
                title="Drag or scroll to change month"
              >
                {MONTH_NAMES[currentMonth]}
              </span>
              <span style={{ width: '8px', display: 'inline-block' }} />
              <span
                className={`year-text ${isDraggingYear ? 'dragging' : ''}`}
                onMouseDown={handleYearMouseDown}
                onWheel={handleYearWheel}
                title="Drag or scroll to change year"
              >
                {currentYear}
              </span>
            </motion.span>
          ) : viewMode === 'week' ? (
            <motion.span
              key={weekRangeText}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="week-range-text"
            >
              {weekRangeText}
            </motion.span>
          ) : (
            <motion.span
              key={dayText}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="day-text"
            >
              {dayText}
            </motion.span>
          )}
        </div>
        <motion.button
          className="nav-btn nav-arrow"
          onClick={handleNext}
          title={viewMode === 'week' ? 'Next week' : 'Next month'}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          &gt;
        </motion.button>
      </div>

      {/* 우측: Today + View Toggle */}
      <div className="header-right">
        <motion.button
          className="today-btn"
          onClick={() => {
            const now = Date.now();
            if (now - lastNavClickTime.current < CLICK_DEBOUNCE_MS) return;
            lastNavClickTime.current = now;
            onToday();
          }}
          title="Go to today"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Today
        </motion.button>

        {onViewModeChange && (
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${viewMode === 'month' ? 'active' : ''}`}
              onClick={() => onViewModeChange('month')}
            >
              Month
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'week' ? 'active' : ''}`}
              onClick={() => onViewModeChange('week')}
            >
              Week
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'day' ? 'active' : ''}`}
              onClick={() => onViewModeChange('day')}
            >
              Day
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
