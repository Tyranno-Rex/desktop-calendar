import { memo, useCallback, useRef, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import './Calendar.css';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface CalendarHeaderProps {
  monthYear: string;
  currentMonth: number;
  currentYear: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onMonthSelect: (month: number) => void;
  onYearSelect: (year: number) => void;
}

export const CalendarHeader = memo(function CalendarHeader({
  currentMonth,
  currentYear,
  onPrevMonth,
  onNextMonth,
  onToday,
  onMonthSelect,
  onYearSelect,
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

  return (
    <div className="calendar-header">
      {/* 중앙: 화살표 + 월/년 + 화살표 */}
      <div className="nav-center">
        <motion.button
          className="nav-btn nav-arrow"
          onClick={onPrevMonth}
          title="Previous month"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          &lt;
        </motion.button>
        <div className="month-year">
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
        </div>
        <motion.button
          className="nav-btn nav-arrow"
          onClick={onNextMonth}
          title="Next month"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          &gt;
        </motion.button>
      </div>

      {/* 우측: Today */}
      <motion.button
        className="today-btn"
        onClick={onToday}
        title="Go to today"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        Today
      </motion.button>
    </div>
  );
});
