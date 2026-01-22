export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  description?: string;
  color?: string;
  completed?: boolean;
}

export interface Settings {
  opacity: number;
  alwaysOnTop: boolean;
  desktopMode: boolean;
  theme: 'dark' | 'light';
  fontSize: number;
  resizeMode: boolean;
}

export interface PopupData {
  type: string;
  date: string;
  event?: CalendarEvent;
  x: number;
  y: number;
}

export interface ElectronAPI {
  getSettings: () => Promise<Settings>;
  saveSettings: (settings: Settings) => Promise<boolean>;
  getEvents: () => Promise<CalendarEvent[]>;
  saveEvents: (events: CalendarEvent[]) => Promise<boolean>;
  minimizeWindow: () => void;
  closeWindow: () => void;
  sendToDesktop: () => void;
  startResize: (direction: string) => void;
  stopResize: () => void;
  startMove: () => void;
  stopMove: () => void;
  onSettingsUpdated: (callback: (settings: Partial<Settings>) => void) => void;
  // 팝업 관련 API
  openPopup: (data: PopupData) => void;
  closePopup: () => void;
  popupSaveEvent: (event: CalendarEvent) => Promise<boolean>;
  popupDeleteEvent: (eventId: string) => Promise<boolean>;
  onEventsUpdated: (callback: (events: CalendarEvent[]) => void) => void;
  // 팝업 데이터 수신 (미리 로드된 팝업용)
  onPopupData: (callback: (data: PopupData) => void) => void;
  // Desktop Mode 마우스 이벤트
  onDesktopClick: (callback: (data: { x: number; y: number; screenX: number; screenY: number }) => void) => void;
  onDesktopMouseDown: (callback: (data: { x: number; y: number; screenX: number; screenY: number }) => void) => void;
  onDesktopMouseMove: (callback: (data: { x: number; y: number; screenX: number; screenY: number }) => void) => void;
  onDesktopMouseUp: (callback: (data: { x: number; y: number; screenX: number; screenY: number }) => void) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
