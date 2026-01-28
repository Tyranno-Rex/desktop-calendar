import { app, BrowserWindow, ipcMain, Tray, Menu, screen, nativeImage, safeStorage, Notification } from 'electron';
import type { NativeImage } from 'electron';
import path from 'path';
import fs from 'fs';

// Google Calendar 연동 - 동적 import 사용
let googleAuth: typeof import('./googleAuth') | null = null;
let googleCalendar: typeof import('./googleCalendar') | null = null;

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
  showHolidays: boolean;
  showAdjacentMonths: boolean;
  showGridLines: boolean;
  hiddenDays: number[];
  schedulePanelPosition: 'left' | 'right';
  showEventDots: boolean;
}

interface ReminderConfig {
  enabled: boolean;
  minutesBefore: number;
}

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
  reminder?: ReminderConfig;
}

interface Memo {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface StoreData {
  windowBounds?: WindowBounds;
  settings?: Settings;
  events?: CalendarEvent[];
  memo?: Memo; // 레거시 (단일 메모) - 마이그레이션용
  memos?: Memo[]; // 다중 메모
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
let memoWindow: BrowserWindowType | null = null;
let tray: TrayType | null = null;

// getIsDev()는 함수로 변경 (app 초기화 후에 호출해야 함)
const getIsDev = () => process.env.NODE_ENV === 'development' || !app.isPackaged;

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

  // 우리 앱의 메모/팝업 창인지 확인 - bounds 기반 체크 (hwnd보다 안정적)
  // 드래그 중에 마우스가 창 테두리를 벗어나도 일관되게 처리
  if (memoWindow && !memoWindow.isDestroyed()) {
    const memoBounds = memoWindow.getBounds();
    const isInMemoBounds = x >= memoBounds.x && x <= memoBounds.x + memoBounds.width &&
                           y >= memoBounds.y && y <= memoBounds.y + memoBounds.height;
    if (isInMemoBounds) {
      return true; // 메모 창 영역 안에 있음 -> 메인 창 클릭 차단
    }
  }
  if (popupWindow && !popupWindow.isDestroyed()) {
    const popupBounds = popupWindow.getBounds();
    const isInPopupBounds = x >= popupBounds.x && x <= popupBounds.x + popupBounds.width &&
                            y >= popupBounds.y && y <= popupBounds.y + popupBounds.height;
    if (isInPopupBounds) {
      return true; // 팝업 창 영역 안에 있음 -> 메인 창 클릭 차단
    }
  }

  // 클릭 위치의 창 가져오기 (DPI 보정 포함)
  const hwndAtPoint = windowFromPoint(x, y);
  if (!hwndAtPoint || hwndAtPoint === 0) return false;

  // 클릭된 창의 클래스 이름 확인 (직접 클릭된 창과 루트 창 모두)
  const directClassName = getWindowClassName(hwndAtPoint);
  const rootHwnd = GetAncestor ? GetAncestor(hwndAtPoint, GA_ROOT) : hwndAtPoint;
  const rootClassName = getWindowClassName(rootHwnd || hwndAtPoint);

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
    return false; // 다른 앱 아님 -> 클릭 허용
  }

  // 다른 앱의 창이 있음
  return true; // 다른 앱 있음 -> 클릭 차단
}

// 클릭이 창 영역 안에 있는지만 확인 (다른 앱 체크 포함)
function isClickInWindow(): { inWindow: boolean; relX: number; relY: number } {
  if (!mainWindow) return { inWindow: false, relX: 0, relY: 0 };

  const mousePos = screen.getCursorScreenPoint();
  const bounds = mainWindow.getBounds();

  // 창 영역 안에 있는지 확인
  const isInBounds = mousePos.x >= bounds.x && mousePos.x <= bounds.x + bounds.width &&
                     mousePos.y >= bounds.y && mousePos.y <= bounds.y + bounds.height;

  if (!isInBounds) {
    return { inWindow: false, relX: 0, relY: 0 };
  }

  // Desktop Mode에서 다른 앱이 앞에 있으면 클릭 무시
  if (isEmbeddedInDesktop) {
    if (isOtherWindowAtPoint(mousePos.x, mousePos.y)) {
      return { inWindow: false, relX: 0, relY: 0 };
    }
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
let wasMouseInWindow = false; // 마우스가 창 안에 있었는지 추적

// 더블클릭 감지를 위한 마우스 모니터링
function startMouseMonitoring() {
  if (mouseCheckInterval) return;

  mouseCheckInterval = setInterval(() => {
    if (!mainWindow || !desktopModeEnabled || !GetAsyncKeyState) return;

    // 메모 창이나 팝업 창이 포커스를 가지고 있거나, 메모가 핀 고정되어 있으면 마우스 모니터링 스킵
    // 이렇게 하면 메모/팝업 창의 드래그가 메인 창과 간섭하지 않음
    if (memoWindow && !memoWindow.isDestroyed()) {
      // 포커스가 있거나 핀 고정 상태면 스킵
      if (memoWindow.isFocused() || isMemoPinned) {
        wasMouseDown = false;
        isDraggingInWindow = false;
        return;
      }
    }
    if (popupWindow && !popupWindow.isDestroyed() && popupWindow.isFocused()) {
      wasMouseDown = false;
      isDraggingInWindow = false;
      return;
    }

    const mouseState = GetAsyncKeyState(VK_LBUTTON);
    const isMouseDown = (mouseState & 0x8000) !== 0;
    const mousePos = screen.getCursorScreenPoint();
    const bounds = mainWindow.getBounds();

    // 마우스가 창 위에 있는지 확인 (휠 스크롤 지원)
    const clickInfo = isClickInWindow();
    const isMouseInWindow = clickInfo.inWindow;

    // 마우스가 창 안으로 들어왔을 때 (휠 이벤트 받기 위해)
    if (isMouseInWindow && !wasMouseInWindow && !isDraggingInWindow) {
      mainWindow.setIgnoreMouseEvents(false);
    }
    // 마우스가 창 밖으로 나갔을 때
    if (!isMouseInWindow && wasMouseInWindow && !isDraggingInWindow) {
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
    }
    wasMouseInWindow = isMouseInWindow;
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

        // 드래그 시작 시 마우스 이벤트 캡처 (바탕화면 선택 방지)
        mainWindow.setIgnoreMouseEvents(false);

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
          // 더블클릭! renderer에 이벤트 전달 (renderer가 data-date를 찾아서 팝업 열기)
          mainWindow.webContents.send('desktop-dblclick', {
            x: relX,
            y: relY,
            screenX: mousePos.x,
            screenY: mousePos.y
          });
          lastClickTime = 0; // 리셋
        } else {
          lastClickTime = now;
          lastClickX = mousePos.x;
          lastClickY = mousePos.y;
        }
      }

      isDraggingInWindow = false;
      hasDragged = false;

      // 드래그 끝난 후: 마우스가 창 밖에 있으면 통과 모드로
      const stillInWindow = isClickInWindow().inWindow;
      if (!stillInWindow) {
        mainWindow.setIgnoreMouseEvents(true, { forward: true });
      }
      // 창 안에 있으면 setIgnoreMouseEvents(false) 유지 (휠 스크롤 가능)
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
  // Desktop Mode: 마우스 이벤트 통과 모드 활성화 (클릭이 바탕화면으로 전달됨)
  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  embedInDesktop();
  startMouseMonitoring();
}

function disableDesktopMode() {
  desktopModeEnabled = false;
  stopMouseMonitoring();
  removeFromDesktop();

  // 마우스 이벤트 통과 모드 해제 (일반 모드에서는 직접 클릭 가능하도록)
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(false);
  }
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
  });
}

function saveWindowBounds() {
  if (mainWindow) {
    const bounds = mainWindow.getBounds();
    store.set('windowBounds', bounds);
  }
}

function createTray() {
  const iconPath = getIsDev()
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

// IPC Handlers - app.whenReady() 이후에 등록됨
function registerIpcHandlers() {
  ipcMain.handle('get-settings', () => {
    return store.get('settings') || {
      opacity: 0.95,
      alwaysOnTop: false,
      desktopMode: false,
      theme: 'dark',
      fontSize: 14,
      resizeMode: false,
      showHolidays: true,
      showAdjacentMonths: true,
      hiddenDays: [],
      schedulePanelPosition: 'right',
      showEventDots: false,
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

  // 메모 API (다중 메모 지원)
  ipcMain.handle('get-memos', () => {
    return store.get('memos') || [];
  });

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
    const filtered = memos.filter(m => m.id !== id);
    store.set('memos', filtered);
    return true;
  });

  // 메모 팝업 창
  let currentMemoId: string | null = null;

  ipcMain.on('open-memo', (_, id?: string) => {
    currentMemoId = id || null;
    createMemoWindow(id);
  });

  ipcMain.handle('get-current-memo-id', () => {
    return currentMemoId;
  });

  ipcMain.on('close-memo', () => {
    closeMemoWindow();
  });

  // 메모 핀 고정/해제
  ipcMain.on('set-memo-pinned', (_, pinned: boolean) => {
    setMemoPinned(pinned);
  });

  ipcMain.on('minimize-window', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('close-window', () => {
    app.quit();
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
  ipcMain.handle('popup-save-event', async (_, event: CalendarEvent, syncToGoogle?: boolean) => {
    const events = store.get('events') || [];
    const existingIndex = events.findIndex(e => e.id === event.id);

    // Google Calendar 동기화 요청 시 (새 이벤트만)
    if (syncToGoogle && googleAuth && googleCalendar && existingIndex < 0) {
      try {
        const accessToken = await googleAuth.getAccessToken();
        if (accessToken) {
          const created = await googleCalendar.createEvent(accessToken, {
            id: event.id,
            title: event.title,
            date: event.date,
            time: event.time,
            description: event.description,
          });
          if (created && created.googleEventId) {
            event.googleEventId = created.googleEventId;
            event.isGoogleEvent = true;
          }
        }
      } catch (error) {
        console.error('Failed to create Google event:', error);
      }
    }

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
}

// 창 이동 핸들러 - app.whenReady() 이후에 등록됨
let moveInterval: NodeJS.Timeout | null = null;

function registerMoveHandlers() {
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
}

// 팝업 창 미리 생성 (속도 개선)
function preCreatePopupWindow() {
  if (popupWindow) return;

  const savedSettings = store.get('settings');

  popupWindow = new BrowserWindow({
    width: 320,
    height: 560,
    minWidth: 280,
    minHeight: 480,
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
  if (getIsDev()) {
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

  const popupWidth = 340;
  const popupHeight = 520;

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

// ==================== 메모 팝업 창 ====================
function createMemoWindow(memoId?: string) {
  // 이미 열려있으면 포커스만
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

  // 메모 창은 'floating' 레벨로 설정하여 다른 alwaysOnTop 창보다 위에 표시
  memoWindow.setAlwaysOnTop(true, 'floating');
  memoWindow.setOpacity(savedSettings?.opacity ?? 0.95);

  // 메모 페이지 로드 (id가 있으면 쿼리 파라미터로 전달)
  const hashPath = memoId ? `/memo?id=${memoId}` : '/memo';
  if (getIsDev()) {
    memoWindow.loadURL(`http://localhost:5173/#${hashPath}`);
  } else {
    memoWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      hash: hashPath
    });
  }

  memoWindow.on('closed', () => {
    memoWindow = null;
    isMemoPinned = false;
  });
}

function closeMemoWindow() {
  if (memoWindow && !memoWindow.isDestroyed()) {
    memoWindow.close();
    memoWindow = null;
  }
}

// 메모 핀 고정 상태
let isMemoPinned = false;

function setMemoPinned(pinned: boolean) {
  if (!memoWindow || memoWindow.isDestroyed()) return;

  isMemoPinned = pinned;

  if (pinned) {
    // 핀 고정: 다른 창 뒤로 이동하되 클릭은 가능하게 유지
    memoWindow.setAlwaysOnTop(false);
    memoWindow.setResizable(false);
    memoWindow.setMovable(false);
  } else {
    // 핀 해제: 일반 창으로 복원
    memoWindow.setResizable(true);
    memoWindow.setMovable(true);
    memoWindow.setAlwaysOnTop(true, 'floating');
    memoWindow.focus();
  }
}

// 리사이즈 핸들러 - app.whenReady() 이후에 등록됨
let resizeInterval: NodeJS.Timeout | null = null;
let resizingWindow: BrowserWindowType | null = null;
const MIN_WIDTH = 300;
const MIN_HEIGHT = 400;
const MEMO_MIN_WIDTH = 280;
const MEMO_MIN_HEIGHT = 350;

function registerResizeHandlers() {
  ipcMain.on('start-resize', (event, direction: string) => {
    // 어떤 창에서 호출했는지 확인
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    console.log('[start-resize] direction:', direction, 'senderWindow:', senderWindow ? 'found' : 'null', 'isMemo:', senderWindow === memoWindow, 'isMain:', senderWindow === mainWindow);
    if (!senderWindow) return;

    // 이전 리사이즈가 진행 중이면 중지
    if (resizeInterval) {
      clearInterval(resizeInterval);
      resizeInterval = null;
    }

    resizingWindow = senderWindow;
    const isMemo = senderWindow === memoWindow;
    const minWidth = isMemo ? MEMO_MIN_WIDTH : MIN_WIDTH;
    const minHeight = isMemo ? MEMO_MIN_HEIGHT : MIN_HEIGHT;

    const startBounds = senderWindow.getBounds();
    const mouseStartPos = screen.getCursorScreenPoint();
    console.log('[start-resize] startBounds:', startBounds, 'mouseStartPos:', mouseStartPos);

    resizeInterval = setInterval(() => {
      if (!resizingWindow || resizingWindow.isDestroyed()) {
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
        newWidth = Math.max(minWidth, startBounds.width + deltaX);
      }
      // 왼쪽 (w)
      if (direction.includes('w')) {
        const potentialWidth = startBounds.width - deltaX;
        if (potentialWidth >= minWidth) {
          newWidth = potentialWidth;
          newX = startBounds.x + deltaX;
        }
      }
      // 아래쪽 (s)
      if (direction.includes('s')) {
        newHeight = Math.max(minHeight, startBounds.height + deltaY);
      }
      // 위쪽 (n)
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
    console.log('[stop-resize] called, resizingWindow:', resizingWindow ? 'exists' : 'null');
    if (resizeInterval) {
      clearInterval(resizeInterval);
      resizeInterval = null;
      // 메인 윈도우 크기만 저장 (메모 창은 저장 안함)
      if (resizingWindow === mainWindow) {
        saveWindowBounds();
      }
      resizingWindow = null;
    }
  });
}

// ==================== Notification Scheduler ====================
// 이미 표시한 알림 추적 (중복 방지)
const shownNotifications = new Set<string>();
let notificationCheckInterval: NodeJS.Timeout | null = null;

// 반복 일정이 특정 날짜에 해당하는지 확인
function isDateInRepeatSchedule(targetDateStr: string, event: CalendarEvent): boolean {
  if (!event.repeat || event.repeat.type === 'none') {
    return event.date === targetDateStr;
  }

  const parseLocalDateString = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  };

  const targetDate = parseLocalDateString(targetDateStr);
  const startDate = parseLocalDateString(event.date);
  const { type, interval, endDate } = event.repeat;

  // 시작일 이전이면 false
  if (targetDate < startDate) return false;

  // 종료일 이후면 false
  if (endDate) {
    const end = parseLocalDateString(endDate);
    if (targetDate > end) return false;
  }

  // 시작일과 같으면 true
  if (targetDateStr === event.date) return true;

  // 반복 패턴에 맞는지 확인
  const intervalNum = interval || 1;
  switch (type) {
    case 'daily': {
      const diffDays = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays % intervalNum === 0;
    }
    case 'weekly': {
      const diffDays = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays % (intervalNum * 7) === 0;
    }
    case 'monthly': {
      if (targetDate.getDate() !== startDate.getDate()) return false;
      const monthsDiff = (targetDate.getFullYear() - startDate.getFullYear()) * 12 +
                         (targetDate.getMonth() - startDate.getMonth());
      return monthsDiff >= 0 && monthsDiff % intervalNum === 0;
    }
    case 'yearly': {
      if (targetDate.getMonth() !== startDate.getMonth() ||
          targetDate.getDate() !== startDate.getDate()) return false;
      const yearsDiff = targetDate.getFullYear() - startDate.getFullYear();
      return yearsDiff >= 0 && yearsDiff % intervalNum === 0;
    }
    default:
      return false;
  }
}

// 알림을 체크하고 필요 시 표시
function checkAndShowNotifications() {
  if (!store) return;

  const events: CalendarEvent[] = store.get('events') || [];
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  for (const event of events) {
    // 알림이 설정되어 있고, 시간이 지정된 이벤트만 처리
    if (!event.reminder?.enabled || !event.time) continue;

    // 오늘 날짜에 해당하는 일정인지 확인 (반복 일정 포함)
    if (!isDateInRepeatSchedule(todayStr, event)) continue;

    // 이벤트 시간 파싱
    const [hours, minutes] = event.time.split(':').map(Number);
    const eventTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);

    // 알림 시간 계산 (이벤트 시간 - minutesBefore)
    const notificationTime = new Date(eventTime.getTime() - event.reminder.minutesBefore * 60 * 1000);

    // 고유 알림 ID (이벤트ID + 날짜 + 알림분)
    const notificationId = `${event.id}_${todayStr}_${event.reminder.minutesBefore}`;

    // 이미 표시한 알림인지 확인
    if (shownNotifications.has(notificationId)) continue;

    // 알림 시간이 현재 시간 기준 ±30초 이내인지 확인
    const timeDiff = now.getTime() - notificationTime.getTime();
    if (timeDiff >= 0 && timeDiff < 30000) {
      // Windows 토스트 알림 표시
      const notification = new Notification({
        title: event.title,
        body: event.reminder.minutesBefore === 0
          ? 'Starts now!'
          : event.reminder.minutesBefore >= 60
            ? `Starts in ${Math.floor(event.reminder.minutesBefore / 60)} hour(s)`
            : `Starts in ${event.reminder.minutesBefore} minutes`,
        icon: path.join(__dirname, '../build/icon.png'),
        silent: false,
      });

      notification.show();
      shownNotifications.add(notificationId);

      // 클릭 시 앱 창 포커스
      notification.on('click', () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
      });
    }
  }

  // 오래된 알림 ID 정리 (24시간 후)
  // 매일 자정에 이전 날짜의 알림 ID 삭제 로직 (간단히 처리)
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  for (const id of shownNotifications) {
    if (id.includes(yesterdayStr)) {
      shownNotifications.delete(id);
    }
  }
}

// 알림 스케줄러 시작 (15초마다 체크)
function startNotificationScheduler() {
  if (notificationCheckInterval) {
    clearInterval(notificationCheckInterval);
  }

  // 즉시 한 번 체크
  checkAndShowNotifications();

  // 15초마다 체크 (알림의 정확도와 성능 균형)
  notificationCheckInterval = setInterval(() => {
    checkAndShowNotifications();
  }, 15000);
}

// 알림 스케줄러 정지
function stopNotificationScheduler() {
  if (notificationCheckInterval) {
    clearInterval(notificationCheckInterval);
    notificationCheckInterval = null;
  }
}
// ==================== End Notification Scheduler ====================

// ==================== Google Calendar IPC Handlers ====================
// Note: 이 핸들러들은 app.whenReady() 이후에 등록됨 (동적 import 때문)
function registerGoogleIpcHandlers() {
  if (!googleAuth || !googleCalendar) return;

  // Google 인증 상태 확인
  ipcMain.handle('google-auth-status', () => {
    return googleAuth!.isAuthenticated();
  });

  // Google 로그인 (PKCE 방식)
  ipcMain.handle('google-auth-login', async () => {
    try {
      await googleAuth!.startAuthFlow();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Google 로그아웃
  ipcMain.handle('google-auth-logout', () => {
    googleAuth!.deleteToken();
    return { success: true };
  });

  // Google Calendar 이벤트 가져오기
  ipcMain.handle('google-calendar-get-events', async (_, timeMin?: string, timeMax?: string) => {
    try {
      const accessToken = await googleAuth!.getAccessToken();
      if (!accessToken) {
        return { success: false, error: 'Not authenticated' };
      }

      const events = await googleCalendar!.getEvents(
        accessToken,
        timeMin ? new Date(timeMin) : undefined,
        timeMax ? new Date(timeMax) : undefined
      );

      return { success: true, events };
    } catch (error) {
      console.error('Failed to get Google Calendar events:', error);
      return { success: false, error: String(error) };
    }
  });

  // Google Calendar에 이벤트 생성
  ipcMain.handle('google-calendar-create-event', async (_, event) => {
    try {
      const accessToken = await googleAuth!.getAccessToken();
      if (!accessToken) {
        return { success: false, error: 'Not authenticated' };
      }

      const created = await googleCalendar!.createEvent(accessToken, event);
      return { success: true, event: created };
    } catch (error) {
      console.error('Failed to create Google Calendar event:', error);
      return { success: false, error: String(error) };
    }
  });

  // Google Calendar 이벤트 수정
  ipcMain.handle('google-calendar-update-event', async (_, googleEventId: string, updates) => {
    try {
      const accessToken = await googleAuth!.getAccessToken();
      if (!accessToken) {
        return { success: false, error: 'Not authenticated' };
      }

      const updated = await googleCalendar!.updateEvent(accessToken, googleEventId, updates);
      return { success: true, event: updated };
    } catch (error) {
      console.error('Failed to update Google Calendar event:', error);
      return { success: false, error: String(error) };
    }
  });

  // Google Calendar 이벤트 삭제
  ipcMain.handle('google-calendar-delete-event', async (_, googleEventId: string) => {
    try {
      const accessToken = await googleAuth!.getAccessToken();
      if (!accessToken) {
        return { success: false, error: 'Not authenticated' };
      }

      await googleCalendar!.deleteEvent(accessToken, googleEventId);
      return { success: true };
    } catch (error) {
      console.error('Failed to delete Google Calendar event:', error);
      return { success: false, error: String(error) };
    }
  });
}
// ==================== End Google Calendar IPC Handlers ====================

app.whenReady().then(async () => {
  initWindowsAPI();
  store = new SimpleStore();

  // IPC 핸들러 등록 (app.whenReady() 이후에 등록해야 함)
  registerIpcHandlers();
  registerMoveHandlers();
  registerResizeHandlers();

  // Google 모듈 동적 로드
  googleAuth = await import('./googleAuth');
  googleCalendar = await import('./googleCalendar');

  // Google Auth 초기화 (electron 함수 전달)
  googleAuth.initGoogleAuth({
    getUserDataPath: () => app.getPath('userData'),
    encryptString: (str: string) => safeStorage.encryptString(str),
    decryptString: (buf: Buffer) => safeStorage.decryptString(buf),
    isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
    openAuthWindow: (url: string, onClose: () => void) => {
      const authWindow = new BrowserWindow({
        width: 500,
        height: 700,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });
      authWindow.loadURL(url);
      authWindow.on('closed', onClose);
    },
  });

  // Google IPC 핸들러 등록
  registerGoogleIpcHandlers();

  createWindow();
  createTray();
  // 팝업 미리 생성 (속도 개선)
  setTimeout(() => {
    preCreatePopupWindow();
  }, 1000);

  // 알림 스케줄러 시작
  startNotificationScheduler();
});

app.on('window-all-closed', () => {
  stopNotificationScheduler();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
