import { contextBridge, ipcRenderer } from 'electron';

// Types are defined in main.ts and src/types/index.ts
// Using inline types here to avoid build complexity

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  description?: string;
  color?: string;
}

interface Settings {
  opacity: number;
  alwaysOnTop: boolean;
  desktopMode: boolean;
  theme: string;
  fontSize: number;
}

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: Settings): Promise<boolean> => ipcRenderer.invoke('save-settings', settings),
  getEvents: (): Promise<CalendarEvent[]> => ipcRenderer.invoke('get-events'),
  saveEvents: (events: CalendarEvent[]): Promise<boolean> => ipcRenderer.invoke('save-events', events),
  minimizeWindow: (): void => ipcRenderer.send('minimize-window'),
  closeWindow: (): void => ipcRenderer.send('close-window'),
  sendToDesktop: (): void => ipcRenderer.send('send-to-desktop'),
  startResize: (direction: string): void => ipcRenderer.send('start-resize', direction),
  stopResize: (): void => ipcRenderer.send('stop-resize'),
  onSettingsUpdated: (callback: (settings: Partial<Settings>) => void): void => {
    ipcRenderer.on('settings-updated', (_, settings) => callback(settings));
  },
  // 팝업 관련 API
  openPopup: (data: { type: string; date: string; event?: CalendarEvent; x: number; y: number }): void => {
    ipcRenderer.send('open-popup', data);
  },
  closePopup: (): void => ipcRenderer.send('close-popup'),
  popupSaveEvent: (event: CalendarEvent): Promise<boolean> => ipcRenderer.invoke('popup-save-event', event),
  popupDeleteEvent: (eventId: string): Promise<boolean> => ipcRenderer.invoke('popup-delete-event', eventId),
  onEventsUpdated: (callback: (events: CalendarEvent[]) => void): void => {
    ipcRenderer.on('events-updated', (_, events) => callback(events));
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
});
