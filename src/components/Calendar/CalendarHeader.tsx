import { memo } from 'react';
import { motion } from 'motion/react';
import './Calendar.css';

interface CalendarHeaderProps {
  monthYear: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

export const CalendarHeader = memo(function CalendarHeader({
  monthYear,
  onPrevMonth,
  onNextMonth,
  onToday,
}: CalendarHeaderProps) {
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
            key={monthYear}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {monthYear}
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
