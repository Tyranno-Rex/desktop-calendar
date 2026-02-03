// 반복 타입
export type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

// 반복 설정
export interface RepeatConfig {
  type: RepeatType;
  interval: number; // 반복 간격 (1 = 매일/주/월/년, 2 = 2일/주/월/년마다)
  endDate?: string; // 반복 종료일 (없으면 무한 반복)
  count?: number; // 반복 횟수 (endDate 대신 사용 가능)
}

// 알림 설정
export interface ReminderConfig {
  enabled: boolean;
  minutesBefore: number; // 몇 분 전에 알림
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
  // 알림
  reminder?: ReminderConfig;
  // D-Day
  isDDay?: boolean; // D-Day로 표시할지
}

// 메모 타입
export interface Memo {
  id: string;
  title?: string; // 메모 제목 (없으면 첫 줄 사용)
  content: string;
  createdAt: string;
  updatedAt: string;
}

// 데이터 내보내기/가져오기
export interface ExportData {
  version: string;
  exportedAt: string;
  events: CalendarEvent[];
  memos: Memo[];
  settings: Settings;
}

export interface Settings {
  opacity: number;
  alwaysOnTop: boolean;
  desktopMode: boolean;
  theme: 'dark' | 'light' | 'orange';
  fontSize: number;
  resizeMode: boolean;
  showHolidays: boolean;
  showAdjacentMonths: boolean;
  showGridLines: boolean;
  // 숨길 요일 (0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토)
  hiddenDays: number[];
  // 스케줄 패널 위치 ('left' | 'right')
  schedulePanelPosition: 'left' | 'right';
  // 패널 열림 상태에서 일정을 점으로 표시 (기본: false = 일정 상세 표시)
  showEventDots: boolean;
  // 자동 백업 활성화 (앱 시작/종료 시 자동으로 백업)
  autoBackup: boolean;
  // 미완료 과거 일정 표시 (사이드 패널 하단)
  showOverdueTasks: boolean;
}

export interface PopupData {
  type: string;
  date: string;
  event?: CalendarEvent;
  x: number;
  y: number;
}

// Google Calendar API 관련 타입
export interface GoogleCalendarEventInput {
  title: string;
  date: string;
  time?: string;
  description?: string;
}

export interface GoogleCalendarEventResponse {
  id: string;
  title: string;
  date: string;
  time?: string;
  description?: string;
  googleEventId: string;
}

export interface GoogleCalendarEventUpdates {
  title?: string;
  date?: string;
  time?: string;
  description?: string;
}

export interface ElectronAPI {
  getSettings: () => Promise<Settings>;
  saveSettings: (settings: Settings) => Promise<boolean>;
  getEvents: () => Promise<CalendarEvent[]>;
  saveEvents: (events: CalendarEvent[]) => Promise<boolean>;
  minimizeWindow: () => void;
  closeWindow: () => void;
  startResize: (direction: string) => void;
  stopResize: () => void;
  startMove: () => void;
  stopMove: () => void;
  onSettingsUpdated: (callback: (settings: Partial<Settings>) => void) => void;
  // 팝업 관련 API
  openPopup: (data: PopupData) => void;
  closePopup: () => void;
  popupSaveEvent: (event: CalendarEvent, syncToGoogle?: boolean) => Promise<boolean>;
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
  onDesktopHover: (callback: (data: { x: number; y: number; screenX: number; screenY: number }) => void) => void;
  onDesktopMouseEnter: (callback: (data: { x: number; y: number; screenX: number; screenY: number }) => void) => void;
  onDesktopMouseLeave: (callback: (data: { x: number; y: number; screenX: number; screenY: number }) => void) => void;
  // Google Calendar API
  googleAuthStatus: () => Promise<boolean>;
  googleAuthLogin: () => Promise<{ success: boolean; error?: string }>;
  googleAuthLogout: () => Promise<{ success: boolean }>;
  googleCalendarGetEvents: (timeMin?: string, timeMax?: string) => Promise<{ success: boolean; events?: GoogleCalendarEventResponse[]; error?: string }>;
  googleCalendarCreateEvent: (event: GoogleCalendarEventInput) => Promise<{ success: boolean; event?: GoogleCalendarEventResponse; error?: string }>;
  googleCalendarUpdateEvent: (googleEventId: string, updates: GoogleCalendarEventUpdates) => Promise<{ success: boolean; event?: GoogleCalendarEventResponse; error?: string }>;
  googleCalendarDeleteEvent: (googleEventId: string) => Promise<{ success: boolean; error?: string }>;
  // 메모 API (다중 메모 지원)
  getMemos: () => Promise<Memo[]>;
  getMemo: (id: string) => Promise<Memo | null>;
  saveMemo: (memo: Memo) => Promise<boolean>;
  deleteMemo: (id: string) => Promise<boolean>;
  openMemo: (id?: string) => void; // id 없으면 새 메모
  closeMemo: () => void;
  setMemoPinned: (pinned: boolean) => void; // 메모 핀 고정
  // 데이터 내보내기/가져오기
  exportData: () => Promise<{ success: boolean; path?: string; error?: string }>;
  importData: () => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
