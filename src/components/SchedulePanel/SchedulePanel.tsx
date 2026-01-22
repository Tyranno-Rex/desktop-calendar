import { useState, useMemo, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Clock, Trash2, Check } from 'lucide-react';
import type { CalendarEvent } from '../../types';
import './SchedulePanel.css';

interface SchedulePanelProps {
  selectedDate: Date | null;
  events: CalendarEvent[];
  onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (id: string) => void;
  onToggleComplete?: (id: string) => void;
}

export function SchedulePanel({
  selectedDate,
  events,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  onToggleComplete,
}: SchedulePanelProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const prevDateRef = useRef<string | null>(null);

  // 로컬 날짜를 yyyy-MM-dd 형식으로 변환 (타임존 문제 방지)
  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 날짜가 변경되면 폼 초기화
  useEffect(() => {
    const currentDateStr = selectedDate ? getLocalDateString(selectedDate) : null;
    if (prevDateRef.current !== currentDateStr) {
      setIsAdding(false);
      setTitle('');
      setTime('');
      prevDateRef.current = currentDateStr;
    }
  }, [selectedDate]);

  const filteredEvents = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = getLocalDateString(selectedDate);
    const filtered = events.filter((event) => event.date === dateStr);
    // 완료된 항목을 아래로 정렬
    return filtered.sort((a, b) => {
      if (a.completed === b.completed) return 0;
      return a.completed ? 1 : -1;
    });
  }, [selectedDate, events]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedDate) return;

    const dateStr = getLocalDateString(selectedDate);

    onAddEvent({
      title: title.trim(),
      date: dateStr,
      time: time || undefined,
      color: '#3b82f6',
    });

    setTitle('');
    setTime('');
    setIsAdding(false);
  };

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

        {filteredEvents.length === 0 && !isAdding && (
          <div className="schedule-empty">No schedules for this day</div>
        )}
      </div>

      {/* Add Schedule Form */}
      <div className="schedule-footer">
        <AnimatePresence mode="wait">
          {isAdding ? (
            <motion.form
              key="form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleSubmit}
              className="schedule-form"
            >
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Schedule title"
                autoFocus
                className="schedule-input"
              />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="schedule-input"
              />
              <div className="schedule-form-buttons">
                <button
                  type="submit"
                  disabled={!title.trim() || !selectedDate}
                  className="schedule-btn schedule-btn-primary"
                >
                  Add Schedule
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setTitle('');
                    setTime('');
                  }}
                  className="schedule-btn schedule-btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </motion.form>
          ) : (
            <motion.button
              key="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(true)}
              disabled={!selectedDate}
              className="schedule-btn schedule-btn-add"
            >
              <Plus size={18} />
              Add Schedule
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
