// 반복 타입
export type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

// 반복 설정
export interface RepeatConfig {
  type: RepeatType;
  interval: number; // 반복 간격 (1 = 매일/주/월/년, 2 = 2일/주/월/년마다)
  endDate?: string; // 반복 종료일 (없으면 무한 반복)
  count?: number; // 반복 횟수 (endDate 대신 사용 가능)
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  description?: string;
  color?: string;
  completed?: boolean;
  googleEventId?: string;
  isGoogleEvent?: boolean;
  // 반복 관련
  repeat?: RepeatConfig;
  repeatGroupId?: string; // 같은 반복 일정 그룹 ID
  isRepeatInstance?: boolean; // 반복에서 생성된 인스턴스인지
}

export interface Settings {
  opacity: number;
  alwaysOnTop: boolean;
  desktopMode: boolean;
  theme: 'dark' | 'light';
  fontSize: number;
  resizeMode: boolean;
  showHolidays: boolean;
  showAdjacentMonths: boolean;
  // 숨길 요일 (0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토)
  hiddenDays: number[];
  // 스케줄 패널 위치 ('left' | 'right')
  schedulePanelPosition: 'left' | 'right';
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
  onDesktopDblClick: (callback: (data: { x: number; y: number; screenX: number; screenY: number }) => void) => void;
  // Google Calendar API
  googleAuthStatus: () => Promise<boolean>;
  googleAuthLogin: () => Promise<{ success: boolean; error?: string }>;
  googleAuthLogout: () => Promise<{ success: boolean }>;
  googleCalendarGetEvents: (timeMin?: string, timeMax?: string) => Promise<{ success: boolean; events?: any[]; error?: string }>;
  googleCalendarCreateEvent: (event: any) => Promise<{ success: boolean; event?: any; error?: string }>;
  googleCalendarUpdateEvent: (googleEventId: string, updates: any) => Promise<{ success: boolean; event?: any; error?: string }>;
  googleCalendarDeleteEvent: (googleEventId: string) => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
