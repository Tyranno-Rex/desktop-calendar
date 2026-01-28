import { useMemo } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Trash2, Check, X, Repeat } from 'lucide-react';
import type { CalendarEvent } from '../../types';
import { getLocalDateString, compareEventTime, isDateInRepeatSchedule, createRepeatInstance } from '../../utils/date';
import './SchedulePanel.css';

interface SchedulePanelProps {
  selectedDate: Date | null;
  events: CalendarEvent[];
  onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (id: string) => void;
  onToggleComplete?: (id: string) => void;
  onClose?: () => void;
  position?: 'left' | 'right';
}

export function SchedulePanel({
  selectedDate,
  events,
  onAddEvent: _onAddEvent,
  onEditEvent,
  onDeleteEvent,
  onToggleComplete,
  onClose,
  position = 'right',
}: SchedulePanelProps) {
  void _onAddEvent; // Reserved for future use

  // 반복 인스턴스인 경우 원본 ID 반환
  const getOriginalId = (event: CalendarEvent): string => {
    return event.isRepeatInstance && event.repeatGroupId
      ? event.repeatGroupId
      : event.id;
  };

  // D-Day 계산 (오늘 기준)
  const getDDay = (dateStr: string): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [year, month, day] = dateStr.split('-').map(Number);
    const eventDate = new Date(year, month - 1, day);
    eventDate.setHours(0, 0, 0, 0);

    const diffTime = eventDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'D-Day';
    if (diffDays > 0) return `D-${diffDays}`;
    return `D+${Math.abs(diffDays)}`;
  };

  const filteredEvents = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = getLocalDateString(selectedDate);

    // 반복 일정 인스턴스 포함하여 필터링
    const filtered: CalendarEvent[] = [];
    for (const event of events) {
      if (!event.repeat || event.repeat.type === 'none') {
        // 반복 없는 일정: 단순 날짜 비교
        if (event.date === dateStr) {
          filtered.push(event);
        }
      } else {
        // 반복 일정: 해당 날짜에 표시되어야 하는지 확인
        if (isDateInRepeatSchedule(dateStr, event)) {
          if (event.date === dateStr) {
            // 원본 일정 날짜와 같으면 원본 사용
            filtered.push(event);
          } else {
            // 반복 인스턴스 생성
            filtered.push(createRepeatInstance(event, dateStr));
          }
        }
      }
    }

    // 완료 여부로 분리 후 각각 시간순 정렬
    const incomplete = filtered.filter(e => !e.completed).sort(compareEventTime);
    const completed = filtered.filter(e => e.completed).sort(compareEventTime);

    return [...incomplete, ...completed];
  }, [selectedDate, events]);

  const formatDate = (date: Date | null) => {
    if (!date) return 'No date selected';
    return format(date, 'EEEE, MMMM d, yyyy');
  };

  return (
    <motion.div
      className={`schedule-panel ${position === 'left' ? 'panel-left' : ''}`}
      initial={{ opacity: 0, x: position === 'left' ? -40 : 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: position === 'left' ? -40 : 40 }}
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
                  onToggleComplete?.(getOriginalId(event));
                }}
              >
                {event.completed && <Check size={12} strokeWidth={3} />}
              </button>

              <div className="schedule-item-content">
                <div className="schedule-item-title-row">
                  <p className={`schedule-item-title ${event.completed ? 'completed' : ''}`}>
                    {event.title}
                  </p>
                  {event.isDDay && (
                    <span className={`schedule-item-dday ${getDDay(event.date) === 'D-Day' ? 'today' : getDDay(event.date).startsWith('D+') ? 'past' : ''}`}>
                      {getDDay(event.date)}
                    </span>
                  )}
                </div>
                <div className="schedule-item-meta">
                  {event.time && (
                    <div className="schedule-item-time">
                      <Clock size={12} />
                      <span>{event.time}</span>
                    </div>
                  )}
                  {(event.repeat || event.isRepeatInstance) && (
                    <div className="schedule-item-repeat">
                      <Repeat size={12} />
                      <span>Repeat</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                className="schedule-item-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteEvent(getOriginalId(event));
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
