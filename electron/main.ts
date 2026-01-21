import { app, BrowserWindow, ipcMain, Tray, Menu, screen, nativeImage } from 'electron';
import type { NativeImage } from 'electron';
import path from 'path';
import fs from 'fs';

// Windows API for desktop mode
let koffi: typeof import('koffi') | null = null;
let user32: ReturnType<typeof import('koffi').load> | null = null;
let FindWindowA: ((className: string | null, windowName: string | null) => number) | null = null;
let FindWindowExA: ((parent: number, childAfter: number, className: string | null, windowName: string | null) => number) | null = null;
let SetParent: ((child: number, parent: number) => number) | null = null;
let SendMessageTimeoutA: ((hwnd: number, msg: number, wParam: number, lParam: number, flags: number, timeout: number, result: number[]) => number) | null = null;
let GetAsyncKeyState: ((vKey: number) => number) | null = null;
let GetAncestor: ((hwnd: number, flags: number) => number) | null = null;
let GetClassName: ((hwnd: number, buffer: Buffer, maxCount: number) => number) | null = null;

// WindowFromPoint: POINT 구조체를 64비트 값으로 전달 (Windows ABI에서 8바이트 struct는 레지스터로 전달)
let WindowFromPointRaw: ((pointPacked: bigint) => number) | null = null;

const VK_LBUTTON = 0x01;
const GA_ROOT = 2; // GetAncestor flag for root window
const DOUBLE_CLICK_TIME = 500; // ms

// Windows API 초기화
function initWindowsAPI() {
  if (process.platform !== 'win32') return;

  try {
    koffi = require('koffi');
    if (!koffi) return;
    user32 = koffi.load('user32.dll');

    FindWindowA = user32.func('FindWindowA', 'int', ['str', 'str']);
    FindWindowExA = user32.func('FindWindowExA', 'int', ['int', 'int', 'str', 'str']);
    SetParent = user32.func('SetParent', 'int', ['int', 'int']);
    SendMessageTimeoutA = user32.func('SendMessageTimeoutA', 'int', ['int', 'uint', 'int', 'int', 'uint', 'uint', 'int*']);
    GetAsyncKeyState = user32.func('GetAsyncKeyState', 'short', ['int']);
    GetAncestor = user32.func('GetAncestor', 'int', ['int', 'uint']);
    GetClassName = user32.func('GetClassNameA', 'int', ['int', 'uint8*', 'int']);

    // WindowFromPoint: POINT 구조체를 64비트 값으로 전달
    // Windows ABI에서 8바이트 struct는 레지스터로 전달되므로 int64로 처리
    WindowFromPointRaw = user32.func('WindowFromPoint', 'int', ['int64']);
  } catch (error) {
    console.error('Failed to load Windows API:', error);
  }
}

// WorkerW 핸들 찾기 (바탕화면 아이콘 뒤 레이어)
function getWorkerW(): number {
  if (!FindWindowA || !FindWindowExA || !SendMessageTimeoutA) return 0;

  const progman = FindWindowA('Progman', null);
  if (!progman) return 0;

  const result = [0];
  SendMessageTimeoutA(progman, 0x052C, 0, 0, 0, 1000, result);

  let workerW = 0;
  let current = FindWindowExA(0, 0, 'WorkerW', null);

  while (current) {
    const defView = FindWindowExA(current, 0, 'SHELLDLL_DefView', null);
    if (defView) {
      workerW = FindWindowExA(0, current, 'WorkerW', null);
      break;
    }
    current = FindWindowExA(0, current, 'WorkerW', null);
  }

  return workerW;
}

type BrowserWindowType = BrowserWindow;
type TrayType = Tray;

interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Settings {
  opacity: number;
  alwaysOnTop: boolean;
  desktopMode: boolean;
  theme: string;
  fontSize: number;
  resizeMode: boolean;
}

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  description?: string;
  color?: string;
}

interface StoreData {
  windowBounds?: WindowBounds;
  settings?: Settings;
  events?: CalendarEvent[];
}

// Simple JSON store
class SimpleStore {
  private filePath: string;
  private data: StoreData;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, 'config.json');
    this.data = this.load();
  }

  private load(): StoreData {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('Failed to load store:', error);
    }
    return {};
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Failed to save store:', error);
    }
  }

  get<K extends keyof StoreData>(key: K, defaultValue?: StoreData[K]): StoreData[K] | undefined {
    return this.data[key] ?? defaultValue;
  }

  set<K extends keyof StoreData>(key: K, value: StoreData[K]): void {
    this.data[key] = value;
    this.save();
  }
}

let store: SimpleStore;
let mainWindow: BrowserWindowType | null = null;
let popupWindow: BrowserWindowType | null = null;
let popupReady = false;
let pendingPopupData: { type: string; date: string; event?: CalendarEvent; x: number; y: number } | null = null;
let tray: TrayType | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Desktop Mode 관련 변수
let desktopModeEnabled = false;
let isEmbeddedInDesktop = false;
let mouseCheckInterval: NodeJS.Timeout | null = null;
let lastClickTime = 0;
let lastClickX = 0;
let lastClickY = 0;
let wasMouseDown = false;

// WorkerW에 창을 임베딩 (바탕화면 아이콘 뒤)
function embedInDesktop() {
  if (!mainWindow || !SetParent || isEmbeddedInDesktop) return false;

  const workerW = getWorkerW();
  if (workerW) {
    const hwnd = mainWindow.getNativeWindowHandle().readInt32LE(0);
    SetParent(hwnd, workerW);
    isEmbeddedInDesktop = true;
    console.log('Window embedded in desktop (behind icons)');
    return true;
  }
  return false;
}

// WorkerW에서 창을 분리
function removeFromDesktop() {
  if (!mainWindow || !SetParent || !isEmbeddedInDesktop) return;

  const hwnd = mainWindow.getNativeWindowHandle().readInt32LE(0);
  SetParent(hwnd, 0);
  isEmbeddedInDesktop = false;
  console.log('Window removed from desktop');
}

// 좌표 패킹 함수 (x, y -> int64)
// POINT 구조체를 64비트로 pack: lower 32 bits = x, upper 32 bits = y
function packPoint(x: number, y: number): bigint {
  const bigX = BigInt(Math.round(x));
  const bigY = BigInt(Math.round(y));
  // 32비트 마스킹 (음수 좌표 처리)
  const u32X = bigX & 0xFFFFFFFFn;
  const u32Y = bigY & 0xFFFFFFFFn;
  return u32X | (u32Y << 32n);
}

// 특정 좌표가 속한 모니터의 DPI 배율 구하기 (Electron API 사용)
function getScaleFactorForPoint(x: number, y: number): number {
  const display = screen.getDisplayNearestPoint({ x, y });
  return display.scaleFactor;
}

// WindowFromPoint 래퍼 함수 (DPI 보정 포함)
function windowFromPoint(logicalX: number, logicalY: number): number {
  if (!WindowFromPointRaw) return 0;

  // DPI 보정: Logical -> Physical 좌표 변환
  const scale = getScaleFactorForPoint(logicalX, logicalY);
  const physicalX = logicalX * scale;
  const physicalY = logicalY * scale;

  const packed = packPoint(physicalX, physicalY);
  return WindowFromPointRaw(packed);
}

// 창의 클래스 이름 가져오기
function getWindowClassName(hwnd: number): string {
  if (!GetClassName || !hwnd) return '';

  const buffer = Buffer.alloc(256);
  const length = GetClassName(hwnd, buffer, 256);
  if (length > 0) {
    return buffer.toString('utf8', 0, length);
  }
  return '';
}

// 클릭 위치에 다른 앱 창이 있는지 확인
function isOtherWindowAtPoint(x: number, y: number): boolean {
  if (!mainWindow || !WindowFromPointRaw) return false;
  if (!isEmbeddedInDesktop) return false; // Desktop Mode 아니면 체크 안함

  // 클릭 위치의 창 가져오기 (DPI 보정 포함)
  const hwndAtPoint = windowFromPoint(x, y);
  if (!hwndAtPoint || hwndAtPoint === 0) return false;

  // 클릭된 창의 클래스 이름 확인 (직접 클릭된 창과 루트 창 모두)
  const directClassName = getWindowClassName(hwndAtPoint);
  const rootHwnd = GetAncestor ? GetAncestor(hwndAtPoint, GA_ROOT) : hwndAtPoint;
  const rootClassName = getWindowClassName(rootHwnd || hwndAtPoint);

  const scale = getScaleFactorForPoint(x, y);
  console.log(`[Click Check] Logical: (${x}, ${y}), Scale: ${scale}, HWND: ${hwndAtPoint}, DirectClass: "${directClassName}", RootClass: "${rootClassName}"`);

  // 바탕화면 계층 구조 클래스들 (Allow List)
  const desktopClasses = [
    'WorkerW',           // 바탕화면 배경 (Windows 10/11)
    'Progman',           // 바탕화면 프로그램 매니저 (구버전 호환)
    'SHELLDLL_DefView',  // 바탕화면 뷰 컨테이너
    'SysListView32',     // 바탕화면 아이콘 영역
  ];

  // 직접 클릭된 창 또는 루트 창이 바탕화면 관련이면 허용
  const isDesktopDirect = desktopClasses.some(dc => directClassName.includes(dc));
  const isDesktopRoot = desktopClasses.some(dc => rootClassName.includes(dc));

  if (isDesktopDirect || isDesktopRoot) {
    console.log('[Click Check] Desktop-related window, allowing click ✅');
    return false; // 다른 앱 아님 -> 클릭 허용
  }

  // 다른 앱의 창이 있음
  console.log('[Click Check] Other app window detected, blocking click ❌');
  return true; // 다른 앱 있음 -> 클릭 차단
}

// 마우스가 창 영역 안에 있는지 확인하고 날짜 셀 위치 계산
function getClickedDateInWindow(): string | null {
  if (!mainWindow) return null;

  const mousePos = screen.getCursorScreenPoint();
  const bounds = mainWindow.getBounds();

  // 창 영역 안에 있는지 확인
  if (mousePos.x < bounds.x || mousePos.x > bounds.x + bounds.width ||
      mousePos.y < bounds.y || mousePos.y > bounds.y + bounds.height) {
    return null;
  }

  // 클릭 위치에 다른 앱 창이 있으면 무시
  if (isOtherWindowAtPoint(mousePos.x, mousePos.y)) {
    return null;
  }

  // 창 내부 상대 좌표
  const relX = mousePos.x - bounds.x;
  const relY = mousePos.y - bounds.y;

  // 타이틀바 높이 (약 36px), 헤더 높이 (약 50px), 요일 행 (약 30px)
  const titleBarHeight = 36;
  const headerHeight = 50;
  const weekdayRowHeight = 30;
  const gridStartY = titleBarHeight + headerHeight + weekdayRowHeight;

  // 그리드 영역 확인
  if (relY < gridStartY) return null;

  // 셀 크기 계산 (7열, 6행)
  const gridHeight = bounds.height - gridStartY;
  const cellWidth = bounds.width / 7;
  const cellHeight = gridHeight / 6;

  const col = Math.floor(relX / cellWidth);
  const row = Math.floor((relY - gridStartY) / cellHeight);

  if (col < 0 || col > 6 || row < 0 || row > 5) return null;

  // 현재 달력의 날짜 계산
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startDay = firstDayOfMonth.getDay(); // 0 = Sunday

  const dayIndex = row * 7 + col - startDay;
  const clickedDate = new Date(today.getFullYear(), today.getMonth(), dayIndex + 1);

  const year = clickedDate.getFullYear();
  const month = String(clickedDate.getMonth() + 1).padStart(2, '0');
  const day = String(clickedDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// 클릭이 창 영역 안에 있는지만 확인 (다른 앱 체크 포함)
function isClickInWindow(): { inWindow: boolean; relX: number; relY: number } {
  if (!mainWindow) return { inWindow: false, relX: 0, relY: 0 };

  const mousePos = screen.getCursorScreenPoint();
  const bounds = mainWindow.getBounds();

  // 창 영역 안에 있는지 확인
  if (mousePos.x < bounds.x || mousePos.x > bounds.x + bounds.width ||
      mousePos.y < bounds.y || mousePos.y > bounds.y + bounds.height) {
    return { inWindow: false, relX: 0, relY: 0 };
  }

  // 클릭 위치에 다른 앱 창이 있으면 무시
  if (isOtherWindowAtPoint(mousePos.x, mousePos.y)) {
    return { inWindow: false, relX: 0, relY: 0 };
  }

  const relX = mousePos.x - bounds.x;
  const relY = mousePos.y - bounds.y;

  return { inWindow: true, relX, relY };
}

// 드래그 추적을 위한 변수
let isDraggingInWindow = false;
let hasDragged = false; // 드래그가 발생했는지 추적
let mouseDownX = 0;
let mouseDownY = 0;
let lastMouseX = 0;
let lastMouseY = 0;

// 더블클릭 감지를 위한 마우스 모니터링
function startMouseMonitoring() {
  if (mouseCheckInterval) return;

  mouseCheckInterval = setInterval(() => {
    if (!mainWindow || !desktopModeEnabled || !GetAsyncKeyState) return;

    const mouseState = GetAsyncKeyState(VK_LBUTTON);
    const isMouseDown = (mouseState & 0x8000) !== 0;
    const mousePos = screen.getCursorScreenPoint();
    const bounds = mainWindow.getBounds();
    const relX = mousePos.x - bounds.x;
    const relY = mousePos.y - bounds.y;

    // 마우스 버튼이 눌린 순간 감지
    if (isMouseDown && !wasMouseDown) {
      const clickInfo = isClickInWindow();

      if (clickInfo.inWindow) {
        isDraggingInWindow = true;
        hasDragged = false;
        mouseDownX = mousePos.x;
        mouseDownY = mousePos.y;
        lastMouseX = mousePos.x;
        lastMouseY = mousePos.y;

        // mousedown 이벤트 전달
        mainWindow.webContents.send('desktop-mousedown', {
          x: clickInfo.relX,
          y: clickInfo.relY,
          screenX: mousePos.x,
          screenY: mousePos.y
        });
      }
    }

    // 마우스가 움직이는 중 (드래그)
    if (isMouseDown && isDraggingInWindow) {
      if (mousePos.x !== lastMouseX || mousePos.y !== lastMouseY) {
        // 5px 이상 움직이면 드래그로 판정
        const moveDistance = Math.abs(mousePos.x - mouseDownX) + Math.abs(mousePos.y - mouseDownY);
        if (moveDistance > 5) {
          hasDragged = true;
        }

        mainWindow.webContents.send('desktop-mousemove', {
          x: relX,
          y: relY,
          screenX: mousePos.x,
          screenY: mousePos.y
        });
        lastMouseX = mousePos.x;
        lastMouseY = mousePos.y;
      }
    }

    // 마우스 버튼을 뗀 순간
    if (!isMouseDown && wasMouseDown && isDraggingInWindow) {
      const now = Date.now();

      mainWindow.webContents.send('desktop-mouseup', {
        x: relX,
        y: relY,
        screenX: mousePos.x,
        screenY: mousePos.y
      });

      // 드래그가 없었을 때만 click 이벤트 발생
      if (!hasDragged) {
        mainWindow.webContents.send('desktop-click', {
          x: relX,
          y: relY,
          screenX: mousePos.x,
          screenY: mousePos.y
        });

        // 더블클릭 판정: 500ms 이내, 같은 위치 근처
        const timeDiff = now - lastClickTime;
        const posDiff = Math.abs(mousePos.x - lastClickX) + Math.abs(mousePos.y - lastClickY);

        if (timeDiff < DOUBLE_CLICK_TIME && posDiff < 10) {
          // 더블클릭! 날짜 확인 후 팝업 열기
          const clickedDate = getClickedDateInWindow();
          if (clickedDate) {
            console.log('Double click detected on date:', clickedDate);
            createPopupWindow({
              type: 'add-event',
              date: clickedDate,
              x: mousePos.x,
              y: mousePos.y
            });
          }
          lastClickTime = 0; // 리셋
        } else {
          lastClickTime = now;
          lastClickX = mousePos.x;
          lastClickY = mousePos.y;
        }
      }

      isDraggingInWindow = false;
      hasDragged = false;
    }

    wasMouseDown = isMouseDown;
  }, 16); // 60fps
}

function stopMouseMonitoring() {
  if (mouseCheckInterval) {
    clearInterval(mouseCheckInterval);
    mouseCheckInterval = null;
  }
}

function enableDesktopMode() {
  if (!mainWindow) return;
  desktopModeEnabled = true;
  mainWindow.setAlwaysOnTop(false);
  embedInDesktop();
  startMouseMonitoring();
}

function disableDesktopMode() {
  desktopModeEnabled = false;
  stopMouseMonitoring();
  removeFromDesktop();
  console.log('Desktop mode disabled');
}

function createWindow() {
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

  // Desktop Mode: 시작 시 바탕화면 아이콘 뒤로 임베딩
  if (isDesktopMode) {
    mainWindow.once('ready-to-show', () => {
      enableDesktopMode();
    });
  }

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('moved', saveWindowBounds);
  mainWindow.on('resized', saveWindowBounds);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function saveWindowBounds() {
  if (mainWindow) {
    const bounds = mainWindow.getBounds();
    store.set('windowBounds', bounds);
  }
}

function createTray() {
  const iconPath = isDev
    ? path.join(__dirname, '../public/icon.png')
    : path.join(__dirname, '../dist/icon.png');

  let trayIcon: NativeImage;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      trayIcon = nativeImage.createEmpty();
    }
  } catch {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Calendar',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: 'Bring to Front',
      click: () => {
        if (mainWindow) {
          mainWindow.setAlwaysOnTop(true);
          mainWindow.focus();
          // 잠시 후 다시 바탕화면 모드로 전환
          setTimeout(() => {
            if (mainWindow) {
              mainWindow.setAlwaysOnTop(false);
            }
          }, 100);
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Desktop Calendar');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    }
  });
}

// IPC Handlers
ipcMain.handle('get-settings', () => {
  return store.get('settings') || {
    opacity: 0.95,
    alwaysOnTop: false,
    desktopMode: false,
    theme: 'dark',
    fontSize: 14,
    resizeMode: false,
  };
});

ipcMain.handle('save-settings', (_, settings: Settings) => {
  store.set('settings', settings);
  if (mainWindow) {
    mainWindow.setOpacity(settings.opacity);
    mainWindow.setResizable(settings.resizeMode);

    if (settings.desktopMode) {
      // Desktop Mode: Z-order 맨 뒤로
      enableDesktopMode();
    } else {
      // Desktop Mode 해제
      disableDesktopMode();
      mainWindow.setAlwaysOnTop(settings.alwaysOnTop);
    }
  }
  return true;
});

ipcMain.handle('get-events', () => {
  return store.get('events') || [];
});

ipcMain.handle('save-events', (_, events: CalendarEvent[]) => {
  store.set('events', events);
  return true;
});

ipcMain.on('minimize-window', () => {
  mainWindow?.minimize();
});

ipcMain.on('close-window', () => {
  mainWindow?.hide();
});

// 창 이동 핸들러
let moveInterval: NodeJS.Timeout | null = null;

ipcMain.on('start-move', () => {
  if (!mainWindow) return;

  if (moveInterval) {
    clearInterval(moveInterval);
    moveInterval = null;
  }

  const startBounds = mainWindow.getBounds();
  const mouseStartPos = screen.getCursorScreenPoint();

  moveInterval = setInterval(() => {
    if (!mainWindow) {
      if (moveInterval) {
        clearInterval(moveInterval);
        moveInterval = null;
      }
      return;
    }

    const mousePos = screen.getCursorScreenPoint();
    const deltaX = mousePos.x - mouseStartPos.x;
    const deltaY = mousePos.y - mouseStartPos.y;

    mainWindow.setBounds({
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
    saveWindowBounds();
  }
});

// 팝업 창 열기 (Desktop Mode에서도 앞에 표시됨)
ipcMain.on('open-popup', (_, data: { type: string; date: string; event?: CalendarEvent; x: number; y: number }) => {
  createPopupWindow(data);
});

// 팝업 창 닫기 (숨기기로 변경)
ipcMain.on('close-popup', () => {
  hidePopup();
});

// 팝업에서 이벤트 저장
ipcMain.handle('popup-save-event', (_, event: CalendarEvent) => {
  const events = store.get('events') || [];
  const existingIndex = events.findIndex(e => e.id === event.id);

  if (existingIndex >= 0) {
    events[existingIndex] = event;
  } else {
    events.push(event);
  }

  store.set('events', events);

  // 메인 윈도우에 이벤트 업데이트 알림
  if (mainWindow) {
    mainWindow.webContents.send('events-updated', events);
  }

  return true;
});

// 팝업에서 이벤트 삭제
ipcMain.handle('popup-delete-event', (_, eventId: string) => {
  const events = store.get('events') || [];
  const filtered = events.filter(e => e.id !== eventId);
  store.set('events', filtered);

  // 메인 윈도우에 이벤트 업데이트 알림
  if (mainWindow) {
    mainWindow.webContents.send('events-updated', filtered);
  }

  return true;
});

// 팝업 창 미리 생성 (속도 개선)
function preCreatePopupWindow() {
  if (popupWindow) return;

  const savedSettings = store.get('settings');

  popupWindow = new BrowserWindow({
    width: 320,
    height: 400,
    minWidth: 280,
    minHeight: 300,
    x: -1000, // 화면 밖에 숨김
    y: -1000,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    focusable: true,
    show: false, // 처음에는 숨김
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  popupWindow.setOpacity(savedSettings?.opacity ?? 0.95);

  // 팝업 기본 페이지 로드
  if (isDev) {
    popupWindow.loadURL('http://localhost:5173/#/popup');
  } else {
    popupWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      hash: '/popup'
    });
  }

  popupWindow.webContents.on('did-finish-load', () => {
    popupReady = true;
    // 대기 중인 데이터가 있으면 바로 표시
    if (pendingPopupData) {
      showPopupWithData(pendingPopupData);
      pendingPopupData = null;
    }
  });

  // 포커스 잃으면 팝업 숨기기 (닫지 않고 재사용)
  popupWindow.on('blur', () => {
    setTimeout(() => {
      if (popupWindow && !popupWindow.isFocused()) {
        hidePopup();
      }
    }, 100);
  });

  popupWindow.on('closed', () => {
    popupWindow = null;
    popupReady = false;
  });
}

// 팝업 숨기기 (재사용 위해 닫지 않음)
function hidePopup() {
  if (popupWindow) {
    popupWindow.hide();
    popupWindow.setPosition(-1000, -1000);
  }
}

// 팝업에 데이터 전송하고 표시
function showPopupWithData(data: { type: string; date: string; event?: CalendarEvent; x: number; y: number }) {
  if (!popupWindow) {
    preCreatePopupWindow();
    pendingPopupData = data;
    return;
  }

  const popupWidth = 320;
  const popupHeight = 400;

  // 화면 경계 체크
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  let x = data.x;
  let y = data.y;

  if (x + popupWidth > screenWidth) {
    x = screenWidth - popupWidth - 10;
  }
  if (y + popupHeight > screenHeight) {
    y = screenHeight - popupHeight - 10;
  }

  // 위치 설정
  popupWindow.setPosition(Math.round(x), Math.round(y));
  popupWindow.setSize(popupWidth, popupHeight);

  // 데이터 전송
  popupWindow.webContents.send('popup-data', data);

  // 표시
  popupWindow.show();
  popupWindow.focus();
}

function createPopupWindow(data: { type: string; date: string; event?: CalendarEvent; x: number; y: number }) {
  if (popupReady && popupWindow) {
    // 이미 준비된 팝업이 있으면 바로 표시
    showPopupWithData(data);
  } else {
    // 아직 준비 안됐으면 데이터 저장 후 생성
    pendingPopupData = data;
    preCreatePopupWindow();
  }
}

// 리사이즈 핸들러
let resizeInterval: NodeJS.Timeout | null = null;
const MIN_WIDTH = 300;
const MIN_HEIGHT = 400;

ipcMain.on('start-resize', (_, direction: string) => {
  if (!mainWindow) return;

  // 이전 리사이즈가 진행 중이면 중지
  if (resizeInterval) {
    clearInterval(resizeInterval);
    resizeInterval = null;
  }

  const startBounds = mainWindow.getBounds();
  const mouseStartPos = screen.getCursorScreenPoint();

  resizeInterval = setInterval(() => {
    if (!mainWindow) {
      if (resizeInterval) {
        clearInterval(resizeInterval);
        resizeInterval = null;
      }
      return;
    }

    const mousePos = screen.getCursorScreenPoint();
    const deltaX = mousePos.x - mouseStartPos.x;
    const deltaY = mousePos.y - mouseStartPos.y;

    let newX = startBounds.x;
    let newY = startBounds.y;
    let newWidth = startBounds.width;
    let newHeight = startBounds.height;

    // 오른쪽 (e)
    if (direction.includes('e')) {
      newWidth = Math.max(MIN_WIDTH, startBounds.width + deltaX);
    }
    // 왼쪽 (w)
    if (direction.includes('w')) {
      const potentialWidth = startBounds.width - deltaX;
      if (potentialWidth >= MIN_WIDTH) {
        newWidth = potentialWidth;
        newX = startBounds.x + deltaX;
      }
    }
    // 아래쪽 (s)
    if (direction.includes('s')) {
      newHeight = Math.max(MIN_HEIGHT, startBounds.height + deltaY);
    }
    // 위쪽 (n)
    if (direction.includes('n')) {
      const potentialHeight = startBounds.height - deltaY;
      if (potentialHeight >= MIN_HEIGHT) {
        newHeight = potentialHeight;
        newY = startBounds.y + deltaY;
      }
    }

    mainWindow.setBounds({
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
    saveWindowBounds();
  }
});

app.whenReady().then(() => {
  initWindowsAPI();
  store = new SimpleStore();
  createWindow();
  createTray();
  // 팝업 미리 생성 (속도 개선)
  setTimeout(() => {
    preCreatePopupWindow();
  }, 1000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
