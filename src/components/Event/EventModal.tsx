import { useState, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { X, Trash2 } from 'lucide-react';
import type { CalendarEvent } from '../../types';
import { getLocalDateString } from '../../utils/date';
import { useEventForm } from '../../hooks/useEventForm';
import { TimePicker, RepeatIconButton, ReminderIconButton, GoogleSyncIconButton, DDayIconButton } from './EventFormFields';
import './Event.css';

interface EventModalProps {
  date: Date;
  event?: CalendarEvent;
  onSave: (event: Omit<CalendarEvent, 'id'>, syncToGoogle?: boolean) => void;
  onUpdate: (id: string, updates: Partial<CalendarEvent>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  googleConnected?: boolean;
  accentColor?: 'blue' | 'orange';
}

export function EventModal({
  date,
  event,
  onSave,
  onUpdate,
  onDelete,
  onClose,
  googleConnected = false,
  accentColor = 'blue',
}: EventModalProps) {
  const { state, actions, refs } = useEventForm({ initialEvent: event });
  const isEditing = !!event;

  // 드래그 이동 상태
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });
  const positionRef = useRef(position);
  positionRef.current = position;  // 항상 최신 position 추적

  // 반복 인스턴스인 경우 원본 ID 사용
  const originalEventId = event?.isRepeatInstance && event?.repeatGroupId
    ? event.repeatGroupId
    : event?.id;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.title.trim()) return;

    const repeat = actions.buildRepeatConfig();
    const reminder = actions.buildReminderConfig();

    if (isEditing && event && originalEventId) {
      onUpdate(originalEventId, {
        title: state.title.trim(),
        time: state.time || undefined,
        description: state.description.trim() || undefined,
        repeat,
        reminder,
        isDDay: state.isDDay || undefined,
      });
    } else {
      // accentColor에 따라 이벤트 색상 결정
      const eventColor = accentColor === 'orange' ? '#ff9500' : '#007aff';
      onSave({
        title: state.title.trim(),
        date: getLocalDateString(date),
        time: state.time || undefined,
        description: state.description.trim() || undefined,
        color: eventColor,
        repeat,
        reminder,
        isDDay: state.isDDay || undefined,
      }, state.syncToGoogle);
    }
    onClose();
  };

  const handleDelete = () => {
    if (event && originalEventId) {
      onDelete(originalEventId);
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // 드래그 시작 (positionRef를 사용하여 의존성 제거)
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: positionRef.current.x,
      initialY: positionRef.current.y,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - dragRef.current.startX;
      const deltaY = moveEvent.clientY - dragRef.current.startY;
      setPosition({
        x: dragRef.current.initialX + deltaX,
        y: dragRef.current.initialY + deltaY,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div
        className="event-modal-popup"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          cursor: isDragging ? 'grabbing' : undefined,
        }}
      >
        {/* Header - 드래그 가능 */}
        <div
          className="popup-header popup-header-draggable"
          onMouseDown={handleDragStart}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <h2 className="popup-title">Schedule Details</h2>
          <motion.button
            className="popup-close"
            onClick={onClose}
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <X size={20} />
          </motion.button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="popup-content">
          {/* Title 필드 - 독립적인 한 줄 */}
          <div className="popup-field">
            <label className="popup-label">Title</label>
            <input
              type="text"
              placeholder="Enter title"
              value={state.title}
              onChange={(e) => actions.setTitle(e.target.value)}
              className="popup-input"
              maxLength={50}
              autoFocus
            />
          </div>

          {/* 아이콘 버튼 행 - 반복, 구글, 알람, D-Day */}
          <div className="icon-row">
            <RepeatIconButton
              repeatType={state.repeatType}
              showDropdown={state.showRepeatDropdown}
              onSetShowDropdown={actions.setShowRepeatDropdown}
              onSelectType={actions.setRepeatType}
              pickerRef={refs.repeatPickerRef}
            />
            {!isEditing && (
              <GoogleSyncIconButton
                syncToGoogle={state.syncToGoogle}
                onToggle={() => actions.setSyncToGoogle(!state.syncToGoogle)}
                disabled={!googleConnected}
              />
            )}
            <ReminderIconButton
              reminderMinutes={state.reminderMinutes}
              showDropdown={state.showReminderDropdown}
              onSetShowDropdown={actions.setShowReminderDropdown}
              onSelectMinutes={actions.setReminderMinutes}
              disabled={!state.time}
              pickerRef={refs.reminderPickerRef}
            />
            <DDayIconButton
              isDDay={state.isDDay}
              onToggle={() => actions.setIsDDay(!state.isDDay)}
            />
          </div>

          <div className="popup-field">
            <label className="popup-label">Time</label>
            <TimePicker
              time={state.time}
              selectedPeriod={state.selectedPeriod}
              selectedHour={state.selectedHour}
              selectedMinute={state.selectedMinute}
              openDropdown={state.openDropdown}
              onSetOpenDropdown={actions.setOpenDropdown}
              onPeriodSelect={actions.handlePeriodSelect}
              onHourSelect={actions.handleHourSelect}
              onMinuteSelect={actions.handleMinuteSelect}
              onClearTime={actions.handleClearTime}
              pickerRef={refs.timePickerRef}
            />
          </div>

          <div className="popup-field">
            <label className="popup-label">Description</label>
            <textarea
              placeholder="Add description..."
              value={state.description}
              onChange={(e) => actions.setDescription(e.target.value)}
              className="popup-textarea"
              maxLength={1000}
              rows={4}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="popup-footer">
          {isEditing && (
            <motion.button
              className="popup-btn popup-btn-delete"
              onClick={handleDelete}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <Trash2 size={16} />
              Delete
            </motion.button>
          )}
          <div className="popup-footer-right">
            <motion.button
              className="popup-btn popup-btn-cancel"
              onClick={onClose}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              Cancel
            </motion.button>
            <motion.button
              className="popup-btn popup-btn-save"
              onClick={handleSubmit}
              disabled={!state.title.trim()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              Save
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
