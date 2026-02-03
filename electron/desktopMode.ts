// Desktop Mode - embeds window behind desktop icons
import { BrowserWindow, screen } from 'electron';
import {
  initWindowsAPI,
  getWorkerW,
  setWindowParent,
  getAsyncKeyState,
  windowFromPoint,
  getWindowClassName,
  getAncestorWindow,
  isWindowsAPIAvailable,
  VK_LBUTTON,
  GA_ROOT,
} from './windowsApi';

// Desktop Mode state
let desktopModeEnabled = false;
let isEmbeddedInDesktop = false;
let mouseCheckInterval: NodeJS.Timeout | null = null;

// Mouse tracking state
let lastClickTime = 0;
let lastClickX = 0;
let lastClickY = 0;
let wasMouseDown = false;
let isDraggingInWindow = false;
let hasDragged = false;
let mouseDownX = 0;
let mouseDownY = 0;
let lastMouseX = 0;
let lastMouseY = 0;
let wasMouseInWindow = false;

const DOUBLE_CLICK_TIME = 500;

// References to windows (set from main)
let mainWindowRef: BrowserWindow | null = null;
let memoWindowRef: BrowserWindow | null = null;
let popupWindowRef: BrowserWindow | null = null;
let isMemoPinnedRef = false;

export function initDesktopMode(): void {
  initWindowsAPI();
}

export function setWindowRefs(
  main: BrowserWindow | null,
  memo: BrowserWindow | null,
  popup: BrowserWindow | null,
  isMemoPinned: boolean
): void {
  mainWindowRef = main;
  memoWindowRef = memo;
  popupWindowRef = popup;
  isMemoPinnedRef = isMemoPinned;
}

export function setMemoPinnedState(pinned: boolean): void {
  isMemoPinnedRef = pinned;
}

// Embed window in desktop (behind icons)
function embedInDesktop(): boolean {
  if (!mainWindowRef || !isWindowsAPIAvailable() || isEmbeddedInDesktop) return false;

  const workerW = getWorkerW();
  if (workerW) {
    const hwnd = mainWindowRef.getNativeWindowHandle().readInt32LE(0);
    setWindowParent(hwnd, workerW);
    isEmbeddedInDesktop = true;
    return true;
  }
  return false;
}

// Remove window from desktop
function removeFromDesktop(): void {
  if (!mainWindowRef || !isWindowsAPIAvailable() || !isEmbeddedInDesktop) return;

  const hwnd = mainWindowRef.getNativeWindowHandle().readInt32LE(0);
  setWindowParent(hwnd, 0);
  isEmbeddedInDesktop = false;
}

// Get scale factor for point
function getScaleFactorForPoint(x: number, y: number): number {
  const display = screen.getDisplayNearestPoint({ x, y });
  return display.scaleFactor;
}

// Check if other window is at point
function isOtherWindowAtPoint(x: number, y: number): boolean {
  if (!mainWindowRef || !isWindowsAPIAvailable()) return false;
  if (!isEmbeddedInDesktop) return false;

  // Check memo/popup bounds
  if (memoWindowRef && !memoWindowRef.isDestroyed()) {
    const memoBounds = memoWindowRef.getBounds();
    if (x >= memoBounds.x && x <= memoBounds.x + memoBounds.width &&
        y >= memoBounds.y && y <= memoBounds.y + memoBounds.height) {
      return true;
    }
  }
  if (popupWindowRef && !popupWindowRef.isDestroyed()) {
    const popupBounds = popupWindowRef.getBounds();
    if (x >= popupBounds.x && x <= popupBounds.x + popupBounds.width &&
        y >= popupBounds.y && y <= popupBounds.y + popupBounds.height) {
      return true;
    }
  }

  // DPI correction
  const scale = getScaleFactorForPoint(x, y);
  const physicalX = x * scale;
  const physicalY = y * scale;

  const hwndAtPoint = windowFromPoint(physicalX, physicalY);
  if (!hwndAtPoint) return false;

  const directClassName = getWindowClassName(hwndAtPoint);
  const rootHwnd = getAncestorWindow(hwndAtPoint, GA_ROOT);
  const rootClassName = getWindowClassName(rootHwnd || hwndAtPoint);

  const desktopClasses = ['WorkerW', 'Progman', 'SHELLDLL_DefView', 'SysListView32'];
  const isDesktopDirect = desktopClasses.some(dc => directClassName.includes(dc));
  const isDesktopRoot = desktopClasses.some(dc => rootClassName.includes(dc));

  return !(isDesktopDirect || isDesktopRoot);
}

// Check if click is in window bounds
function isClickInWindow(): { inWindow: boolean; relX: number; relY: number } {
  if (!mainWindowRef) return { inWindow: false, relX: 0, relY: 0 };

  const mousePos = screen.getCursorScreenPoint();
  const bounds = mainWindowRef.getBounds();

  const isInBounds = mousePos.x >= bounds.x && mousePos.x <= bounds.x + bounds.width &&
                     mousePos.y >= bounds.y && mousePos.y <= bounds.y + bounds.height;

  if (!isInBounds) return { inWindow: false, relX: 0, relY: 0 };

  if (isEmbeddedInDesktop && isOtherWindowAtPoint(mousePos.x, mousePos.y)) {
    return { inWindow: false, relX: 0, relY: 0 };
  }

  return { inWindow: true, relX: mousePos.x - bounds.x, relY: mousePos.y - bounds.y };
}

// Mouse monitoring for Desktop Mode
function startMouseMonitoring(): void {
  if (mouseCheckInterval) return;

  mouseCheckInterval = setInterval(() => {
    if (!mainWindowRef || !desktopModeEnabled || !isWindowsAPIAvailable()) return;

    // Skip if memo/popup is focused or pinned
    if (memoWindowRef && !memoWindowRef.isDestroyed()) {
      if (memoWindowRef.isFocused() || isMemoPinnedRef) {
        wasMouseDown = false;
        isDraggingInWindow = false;
        return;
      }
    }
    if (popupWindowRef && !popupWindowRef.isDestroyed() && popupWindowRef.isFocused()) {
      wasMouseDown = false;
      isDraggingInWindow = false;
      return;
    }

    const mouseState = getAsyncKeyState(VK_LBUTTON);
    const isMouseDown = (mouseState & 0x8000) !== 0;
    const mousePos = screen.getCursorScreenPoint();
    const bounds = mainWindowRef.getBounds();
    const clickInfo = isClickInWindow();
    const isMouseInWindow = clickInfo.inWindow;

    // Handle mouse enter/leave
    if (isMouseInWindow && !wasMouseInWindow && !isDraggingInWindow) {
      mainWindowRef.setIgnoreMouseEvents(false);
    }
    if (!isMouseInWindow && wasMouseInWindow && !isDraggingInWindow) {
      mainWindowRef.setIgnoreMouseEvents(true, { forward: true });
    }
    wasMouseInWindow = isMouseInWindow;

    const relX = mousePos.x - bounds.x;
    const relY = mousePos.y - bounds.y;

    // Mouse down
    if (isMouseDown && !wasMouseDown) {
      if (clickInfo.inWindow) {
        isDraggingInWindow = true;
        hasDragged = false;
        mouseDownX = mousePos.x;
        mouseDownY = mousePos.y;
        lastMouseX = mousePos.x;
        lastMouseY = mousePos.y;
        mainWindowRef.setIgnoreMouseEvents(false);
        mainWindowRef.webContents.send('desktop-mousedown', {
          x: clickInfo.relX, y: clickInfo.relY,
          screenX: mousePos.x, screenY: mousePos.y
        });
      }
    }

    // Mouse move (dragging)
    if (isMouseDown && isDraggingInWindow) {
      if (mousePos.x !== lastMouseX || mousePos.y !== lastMouseY) {
        const moveDistance = Math.abs(mousePos.x - mouseDownX) + Math.abs(mousePos.y - mouseDownY);
        if (moveDistance > 5) hasDragged = true;
        mainWindowRef.webContents.send('desktop-mousemove', {
          x: relX, y: relY, screenX: mousePos.x, screenY: mousePos.y
        });
        lastMouseX = mousePos.x;
        lastMouseY = mousePos.y;
      }
    }

    // Mouse up
    if (!isMouseDown && wasMouseDown && isDraggingInWindow) {
      const now = Date.now();
      mainWindowRef.webContents.send('desktop-mouseup', {
        x: relX, y: relY, screenX: mousePos.x, screenY: mousePos.y
      });

      if (!hasDragged) {
        mainWindowRef.webContents.send('desktop-click', {
          x: relX, y: relY, screenX: mousePos.x, screenY: mousePos.y
        });

        const timeDiff = now - lastClickTime;
        const posDiff = Math.abs(mousePos.x - lastClickX) + Math.abs(mousePos.y - lastClickY);

        if (timeDiff < DOUBLE_CLICK_TIME && posDiff < 10) {
          mainWindowRef.webContents.send('desktop-dblclick', {
            x: relX, y: relY, screenX: mousePos.x, screenY: mousePos.y
          });
          lastClickTime = 0;
        } else {
          lastClickTime = now;
          lastClickX = mousePos.x;
          lastClickY = mousePos.y;
        }
      }

      isDraggingInWindow = false;
      hasDragged = false;

      if (!isClickInWindow().inWindow) {
        mainWindowRef.setIgnoreMouseEvents(true, { forward: true });
      }
    }

    wasMouseDown = isMouseDown;
  }, 16); // 60fps
}

function stopMouseMonitoring(): void {
  if (mouseCheckInterval) {
    clearInterval(mouseCheckInterval);
    mouseCheckInterval = null;
  }
}

export function enableDesktopMode(): void {
  if (!mainWindowRef) return;
  desktopModeEnabled = true;
  mainWindowRef.setAlwaysOnTop(false);
  mainWindowRef.setIgnoreMouseEvents(true, { forward: true });
  embedInDesktop();
  startMouseMonitoring();
}

export function disableDesktopMode(): void {
  desktopModeEnabled = false;
  stopMouseMonitoring();
  removeFromDesktop();
  if (mainWindowRef) {
    mainWindowRef.setIgnoreMouseEvents(false);
  }
}

export function isDesktopModeEnabled(): boolean {
  return desktopModeEnabled;
}
