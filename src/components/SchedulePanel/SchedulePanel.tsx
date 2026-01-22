import { useMemo } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Trash2, Check, X } from 'lucide-react';
import type { CalendarEvent } from '../../types';
import './SchedulePanel.css';

interface SchedulePanelProps {
  selectedDate: Date | null;
  events: CalendarEvent[];
  onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (id: string) => void;
  onToggleComplete?: (id: string) => void;
  onClose?: () => void;
}

export function SchedulePanel({
  selectedDate,
  events,
  onEditEvent,
  onDeleteEvent,
  onToggleComplete,
  onClose,
}: SchedulePanelProps) {
  // 로컬 날짜를 yyyy-MM-dd 형식으로 변환 (타임존 문제 방지)
  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const filteredEvents = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = getLocalDateString(selectedDate);
    const filtered = events.filter((event) => event.date === dateStr);

    // 시간 비교 함수 (시간 없으면 맨 뒤로)
    const compareTime = (a: CalendarEvent, b: CalendarEvent) => {
      if (!a.time && !b.time) return 0;
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    };

    // 완료 여부로 분리 후 각각 시간순 정렬
    const incomplete = filtered.filter(e => !e.completed).sort(compareTime);
    const completed = filtered.filter(e => e.completed).sort(compareTime);

    return [...incomplete, ...completed];
  }, [selectedDate, events]);

  const formatDate = (date: Date | null) => {
    if (!date) return 'No date selected';
    return format(date, 'EEEE, MMMM d, yyyy');
  };

  return (
    <motion.div
      className="schedule-panel"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Header */}
      <div className="schedule-header">
        <div className="schedule-header-content">
          <h2 className="schedule-title">Schedule</h2>
          <p className="schedule-date">{formatDate(selectedDate)}</p>
        </div>
        {onClose && (
          <button className="schedule-close" onClick={onClose}>
            <X size={18} />
          </button>
        )}
      </div>

      {/* Schedule List */}
      <div className="schedule-list">
        <AnimatePresence mode="popLayout">
          {filteredEvents.map((event) => (
            <motion.div
              key={event.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="schedule-item"
              onClick={() => onEditEvent(event)}
            >
              {/* 체크박스 */}
              <button
                className={`schedule-item-checkbox ${event.completed ? 'checked' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleComplete?.(event.id);
                }}
              >
                {event.completed && <Check size={12} strokeWidth={3} />}
              </button>

              <div className="schedule-item-content">
                <p className={`schedule-item-title ${event.completed ? 'completed' : ''}`}>
                  {event.title}
                </p>
                {event.time && (
                  <div className="schedule-item-time">
                    <Clock size={12} />
                    <span>{event.time}</span>
                  </div>
                )}
              </div>

              <button
                className="schedule-item-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteEvent(event.id);
                }}
              >
                <Trash2 size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredEvents.length === 0 && (
          <div className="schedule-empty">No schedules for this day</div>
        )}
      </div>
    </motion.div>
  );
}
