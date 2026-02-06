import { useMemo, useState, memo, useCallback } from 'react';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { Clock, Trash2, Check, X, Repeat, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import type { CalendarEvent } from '../../types';
import { sortEventsByCompletion, getDDay, getTodayString } from '../../utils/date';
import './SchedulePanel.css';

// 메모이제이션된 스케줄 아이템 컴포넌트
interface ScheduleItemProps {
  event: CalendarEvent;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (id: string) => void;
  onToggleComplete?: (id: string, instanceDate?: string) => void;
  isOverdue?: boolean;
}

const ScheduleItem = memo(function ScheduleItem({
  event,
  onEdit,
  onDelete,
  onToggleComplete,
  isOverdue = false,
}: ScheduleItemProps) {
  const originalId = event.isRepeatInstance && event.repeatGroupId
    ? event.repeatGroupId
    : event.id;

  const handleClick = useCallback(() => onEdit(event), [onEdit, event]);
  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // 반복 인스턴스인 경우 인스턴스 ID와 날짜를 전달
    if (event.isRepeatInstance || (event.repeat && event.repeat.type !== 'none')) {
      onToggleComplete?.(event.id, event.date);
    } else {
      onToggleComplete?.(originalId);
    }
  }, [onToggleComplete, event.id, event.date, event.isRepeatInstance, event.repeat, originalId]);
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(isOverdue ? event.id : originalId);
  }, [onDelete, event.id, originalId, isOverdue]);

  return (
    <motion.div
      className={`schedule-item ${isOverdue ? 'overdue' : ''}`}
      onClick={handleClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <motion.button
        className={`schedule-item-checkbox ${event.completed ? 'checked' : ''}`}
        onClick={handleToggle}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 500, damping: 20 }}
      >
        {event.completed && <Check size={12} strokeWidth={3} />}
      </motion.button>

      <div className="schedule-item-content">
        <div className="schedule-item-title-row">
          <p className={`schedule-item-title ${event.completed ? 'completed' : ''}`}>
            {event.title}
          </p>
          {!isOverdue && event.isDDay && (
            <span className={`schedule-item-dday ${getDDay(event.date) === 'D-Day' ? 'today' : getDDay(event.date).startsWith('D+') ? 'past' : ''}`}>
              {getDDay(event.date)}
            </span>
          )}
          {isOverdue && (
            <span className="schedule-item-overdue-date">
              {format(new Date(event.date + 'T00:00:00'), 'M/d')}
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
          {!isOverdue && (event.repeat || event.isRepeatInstance) && (
            <div className="schedule-item-repeat">
              <Repeat size={12} />
              <span>Repeat</span>
            </div>
          )}
        </div>
      </div>

      <motion.button
        className="schedule-item-delete"
        onClick={handleDelete}
        whileHover={{ scale: 1.15, color: '#ff453a' }}
        whileTap={{ scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 500, damping: 20 }}
      >
        <Trash2 size={16} />
      </motion.button>
    </motion.div>
  );
});

interface SchedulePanelProps {
  selectedDate: Date | null;
  events: CalendarEvent[];
  getEventsForDate: (date: Date) => CalendarEvent[];
  onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (id: string) => void;
  onToggleComplete?: (id: string, instanceDate?: string) => void;
  onClose?: () => void;
  position?: 'left' | 'right';
  showOverdueTasks?: boolean;
}

const SchedulePanelInner = ({
  selectedDate,
  events,
  getEventsForDate,
  onAddEvent: _onAddEvent,
  onEditEvent,
  onDeleteEvent,
  onToggleComplete,
  onClose,
  position = 'right',
  showOverdueTasks = true,
}: SchedulePanelProps) => {
  void _onAddEvent; // Reserved for future use
  const [overdueExpanded, setOverdueExpanded] = useState(true);

  // 오늘 날짜 문자열 (세션 동안 고정)
  const todayStr = useMemo(getTodayString, []);

  // getEventsForDate 사용 (반복 인스턴스 완료 상태 포함)
  const filteredEvents = useMemo(() => {
    if (!selectedDate) return [];
    const eventsForDate = getEventsForDate(selectedDate);
    return sortEventsByCompletion(eventsForDate);
  }, [selectedDate, getEventsForDate]);

  // 미완료 과거 일정 (오늘 이전, completed=false, 반복 일정 제외)
  const overdueEvents = useMemo(() => {
    if (!showOverdueTasks) return [];

    return events
      .filter(event => {
        // 완료된 건 제외
        if (event.completed) return false;
        // 반복 일정 제외 (반복 일정은 계속 나타나므로)
        if (event.repeat && event.repeat.type !== 'none') return false;
        // 오늘 이전 날짜만
        return event.date < todayStr;
      })
      .sort((a, b) => b.date.localeCompare(a.date)); // 최신순 정렬
  }, [events, todayStr, showOverdueTasks]);

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
        {filteredEvents.map((event) => (
          <ScheduleItem
            key={event.id}
            event={event}
            onEdit={onEditEvent}
            onDelete={onDeleteEvent}
            onToggleComplete={onToggleComplete}
          />
        ))}

        {filteredEvents.length === 0 && (
          <div className="schedule-empty">No schedules for this day</div>
        )}
      </div>

      {/* Overdue Section */}
      {showOverdueTasks && overdueEvents.length > 0 && (
        <div className="schedule-overdue-section">
          <button
            className="schedule-section-header"
            onClick={() => setOverdueExpanded(!overdueExpanded)}
          >
            <div className="schedule-section-header-left">
              {overdueExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <AlertCircle size={14} className="overdue-icon" />
              <span>Overdue</span>
            </div>
            <span className="schedule-section-count">{overdueEvents.length}</span>
          </button>

          {overdueExpanded && (
            <div className="schedule-section-content">
              {overdueEvents.map((event) => (
                <ScheduleItem
                  key={event.id}
                  event={event}
                  onEdit={onEditEvent}
                  onDelete={onDeleteEvent}
                  onToggleComplete={onToggleComplete}
                  isOverdue
                />
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

// 메모이제이션된 SchedulePanel export
export const SchedulePanel = memo(SchedulePanelInner);
