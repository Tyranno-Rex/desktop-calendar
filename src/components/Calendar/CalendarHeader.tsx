import { memo } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
      {/* 좌측: 월/년 */}
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

      {/* 우측: 네비게이션 */}
      <div className="nav-controls">
        <motion.button
          className="nav-btn"
          onClick={onPrevMonth}
          title="Previous month"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ChevronLeft size={20} />
        </motion.button>
        <motion.button
          className="today-btn"
          onClick={onToday}
          title="Go to today"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Today
        </motion.button>
        <motion.button
          className="nav-btn"
          onClick={onNextMonth}
          title="Next month"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ChevronRight size={20} />
        </motion.button>
      </div>
    </div>
  );
});
