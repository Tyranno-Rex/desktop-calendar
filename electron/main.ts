import { app, BrowserWindow, Tray, Menu, screen, nativeImage, safeStorage, ipcMain } from 'electron';
import type { NativeImage } from 'electron';
import path from 'path';

// Modularized imports
import { SimpleStore, type CalendarEvent } from './store';
import { initDesktopMode, enableDesktopMode, setWindowRefs as setDesktopWindowRefs } from './desktopMode';
import { initNotificationScheduler, startNotificationScheduler, stopNotificationScheduler, setMainWindowRef } from './notificationScheduler';
import { performAutoBackup } from './autoBackup';
import { initIpcHandlers, registerIpcHandlers, registerMoveHandlers, registerResizeHandlers, setWindowRefs as setIpcWindowRefs } from './ipcHandlers';

// Google Calendar modules (dynamic import)
let googleAuth: typeof import('./googleAuth') | null = null;
let googleCalendar: typeof import('./googleCalendar') | null = null;

// Window references
let store: SimpleStore;
let mainWindow: BrowserWindow | null = null;
let popupWindow: BrowserWindow | null = null;
let memoWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// Popup state
let popupReady = false;
let pendingPopupData: { type: string; date: string; event?: CalendarEvent; x: number; y: number } | null = null;

// Memo state
let isMemoPinned = false;

// Helper functions
const getIsDev = () => process.env.NODE_ENV === 'development' || !app.isPackaged;

function saveWindowBounds(): void {
  if (mainWindow) {
    store.set('windowBounds', mainWindow.getBounds());
  }
}

function updateAllWindowRefs(): void {
  setDesktopWindowRefs(mainWindow, memoWindow, popupWindow, isMemoPinned);
  setIpcWindowRefs(mainWindow, popupWindow, memoWindow);
  setMainWindowRef(mainWindow);
}

// ==================== Main Window ====================
function createWindow(): void {
  const savedBounds = store.get('windowBounds');
  const savedSettings = store.get('settings');
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;

  const defaultWidth = 400;
  const defaultHeight = 500;
  const isDesktopMode = savedSettings?.desktopMode ?? false;

  mainWindow = new BrowserWindow({
    width: savedBounds?.width || defaultWidth,
    height: savedBounds?.height || defaultHeight,
    x: savedBounds?.x ?? screenWidth - defaultWidth - 50,
    y: savedBounds?.y ?? 50,
    transparent: true,
    frame: false,
    alwaysOnTop: savedSettings?.alwaysOnTop ?? false,
    skipTaskbar: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    focusable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.setOpacity(savedSettings?.opacity ?? 0.95);
  updateAllWindowRefs();

  if (isDesktopMode) {
    mainWindow.once('ready-to-show', () => enableDesktopMode());
  }

  if (getIsDev()) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('moved', saveWindowBounds);
  mainWindow.on('resized', saveWindowBounds);
  mainWindow.on('closed', () => {
    mainWindow = null;
    updateAllWindowRefs();
  });
}

// ==================== Tray ====================
function createTray(): void {
  const iconPath = getIsDev()
    ? path.join(__dirname, '../public/icon.png')
    : path.join(__dirname, '../dist/icon.png');

  let trayIcon: NativeImage;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) trayIcon = nativeImage.createEmpty();
  } catch {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Calendar',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    {
      label: 'Bring to Front',
      click: () => {
        if (mainWindow) {
          mainWindow.setAlwaysOnTop(true);
          mainWindow.focus();
          setTimeout(() => mainWindow?.setAlwaysOnTop(false), 100);
        }
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.setToolTip('Desktop Calendar');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.focus();
    } else {
      mainWindow?.show();
    }
  });
}

// ==================== Popup Window ====================
function preCreatePopupWindow(): void {
  if (popupWindow) return;

  const savedSettings = store.get('settings');

  popupWindow = new BrowserWindow({
    width: 320,
    height: 500,
    minWidth: 280,
    minHeight: 500,
    x: -1000,
    y: -1000,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    focusable: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  popupWindow.setOpacity(savedSettings?.opacity ?? 0.95);
  updateAllWindowRefs();

  if (getIsDev()) {
    popupWindow.loadURL('http://localhost:5173/#/popup');
  } else {
    popupWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/popup' });
  }

  popupWindow.webContents.on('did-finish-load', () => {
    popupReady = true;
    if (pendingPopupData) {
      showPopupWithData(pendingPopupData);
      pendingPopupData = null;
    }
  });

  popupWindow.on('blur', () => {
    setTimeout(() => {
      if (popupWindow && !popupWindow.isFocused()) hidePopup();
    }, 100);
  });

  popupWindow.on('closed', () => {
    popupWindow = null;
    popupReady = false;
    updateAllWindowRefs();
  });
}

function hidePopup(): void {
  if (popupWindow) {
    popupWindow.hide();
    popupWindow.setPosition(-1000, -1000);
  }
}

function showPopupWithData(data: { type: string; date: string; event?: CalendarEvent; x: number; y: number }): void {
  if (!popupWindow) {
    preCreatePopupWindow();
    pendingPopupData = data;
    return;
  }

  const popupWidth = 340;
  const popupHeight = 400;
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  let x = data.x;
  let y = data.y;
  if (x + popupWidth > screenWidth) x = screenWidth - popupWidth - 10;
  if (y + popupHeight > screenHeight) y = screenHeight - popupHeight - 10;

  popupWindow.setPosition(Math.round(x), Math.round(y));
  popupWindow.setSize(popupWidth, popupHeight);
  popupWindow.webContents.send('popup-data', data);
  popupWindow.show();
  popupWindow.focus();
}

function createPopupWindow(data: { type: string; date: string; event?: CalendarEvent; x: number; y: number }): void {
  if (popupReady && popupWindow) {
    showPopupWithData(data);
  } else {
    pendingPopupData = data;
    preCreatePopupWindow();
  }
}

// ==================== Memo Window ====================
function createMemoWindow(memoId?: string): void {
  if (memoWindow && !memoWindow.isDestroyed()) {
    memoWindow.show();
    memoWindow.focus();
    return;
  }

  const savedSettings = store.get('settings');
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  memoWindow = new BrowserWindow({
    width: 350,
    height: 450,
    minWidth: 280,
    minHeight: 350,
    x: Math.round(screenWidth / 2 - 175),
    y: Math.round(screenHeight / 2 - 225),
    transparent: true,
    frame: false,
    skipTaskbar: false,
    resizable: true,
    minimizable: true,
    maximizable: false,
    focusable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  memoWindow.setAlwaysOnTop(true, 'floating');
  memoWindow.setOpacity(savedSettings?.opacity ?? 0.95);
  updateAllWindowRefs();

  const hashPath = memoId ? `/memo?id=${memoId}` : '/memo';
  if (getIsDev()) {
    memoWindow.loadURL(`http://localhost:5173/#${hashPath}`);
  } else {
    memoWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: hashPath });
  }

  memoWindow.on('closed', () => {
    memoWindow = null;
    isMemoPinned = false;
    updateAllWindowRefs();
  });
}

function closeMemoWindow(): void {
  if (memoWindow && !memoWindow.isDestroyed()) {
    memoWindow.close();
    memoWindow = null;
  }
}

// ==================== Google Calendar IPC ====================
function registerGoogleIpcHandlers(): void {
  if (!googleAuth || !googleCalendar) return;

  ipcMain.handle('google-auth-status', async () => {
    if (!googleAuth!.isAuthenticated()) return false;
    return await googleAuth!.validateToken();
  });

  ipcMain.handle('google-auth-login', async () => {
    try {
      await googleAuth!.startAuthFlow();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('google-auth-logout', () => {
    googleAuth!.deleteToken();
    googleAuth!.clearValidationCache();
    return { success: true };
  });

  ipcMain.handle('google-calendar-get-events', async (_, timeMin?: string, timeMax?: string) => {
    try {
      const accessToken = await googleAuth!.getAccessToken();
      if (!accessToken) return { success: false, error: 'Not authenticated' };

      const events = await googleCalendar!.getEvents(
        accessToken,
        timeMin ? new Date(timeMin) : undefined,
        timeMax ? new Date(timeMax) : undefined
      );
      return { success: true, events };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('google-calendar-create-event', async (_, event) => {
    try {
      const accessToken = await googleAuth!.getAccessToken();
      if (!accessToken) return { success: false, error: 'Not authenticated' };

      const created = await googleCalendar!.createEvent(accessToken, event);
      return { success: true, event: created };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('google-calendar-update-event', async (_, googleEventId: string, updates) => {
    try {
      const accessToken = await googleAuth!.getAccessToken();
      if (!accessToken) return { success: false, error: 'Not authenticated' };

      const updated = await googleCalendar!.updateEvent(accessToken, googleEventId, updates);
      return { success: true, event: updated };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('google-calendar-delete-event', async (_, googleEventId: string) => {
    try {
      const accessToken = await googleAuth!.getAccessToken();
      if (!accessToken) return { success: false, error: 'Not authenticated' };

      await googleCalendar!.deleteEvent(accessToken, googleEventId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
}

// ==================== App Lifecycle ====================
app.whenReady().then(async () => {
  initDesktopMode();
  store = new SimpleStore();

  performAutoBackup(store);
  initNotificationScheduler(store, mainWindow);

  initIpcHandlers(store, mainWindow, {
    saveWindowBounds,
    createMemoWindow,
    createPopupWindow,
    hidePopup,
    closeMemoWindow,
  });

  registerIpcHandlers();
  registerMoveHandlers();
  registerResizeHandlers();

  // Load Google modules
  googleAuth = await import('./googleAuth');
  googleCalendar = await import('./googleCalendar');

  googleAuth.initGoogleAuth({
    getUserDataPath: () => app.getPath('userData'),
    encryptString: (str: string) => safeStorage.encryptString(str),
    decryptString: (buf: Buffer) => safeStorage.decryptString(buf),
    isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
    openAuthWindow: (url: string, onClose: () => void) => {
      const authWindow = new BrowserWindow({
        width: 500,
        height: 700,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      });
      authWindow.loadURL(url);
      authWindow.on('closed', onClose);
    },
  });

  registerGoogleIpcHandlers();

  createWindow();
  createTray();
  setTimeout(preCreatePopupWindow, 1000);
  startNotificationScheduler();
});

app.on('window-all-closed', () => {
  stopNotificationScheduler();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => performAutoBackup(store));

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
