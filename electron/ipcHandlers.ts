// IPC Handlers for main process
import { ipcMain, BrowserWindow, screen, dialog, safeStorage, app } from 'electron';
import fs from 'fs';
import path from 'path';
import type { SimpleStore, Settings, CalendarEvent, Memo, RepeatInstanceState } from './store';
import { DEFAULT_SETTINGS } from './store';
import { enableDesktopMode, disableDesktopMode, setMemoPinnedState } from './desktopMode';

let storeRef: SimpleStore | null = null;
let mainWindowRef: BrowserWindow | null = null;
let popupWindowRef: BrowserWindow | null = null;
let memoWindowRef: BrowserWindow | null = null;

// Move/Resize intervals
let moveInterval: NodeJS.Timeout | null = null;
let resizeInterval: NodeJS.Timeout | null = null;
let resizingWindow: BrowserWindow | null = null;

const MIN_WIDTH = 300;
const MIN_HEIGHT = 400;
const MEMO_MIN_WIDTH = 280;
const MEMO_MIN_HEIGHT = 350;

// Callbacks for window operations
let saveWindowBoundsCallback: (() => void) | null = null;
let createMemoWindowCallback: ((id?: string) => void) | null = null;
let createPopupWindowCallback: ((data: { type: string; date: string; event?: CalendarEvent; x: number; y: number }) => void) | null = null;
let hidePopupCallback: (() => void) | null = null;
let closeMemoWindowCallback: (() => void) | null = null;

// Google Calendar 모듈 참조 (main.ts에서 설정)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let googleAuthRef: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let googleCalendarRef: any = null;

export function setGoogleModules(
  googleAuth: unknown,
  googleCalendar: unknown
): void {
  googleAuthRef = googleAuth;
  googleCalendarRef = googleCalendar;
}

export function initIpcHandlers(
  store: SimpleStore,
  mainWindow: BrowserWindow | null,
  callbacks: {
    saveWindowBounds: () => void;
    createMemoWindow: (id?: string) => void;
    createPopupWindow: (data: { type: string; date: string; event?: CalendarEvent; x: number; y: number }) => void;
    hidePopup: () => void;
    closeMemoWindow: () => void;
  }
): void {
  storeRef = store;
  mainWindowRef = mainWindow;
  saveWindowBoundsCallback = callbacks.saveWindowBounds;
  createMemoWindowCallback = callbacks.createMemoWindow;
  createPopupWindowCallback = callbacks.createPopupWindow;
  hidePopupCallback = callbacks.hidePopup;
  closeMemoWindowCallback = callbacks.closeMemoWindow;
}

export function setWindowRefs(
  main: BrowserWindow | null,
  popup: BrowserWindow | null,
  memo: BrowserWindow | null
): void {
  mainWindowRef = main;
  popupWindowRef = popup;
  memoWindowRef = memo;
}

// Session token file path
const SESSION_TOKEN_FILE = 'session_token.enc';

function getSessionTokenPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, SESSION_TOKEN_FILE);
}

export function registerIpcHandlers(): void {
  if (!storeRef) return;
  const store = storeRef;

  // Session Token Management (Account System)
  ipcMain.handle('save-session-token', async (_, token: string) => {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        console.error('[save-session-token] Encryption not available');
        return false;
      }
      const encrypted = safeStorage.encryptString(token);
      const tokenPath = getSessionTokenPath();
      fs.writeFileSync(tokenPath, encrypted);
      console.log('[save-session-token] Token saved successfully');
      return true;
    } catch (error) {
      console.error('[save-session-token] Error:', error);
      return false;
    }
  });

  ipcMain.handle('get-session-token', async () => {
    try {
      const tokenPath = getSessionTokenPath();
      if (!fs.existsSync(tokenPath)) {
        return null;
      }
      if (!safeStorage.isEncryptionAvailable()) {
        console.error('[get-session-token] Encryption not available');
        return null;
      }
      const encrypted = fs.readFileSync(tokenPath);
      const token = safeStorage.decryptString(encrypted);
      return token;
    } catch (error) {
      console.error('[get-session-token] Error:', error);
      return null;
    }
  });

  ipcMain.handle('delete-session-token', async () => {
    try {
      const tokenPath = getSessionTokenPath();
      if (fs.existsSync(tokenPath)) {
        fs.unlinkSync(tokenPath);
        console.log('[delete-session-token] Token deleted successfully');
      }
      return true;
    } catch (error) {
      console.error('[delete-session-token] Error:', error);
      return false;
    }
  });

  ipcMain.handle('get-google-id-token', async () => {
    try {
      if (!googleAuthRef) {
        console.error('[get-google-id-token] googleAuthRef not set');
        return null;
      }
      console.log('[get-google-id-token] Calling getIdToken...');
      const idToken = await googleAuthRef.getIdToken();
      console.log('[get-google-id-token] Result:', idToken ? `${idToken.substring(0, 20)}...` : 'null');
      return idToken;
    } catch (error) {
      console.error('[get-google-id-token] Error:', error);
      return null;
    }
  });

  // Settings
  ipcMain.handle('get-settings', () => {
    return store.get('settings') || DEFAULT_SETTINGS;
  });

  ipcMain.handle('save-settings', (_, settings: Settings) => {
    store.set('settings', settings);
    if (mainWindowRef) {
      mainWindowRef.setOpacity(settings.opacity);
      mainWindowRef.setResizable(settings.resizeMode);

      if (settings.desktopMode) {
        enableDesktopMode();
      } else {
        disableDesktopMode();
        mainWindowRef.setAlwaysOnTop(settings.alwaysOnTop);
      }
    }
    return true;
  });

  // Events
  ipcMain.handle('get-events', () => store.get('events') || []);
  ipcMain.handle('save-events', (_, events: CalendarEvent[]) => {
    store.set('events', events);
    return true;
  });

  // Memos
  ipcMain.handle('get-memos', () => store.get('memos') || []);
  ipcMain.handle('get-memo', (_, id: string) => {
    const memos: Memo[] = store.get('memos') || [];
    return memos.find(m => m.id === id) || null;
  });
  ipcMain.handle('save-memo', (_, memo: Memo) => {
    const memos: Memo[] = store.get('memos') || [];
    const index = memos.findIndex(m => m.id === memo.id);
    if (index >= 0) {
      memos[index] = memo;
    } else {
      memos.push(memo);
    }
    store.set('memos', memos);
    return true;
  });
  ipcMain.handle('delete-memo', (_, id: string) => {
    const memos: Memo[] = store.get('memos') || [];
    store.set('memos', memos.filter(m => m.id !== id));
    return true;
  });

  // Repeat Instance States (반복 인스턴스별 완료 상태)
  ipcMain.handle('get-repeat-instance-states', () => {
    return store.get('repeatInstanceStates') || [];
  });

  ipcMain.handle('set-repeat-instance-state', (_, state: RepeatInstanceState) => {
    const states: RepeatInstanceState[] = store.get('repeatInstanceStates') || [];
    const key = `${state.eventId}_${state.instanceDate}`;
    const existingIndex = states.findIndex(s => `${s.eventId}_${s.instanceDate}` === key);

    if (existingIndex >= 0) {
      states[existingIndex] = state;
    } else {
      states.push(state);
    }

    store.set('repeatInstanceStates', states);
    return true;
  });

  ipcMain.handle('delete-repeat-instance-states', (_, eventId: string) => {
    const states: RepeatInstanceState[] = store.get('repeatInstanceStates') || [];
    const filtered = states.filter(s => s.eventId !== eventId);
    store.set('repeatInstanceStates', filtered);
    return true;
  });

  // Export/Import
  ipcMain.handle('export-data', async () => {
    try {
      const result = await dialog.showSaveDialog(mainWindowRef!, {
        title: 'Export Calendar Data',
        defaultPath: `desktop-calendar-backup-${new Date().toISOString().split('T')[0]}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Cancelled' };
      }

      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        events: store.get('events') || [],
        memos: store.get('memos') || [],
        settings: store.get('settings') || {},
        repeatInstanceStates: store.get('repeatInstanceStates') || [],
      };

      fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), 'utf-8');
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('import-data', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindowRef!, {
        title: 'Import Calendar Data',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'Cancelled' };
      }

      const fileContent = fs.readFileSync(result.filePaths[0], 'utf-8');
      const importData = JSON.parse(fileContent);

      if (!importData.version) {
        return { success: false, error: 'Invalid backup file format' };
      }

      if (importData.events) store.set('events', importData.events);
      if (importData.memos) store.set('memos', importData.memos);
      if (importData.repeatInstanceStates) store.set('repeatInstanceStates', importData.repeatInstanceStates);
      if (importData.settings) {
        store.set('settings', importData.settings);
        if (mainWindowRef) {
          mainWindowRef.setOpacity(importData.settings.opacity || 0.95);
          mainWindowRef.webContents.send('settings-updated', importData.settings);
        }
      }

      if (mainWindowRef) {
        mainWindowRef.webContents.send('events-updated', importData.events || []);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Memo window
  let currentMemoId: string | null = null;
  ipcMain.on('open-memo', (_, id?: string) => {
    currentMemoId = id || null;
    createMemoWindowCallback?.(id);
  });
  ipcMain.handle('get-current-memo-id', () => currentMemoId);
  ipcMain.on('close-memo', () => closeMemoWindowCallback?.());
  ipcMain.on('set-memo-pinned', (_, pinned: boolean) => setMemoPinnedState(pinned));

  // Window controls
  ipcMain.on('minimize-window', () => mainWindowRef?.minimize());
  ipcMain.on('close-window', () => {
    const { app } = require('electron');
    app.quit();
  });

  // Popup window
  ipcMain.on('open-popup', (_, data) => createPopupWindowCallback?.(data));
  ipcMain.on('close-popup', () => hidePopupCallback?.());

  // Popup event operations
  ipcMain.handle('popup-save-event', async (_, event: CalendarEvent, syncToGoogle?: boolean) => {
    console.log('[popup-save-event] called, syncToGoogle:', syncToGoogle);
    const events = store.get('events') || [];
    const existingIndex = events.findIndex(e => e.id === event.id);

    // 새 이벤트이고 Google 동기화가 요청된 경우
    if (syncToGoogle && existingIndex < 0 && googleAuthRef && googleCalendarRef) {
      console.log('[popup-save-event] syncing to Google Calendar...');
      try {
        const accessToken = await googleAuthRef.getAccessToken();
        console.log('[popup-save-event] accessToken:', accessToken ? 'exists' : 'null');
        if (accessToken) {
          const created = await googleCalendarRef.createEvent(accessToken, {
            title: event.title,
            date: event.date,
            time: event.time,
            description: event.description,
            repeat: event.repeat,
          });
          console.log('[popup-save-event] Google event created:', created);
          event.googleEventId = created.googleEventId;
          event.isGoogleEvent = true;
        }
      } catch (error) {
        console.error('[popup-save-event] Google sync error:', error);
      }
    }

    if (existingIndex >= 0) {
      events[existingIndex] = event;
    } else {
      events.push(event);
    }

    store.set('events', events);
    if (mainWindowRef) {
      mainWindowRef.webContents.send('events-updated', events);
    }
    return true;
  });

  ipcMain.handle('popup-delete-event', (_, eventId: string) => {
    const events = store.get('events') || [];
    const filtered = events.filter(e => e.id !== eventId);
    store.set('events', filtered);
    if (mainWindowRef) {
      mainWindowRef.webContents.send('events-updated', filtered);
    }
    return true;
  });
}

export function registerMoveHandlers(): void {
  ipcMain.on('start-move', () => {
    if (!mainWindowRef) return;

    if (moveInterval) {
      clearInterval(moveInterval);
      moveInterval = null;
    }

    const startBounds = mainWindowRef.getBounds();
    const mouseStartPos = screen.getCursorScreenPoint();

    moveInterval = setInterval(() => {
      if (!mainWindowRef) {
        if (moveInterval) clearInterval(moveInterval);
        moveInterval = null;
        return;
      }

      const mousePos = screen.getCursorScreenPoint();
      const deltaX = mousePos.x - mouseStartPos.x;
      const deltaY = mousePos.y - mouseStartPos.y;

      mainWindowRef.setBounds({
        x: Math.round(startBounds.x + deltaX),
        y: Math.round(startBounds.y + deltaY),
        width: startBounds.width,
        height: startBounds.height,
      });
    }, 16);
  });

  ipcMain.on('stop-move', () => {
    if (moveInterval) {
      clearInterval(moveInterval);
      moveInterval = null;
      saveWindowBoundsCallback?.();
    }
  });
}

export function registerResizeHandlers(): void {
  ipcMain.on('start-resize', (event, direction: string) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (!senderWindow) return;

    if (resizeInterval) {
      clearInterval(resizeInterval);
      resizeInterval = null;
    }

    resizingWindow = senderWindow;
    const isMemo = senderWindow === memoWindowRef;
    const minWidth = isMemo ? MEMO_MIN_WIDTH : MIN_WIDTH;
    const minHeight = isMemo ? MEMO_MIN_HEIGHT : MIN_HEIGHT;

    const startBounds = senderWindow.getBounds();
    const mouseStartPos = screen.getCursorScreenPoint();

    resizeInterval = setInterval(() => {
      if (!resizingWindow || resizingWindow.isDestroyed()) {
        if (resizeInterval) clearInterval(resizeInterval);
        resizeInterval = null;
        return;
      }

      const mousePos = screen.getCursorScreenPoint();
      const deltaX = mousePos.x - mouseStartPos.x;
      const deltaY = mousePos.y - mouseStartPos.y;

      let newX = startBounds.x;
      let newY = startBounds.y;
      let newWidth = startBounds.width;
      let newHeight = startBounds.height;

      if (direction.includes('e')) {
        newWidth = Math.max(minWidth, startBounds.width + deltaX);
      }
      if (direction.includes('w')) {
        const potentialWidth = startBounds.width - deltaX;
        if (potentialWidth >= minWidth) {
          newWidth = potentialWidth;
          newX = startBounds.x + deltaX;
        }
      }
      if (direction.includes('s')) {
        newHeight = Math.max(minHeight, startBounds.height + deltaY);
      }
      if (direction.includes('n')) {
        const potentialHeight = startBounds.height - deltaY;
        if (potentialHeight >= minHeight) {
          newHeight = potentialHeight;
          newY = startBounds.y + deltaY;
        }
      }

      resizingWindow.setBounds({
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newWidth),
        height: Math.round(newHeight),
      });
    }, 16);
  });

  ipcMain.on('stop-resize', () => {
    if (resizeInterval) {
      clearInterval(resizeInterval);
      resizeInterval = null;
      if (resizingWindow === mainWindowRef) {
        saveWindowBoundsCallback?.();
      }
      resizingWindow = null;
    }
  });
}
