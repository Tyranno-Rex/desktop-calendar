import { X, Trash2 } from 'lucide-react';
import type { CalendarEvent } from '../../types';
import { getLocalDateString } from '../../utils/date';
import { useEventForm } from '../../hooks/useEventForm';
import { TimePicker, RepeatSelector, ReminderSelector, DDayToggle, GoogleSyncToggle } from './EventFormFields';
import './Event.css';

interface EventModalProps {
  date: Date;
  event?: CalendarEvent;
  onSave: (event: Omit<CalendarEvent, 'id'>, syncToGoogle?: boolean) => void;
  onUpdate: (id: string, updates: Partial<CalendarEvent>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  googleConnected?: boolean;
}

export function EventModal({
  date,
  event,
  onSave,
  onUpdate,
  onDelete,
  onClose,
  googleConnected = false,
}: EventModalProps) {
  const { state, actions, refs } = useEventForm({ initialEvent: event });
  const isEditing = !!event;

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
      onSave({
        title: state.title.trim(),
        date: getLocalDateString(date),
        time: state.time || undefined,
        description: state.description.trim() || undefined,
        color: '#3b82f6',
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

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="event-modal-popup">
        {/* Header */}
        <div className="popup-header">
          <h2 className="popup-title">Schedule Details</h2>
          <button className="popup-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="popup-content">
          <div className="popup-field">
            <label className="popup-label">Title</label>
            <div className="title-repeat-row">
              <input
                type="text"
                placeholder="Enter title"
                value={state.title}
                onChange={(e) => actions.setTitle(e.target.value)}
                className="popup-input"
                autoFocus
              />
              <RepeatSelector
                repeatType={state.repeatType}
                showDropdown={state.showRepeatDropdown}
                onSetShowDropdown={actions.setShowRepeatDropdown}
                onSelectType={actions.setRepeatType}
                pickerRef={refs.repeatPickerRef}
              />
              <ReminderSelector
                reminderMinutes={state.reminderMinutes}
                showDropdown={state.showReminderDropdown}
                onSetShowDropdown={actions.setShowReminderDropdown}
                onSelectMinutes={actions.setReminderMinutes}
                disabled={!state.time}
                pickerRef={refs.reminderPickerRef}
              />
            </div>
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
              rows={4}
            />
          </div>

          {/* D-Day 표시 옵션 */}
          <DDayToggle
            isDDay={state.isDDay}
            onToggle={() => actions.setIsDDay(!state.isDDay)}
          />

          {/* Google Calendar 동기화 토글 - 새 일정 추가 시에만 표시 */}
          {!isEditing && googleConnected && (
            <GoogleSyncToggle
              syncToGoogle={state.syncToGoogle}
              onToggle={() => actions.setSyncToGoogle(!state.syncToGoogle)}
            />
          )}
        </form>

        {/* Footer */}
        <div className="popup-footer">
          {isEditing && (
            <button className="popup-btn popup-btn-delete" onClick={handleDelete}>
              <Trash2 size={16} />
              Delete
            </button>
          )}
          <div className="popup-footer-right">
            <button className="popup-btn popup-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              className="popup-btn popup-btn-save"
              onClick={handleSubmit}
              disabled={!state.title.trim()}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
