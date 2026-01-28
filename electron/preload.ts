import { contextBridge, ipcRenderer } from 'electron';

// Types are defined in main.ts and src/types/index.ts
// Using inline types here to avoid build complexity

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  description?: string;
  color?: string;
  completed?: boolean;
  googleEventId?: string;
  isGoogleEvent?: boolean;
  repeat?: {
    type: string;
    interval: number;
    endDate?: string;
  };
  repeatGroupId?: string;
  isRepeatInstance?: boolean;
  reminder?: {
    enabled: boolean;
    minutesBefore: number;
  };
}

interface Settings {
  opacity: number;
  alwaysOnTop: boolean;
  desktopMode: boolean;
  theme: string;
  fontSize: number;
  resizeMode: boolean;
  showHolidays: boolean;
  showAdjacentMonths: boolean;
  showGridLines: boolean;
  hiddenDays: number[];
  schedulePanelPosition: 'left' | 'right';
}

interface Memo {
  id: string;
  title?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: Settings): Promise<boolean> => ipcRenderer.invoke('save-settings', settings),
  getEvents: (): Promise<CalendarEvent[]> => ipcRenderer.invoke('get-events'),
  saveEvents: (events: CalendarEvent[]): Promise<boolean> => ipcRenderer.invoke('save-events', events),
  minimizeWindow: (): void => ipcRenderer.send('minimize-window'),
  closeWindow: (): void => ipcRenderer.send('close-window'),
  startResize: (direction: string): void => ipcRenderer.send('start-resize', direction),
  stopResize: (): void => ipcRenderer.send('stop-resize'),
  startMove: (): void => ipcRenderer.send('start-move'),
  stopMove: (): void => ipcRenderer.send('stop-move'),
  onSettingsUpdated: (callback: (settings: Partial<Settings>) => void): void => {
    ipcRenderer.on('settings-updated', (_, settings) => callback(settings));
  },
  // 팝업 관련 API
  openPopup: (data: { type: string; date: string; event?: CalendarEvent; x: number; y: number }): void => {
    ipcRenderer.send('open-popup', data);
  },
  closePopup: (): void => ipcRenderer.send('close-popup'),
  popupSaveEvent: (event: CalendarEvent, syncToGoogle?: boolean): Promise<boolean> => ipcRenderer.invoke('popup-save-event', event, syncToGoogle),
  popupDeleteEvent: (eventId: string): Promise<boolean> => ipcRenderer.invoke('popup-delete-event', eventId),
  onEventsUpdated: (callback: (events: CalendarEvent[]) => void): void => {
    ipcRenderer.on('events-updated', (_, events) => callback(events));
  },
  // 팝업 데이터 수신 (미리 로드된 팝업용)
  onPopupData: (callback: (data: { type: string; date: string; event?: CalendarEvent; x: number; y: number }) => void): void => {
    ipcRenderer.on('popup-data', (_, data) => callback(data));
  },
  // Desktop Mode 마우스 이벤트
  onDesktopClick: (callback: (data: { x: number; y: number; screenX: number; screenY: number }) => void): void => {
    ipcRenderer.on('desktop-click', (_, data) => callback(data));
  },
  onDesktopMouseDown: (callback: (data: { x: number; y: number; screenX: number; screenY: number }) => void): void => {
    ipcRenderer.on('desktop-mousedown', (_, data) => callback(data));
  },
  onDesktopMouseMove: (callback: (data: { x: number; y: number; screenX: number; screenY: number }) => void): void => {
    ipcRenderer.on('desktop-mousemove', (_, data) => callback(data));
  },
  onDesktopMouseUp: (callback: (data: { x: number; y: number; screenX: number; screenY: number }) => void): void => {
    ipcRenderer.on('desktop-mouseup', (_, data) => callback(data));
  },
  onDesktopDblClick: (callback: (data: { x: number; y: number; screenX: number; screenY: number }) => void): void => {
    ipcRenderer.on('desktop-dblclick', (_, data) => callback(data));
  },

  // Google Calendar API
  googleAuthStatus: (): Promise<boolean> => ipcRenderer.invoke('google-auth-status'),
  googleAuthLogin: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('google-auth-login'),
  googleAuthLogout: (): Promise<{ success: boolean }> => ipcRenderer.invoke('google-auth-logout'),
  googleCalendarGetEvents: (timeMin?: string, timeMax?: string): Promise<{ success: boolean; events?: any[]; error?: string }> =>
    ipcRenderer.invoke('google-calendar-get-events', timeMin, timeMax),
  googleCalendarCreateEvent: (event: any): Promise<{ success: boolean; event?: any; error?: string }> =>
    ipcRenderer.invoke('google-calendar-create-event', event),
  googleCalendarUpdateEvent: (googleEventId: string, updates: any): Promise<{ success: boolean; event?: any; error?: string }> =>
    ipcRenderer.invoke('google-calendar-update-event', googleEventId, updates),
  googleCalendarDeleteEvent: (googleEventId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('google-calendar-delete-event', googleEventId),

  // 메모 API (다중 메모 지원)
  getMemos: (): Promise<Memo[]> => ipcRenderer.invoke('get-memos'),
  getMemo: (id: string): Promise<Memo | null> => ipcRenderer.invoke('get-memo', id),
  saveMemo: (memo: Memo): Promise<boolean> => ipcRenderer.invoke('save-memo', memo),
  deleteMemo: (id: string): Promise<boolean> => ipcRenderer.invoke('delete-memo', id),
  openMemo: (id?: string): void => ipcRenderer.send('open-memo', id),
  closeMemo: (): void => ipcRenderer.send('close-memo'),
  setMemoPinned: (pinned: boolean): void => ipcRenderer.send('set-memo-pinned', pinned),
});
