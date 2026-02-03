import { ChevronDown, Repeat, Bell, Calendar, Target } from 'lucide-react';
import type { RepeatType } from '../../types';
import { PERIODS, HOURS, MINUTES, REPEAT_OPTIONS, REMINDER_OPTIONS } from '../../utils/date';

// 반복 타입에 따른 숫자 반환 (1=매일, 7=매주, 31=매월, 365=매년, -=없음)
function getRepeatNumber(repeatType: RepeatType): string {
  switch (repeatType) {
    case 'daily': return '1';
    case 'weekly': return '7';
    case 'monthly': return '31';
    case 'yearly': return '365';
    default: return '-';
  }
}

interface TimePickerProps {
  time: string;
  selectedPeriod: 'AM' | 'PM';
  selectedHour: number;
  selectedMinute: number;
  openDropdown: 'period' | 'hour' | 'minute' | null;
  onSetOpenDropdown: (dropdown: 'period' | 'hour' | 'minute' | null) => void;
  onPeriodSelect: (period: 'AM' | 'PM') => void;
  onHourSelect: (hour: number) => void;
  onMinuteSelect: (minute: number) => void;
  onClearTime: () => void;
  pickerRef: React.RefObject<HTMLDivElement | null>;
}

export function TimePicker({
  time,
  selectedPeriod,
  selectedHour,
  selectedMinute,
  openDropdown,
  onSetOpenDropdown,
  onPeriodSelect,
  onHourSelect,
  onMinuteSelect,
  onClearTime,
  pickerRef,
}: TimePickerProps) {
  return (
    <div className="time-picker-row" ref={pickerRef}>
      {/* AM/PM 선택 */}
      <div className="time-select-wrapper">
        <button
          type="button"
          className="time-select-btn"
          onClick={() => onSetOpenDropdown(openDropdown === 'period' ? null : 'period')}
        >
          <span>{time ? selectedPeriod : '--'}</span>
          <ChevronDown size={14} />
        </button>
        {openDropdown === 'period' && (
          <div className="time-dropdown">
            {PERIODS.map((p) => (
              <div
                key={p}
                className={`time-dropdown-item ${selectedPeriod === p ? 'selected' : ''}`}
                onClick={() => onPeriodSelect(p)}
              >
                {p}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hour 선택 */}
      <div className="time-select-wrapper">
        <button
          type="button"
          className="time-select-btn"
          onClick={() => onSetOpenDropdown(openDropdown === 'hour' ? null : 'hour')}
        >
          <span>{time ? selectedHour : '--'}</span>
          <ChevronDown size={14} />
        </button>
        {openDropdown === 'hour' && (
          <div className="time-dropdown">
            {HOURS.map((h) => (
              <div
                key={h}
                className={`time-dropdown-item ${selectedHour === h ? 'selected' : ''}`}
                onClick={() => onHourSelect(h)}
              >
                {h}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Min 선택 */}
      <div className="time-select-wrapper">
        <button
          type="button"
          className="time-select-btn"
          onClick={() => onSetOpenDropdown(openDropdown === 'minute' ? null : 'minute')}
        >
          <span>{time ? String(selectedMinute).padStart(2, '0') : '--'}</span>
          <ChevronDown size={14} />
        </button>
        {openDropdown === 'minute' && (
          <div className="time-dropdown">
            {MINUTES.map((m) => (
              <div
                key={m}
                className={`time-dropdown-item ${selectedMinute === m ? 'selected' : ''}`}
                onClick={() => onMinuteSelect(m)}
              >
                {String(m).padStart(2, '0')}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clear 버튼 */}
      <button type="button" className="time-clear-btn-inline" onClick={onClearTime}>
        Clear
      </button>
    </div>
  );
}

interface RepeatSelectorProps {
  repeatType: RepeatType;
  showDropdown: boolean;
  onSetShowDropdown: (show: boolean) => void;
  onSelectType: (type: RepeatType) => void;
  pickerRef: React.RefObject<HTMLDivElement | null>;
}

export function RepeatSelector({
  repeatType,
  showDropdown,
  onSetShowDropdown,
  onSelectType,
  pickerRef,
}: RepeatSelectorProps) {
  return (
    <div className="repeat-select-wrapper" ref={pickerRef}>
      <button
        type="button"
        className="repeat-select-btn-compact"
        onClick={() => onSetShowDropdown(!showDropdown)}
      >
        <Repeat size={14} />
        <span>{REPEAT_OPTIONS.find(o => o.value === repeatType)?.label}</span>
        <ChevronDown size={14} />
      </button>
      {showDropdown && (
        <div className="repeat-dropdown">
          {REPEAT_OPTIONS.map((option) => (
            <div
              key={option.value}
              className={`repeat-dropdown-item ${repeatType === option.value ? 'selected' : ''}`}
              onClick={() => {
                onSelectType(option.value);
                onSetShowDropdown(false);
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 아이콘만 있는 반복 선택기 (숫자 표시)
interface RepeatIconButtonProps {
  repeatType: RepeatType;
  showDropdown: boolean;
  onSetShowDropdown: (show: boolean) => void;
  onSelectType: (type: RepeatType) => void;
  pickerRef: React.RefObject<HTMLDivElement | null>;
}

export function RepeatIconButton({
  repeatType,
  showDropdown,
  onSetShowDropdown,
  onSelectType,
  pickerRef,
}: RepeatIconButtonProps) {
  const isActive = repeatType !== 'none';
  const repeatNumber = getRepeatNumber(repeatType);

  return (
    <div className="icon-btn-wrapper" ref={pickerRef}>
      <button
        type="button"
        className={`icon-btn ${isActive ? 'active' : ''}`}
        onClick={() => onSetShowDropdown(!showDropdown)}
        title="Repeat"
      >
        <Repeat size={16} />
        <span className="icon-btn-badge">{repeatNumber}</span>
      </button>
      {showDropdown && (
        <div className="icon-btn-dropdown">
          {REPEAT_OPTIONS.map((option) => (
            <div
              key={option.value}
              className={`icon-btn-dropdown-item ${repeatType === option.value ? 'selected' : ''}`}
              onClick={() => {
                onSelectType(option.value);
                onSetShowDropdown(false);
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 구글 동기화 아이콘 버튼
interface GoogleSyncIconButtonProps {
  syncToGoogle: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function GoogleSyncIconButton({ syncToGoogle, onToggle, disabled }: GoogleSyncIconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-btn ${syncToGoogle ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={disabled ? undefined : onToggle}
      title={disabled ? 'Google Calendar not connected' : 'Sync to Google Calendar'}
      disabled={disabled}
    >
      <Calendar size={16} />
      <span className="icon-btn-badge google-badge">G</span>
    </button>
  );
}

// 알림 아이콘 버튼
interface ReminderIconButtonProps {
  reminderMinutes: number;
  showDropdown: boolean;
  onSetShowDropdown: (show: boolean) => void;
  onSelectMinutes: (minutes: number) => void;
  disabled?: boolean;
  pickerRef: React.RefObject<HTMLDivElement | null>;
}

export function ReminderIconButton({
  reminderMinutes,
  showDropdown,
  onSetShowDropdown,
  onSelectMinutes,
  disabled = false,
  pickerRef,
}: ReminderIconButtonProps) {
  const isActive = reminderMinutes > 0;

  return (
    <div className="icon-btn-wrapper" ref={pickerRef}>
      <button
        type="button"
        className={`icon-btn ${isActive ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && onSetShowDropdown(!showDropdown)}
        title={disabled ? 'Set time first to enable reminder' : 'Reminder'}
        disabled={disabled}
      >
        <Bell size={16} />
      </button>
      {showDropdown && !disabled && (
        <div className="icon-btn-dropdown">
          {REMINDER_OPTIONS.map((option) => (
            <div
              key={option.value}
              className={`icon-btn-dropdown-item ${reminderMinutes === option.value ? 'selected' : ''}`}
              onClick={() => {
                onSelectMinutes(option.value);
                onSetShowDropdown(false);
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ReminderSelectorProps {
  reminderMinutes: number;
  showDropdown: boolean;
  onSetShowDropdown: (show: boolean) => void;
  onSelectMinutes: (minutes: number) => void;
  disabled?: boolean;
  pickerRef: React.RefObject<HTMLDivElement | null>;
}

export function ReminderSelector({
  reminderMinutes,
  showDropdown,
  onSetShowDropdown,
  onSelectMinutes,
  disabled = false,
  pickerRef,
}: ReminderSelectorProps) {
  return (
    <div className="reminder-select-wrapper" ref={pickerRef}>
      <button
        type="button"
        className={`reminder-select-btn-compact ${reminderMinutes > 0 ? 'active' : ''}`}
        onClick={() => onSetShowDropdown(!showDropdown)}
        disabled={disabled}
        title={disabled ? 'Set time first to enable reminder' : ''}
      >
        <Bell size={14} />
        <ChevronDown size={14} />
      </button>
      {showDropdown && (
        <div className="reminder-dropdown">
          {REMINDER_OPTIONS.map((option) => (
            <div
              key={option.value}
              className={`reminder-dropdown-item ${reminderMinutes === option.value ? 'selected' : ''}`}
              onClick={() => {
                onSelectMinutes(option.value);
                onSetShowDropdown(false);
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// D-Day 아이콘 버튼
interface DDayIconButtonProps {
  isDDay: boolean;
  onToggle: () => void;
}

export function DDayIconButton({ isDDay, onToggle }: DDayIconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-btn ${isDDay ? 'active' : ''}`}
      onClick={onToggle}
      title="Show D-Day"
    >
      <Target size={16} />
      <span className="icon-btn-badge dday-badge">D-Day</span>
    </button>
  );
}

interface DDayToggleProps {
  isDDay: boolean;
  onToggle: () => void;
}

export function DDayToggle({ isDDay, onToggle }: DDayToggleProps) {
  return (
    <div className="popup-field popup-field-toggle">
      <label className="toggle-label">
        <span className="toggle-text">
          <Calendar size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Show D-Day
        </span>
        <div
          className={`toggle-switch ${isDDay ? 'active' : ''}`}
          onClick={onToggle}
        >
          <div className="toggle-knob" />
        </div>
      </label>
    </div>
  );
}

interface GoogleSyncToggleProps {
  syncToGoogle: boolean;
  onToggle: () => void;
}

export function GoogleSyncToggle({ syncToGoogle, onToggle }: GoogleSyncToggleProps) {
  return (
    <div className="popup-field popup-field-toggle">
      <label className="toggle-label">
        <span className="toggle-text">Add to Google Calendar</span>
        <div
          className={`toggle-switch ${syncToGoogle ? 'active' : ''}`}
          onClick={onToggle}
        >
          <div className="toggle-knob" />
        </div>
      </label>
    </div>
  );
}
