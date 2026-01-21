import { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import type { CalendarEvent } from '../../types';
import './Popup.css';

// HSL to Hex 변환
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Hex to HSL 변환
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 200, s: 70, l: 50 };

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function EventPopup() {
  const [date, setDate] = useState<Date>(new Date());
  const [eventId, setEventId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#4a9eff');
  const [hue, setHue] = useState(210);
  const [isEdit, setIsEdit] = useState(false);

  const colorBarRef = useRef<HTMLDivElement>(null);
  const [isDraggingColor, setIsDraggingColor] = useState(false);

  useEffect(() => {
    // URL에서 파라미터 추출
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.split('?')[1] || '');

    const dateStr = params.get('date');
    const eventIdParam = params.get('eventId');

    if (dateStr) {
      setDate(new Date(dateStr));
    }

    if (eventIdParam) {
      setEventId(eventIdParam);
      setIsEdit(true);
      loadEvent(eventIdParam);
    }
  }, []);

  // 색상이 변경될 때 hue 업데이트
  useEffect(() => {
    const hsl = hexToHsl(color);
    setHue(hsl.h);
  }, []);

  const loadEvent = async (id: string) => {
    const events = await window.electronAPI?.getEvents();
    const event = events?.find(e => e.id === id);
    if (event) {
      setTitle(event.title);
      setDescription(event.description || '');
      if (event.color) {
        setColor(event.color);
        const hsl = hexToHsl(event.color);
        setHue(hsl.h);
      }
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return;

    const event: CalendarEvent = {
      id: eventId || crypto.randomUUID(),
      title: title.trim(),
      date: format(date, 'yyyy-MM-dd'),
      description: description.trim() || undefined,
      color,
    };

    await window.electronAPI?.popupSaveEvent(event);
    window.electronAPI?.closePopup();
  };

  const handleDelete = async () => {
    if (eventId) {
      await window.electronAPI?.popupDeleteEvent(eventId);
      window.electronAPI?.closePopup();
    }
  };

  const handleClose = () => {
    window.electronAPI?.closePopup();
  };

  // 리사이즈 핸들러
  const handleResizeStart = (direction: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    window.electronAPI?.startResize(direction);

    const handleMouseUp = () => {
      window.electronAPI?.stopResize();
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mouseup', handleMouseUp);
  };

  // 색상 바 클릭/드래그 핸들러
  const updateColorFromPosition = useCallback((clientX: number) => {
    if (!colorBarRef.current) return;

    const rect = colorBarRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const newHue = Math.round((x / rect.width) * 360);

    setHue(newHue);
    setColor(hslToHex(newHue, 70, 50));
  }, []);

  const handleColorBarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingColor(true);
    updateColorFromPosition(e.clientX);
  };

  useEffect(() => {
    if (!isDraggingColor) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateColorFromPosition(e.clientX);
    };

    const handleMouseUp = () => {
      setIsDraggingColor(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingColor, updateColorFromPosition]);

  return (
    <div className="popup-container">
      {/* 리사이즈 핸들 */}
      <div className="resize-handle resize-n" onMouseDown={handleResizeStart('n')} />
      <div className="resize-handle resize-s" onMouseDown={handleResizeStart('s')} />
      <div className="resize-handle resize-e" onMouseDown={handleResizeStart('e')} />
      <div className="resize-handle resize-w" onMouseDown={handleResizeStart('w')} />
      <div className="resize-handle resize-ne" onMouseDown={handleResizeStart('ne')} />
      <div className="resize-handle resize-nw" onMouseDown={handleResizeStart('nw')} />
      <div className="resize-handle resize-se" onMouseDown={handleResizeStart('se')} />
      <div className="resize-handle resize-sw" onMouseDown={handleResizeStart('sw')} />

      <div className="popup-header">
        <div className="popup-date">
          <span className="popup-day">{format(date, 'd')}</span>
          <div className="popup-date-info">
            <span className="popup-weekday">{format(date, 'EEEE')}</span>
            <span className="popup-month">{format(date, 'MMMM yyyy')}</span>
          </div>
        </div>
        <button className="popup-close" onClick={handleClose}>×</button>
      </div>

      <div className="popup-content">
        <div className="popup-field">
          <input
            type="text"
            placeholder="Event title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="popup-input"
            autoFocus
          />
        </div>

        <div className="popup-field">
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="popup-textarea"
            rows={3}
          />
        </div>

        <div className="popup-field">
          <label className="popup-label">Color</label>
          <div className="color-picker-container">
            <div
              className="color-bar"
              ref={colorBarRef}
              onMouseDown={handleColorBarMouseDown}
            >
              <div
                className="color-bar-thumb"
                style={{
                  left: `${(hue / 360) * 100}%`,
                  backgroundColor: color
                }}
              />
            </div>
            <div
              className="color-preview"
              style={{ backgroundColor: color }}
            />
          </div>
        </div>
      </div>

      <div className="popup-footer">
        {isEdit && (
          <button className="popup-btn popup-btn-delete" onClick={handleDelete}>
            Delete
          </button>
        )}
        <button className="popup-btn popup-btn-cancel" onClick={handleClose}>
          Cancel
        </button>
        <button
          className="popup-btn popup-btn-save"
          onClick={handleSave}
          disabled={!title.trim()}
        >
          {isEdit ? 'Save' : 'Add'}
        </button>
      </div>
    </div>
  );
}
