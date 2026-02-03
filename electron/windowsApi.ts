// Windows API for Desktop Mode (koffi FFI bindings)

let koffi: typeof import('koffi') | null = null;
let user32: ReturnType<typeof import('koffi').load> | null = null;

// Windows API Functions
let FindWindowA: ((className: string | null, windowName: string | null) => number) | null = null;
let FindWindowExA: ((parent: number, childAfter: number, className: string | null, windowName: string | null) => number) | null = null;
let SetParent: ((child: number, parent: number) => number) | null = null;
let SendMessageTimeoutA: ((hwnd: number, msg: number, wParam: number, lParam: number, flags: number, timeout: number, result: number[]) => number) | null = null;
let GetAsyncKeyState: ((vKey: number) => number) | null = null;
let GetAncestor: ((hwnd: number, flags: number) => number) | null = null;
let GetClassName: ((hwnd: number, buffer: Buffer, maxCount: number) => number) | null = null;
let WindowFromPointRaw: ((pointPacked: bigint) => number) | null = null;

// Constants
export const VK_LBUTTON = 0x01;
export const GA_ROOT = 2;

// Initialize Windows API
export function initWindowsAPI(): boolean {
  if (process.platform !== 'win32') return false;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    koffi = require('koffi');
    if (!koffi) return false;
    user32 = koffi.load('user32.dll');

    FindWindowA = user32.func('FindWindowA', 'int', ['str', 'str']);
    FindWindowExA = user32.func('FindWindowExA', 'int', ['int', 'int', 'str', 'str']);
    SetParent = user32.func('SetParent', 'int', ['int', 'int']);
    SendMessageTimeoutA = user32.func('SendMessageTimeoutA', 'int', ['int', 'uint', 'int', 'int', 'uint', 'uint', 'int*']);
    GetAsyncKeyState = user32.func('GetAsyncKeyState', 'short', ['int']);
    GetAncestor = user32.func('GetAncestor', 'int', ['int', 'uint']);
    GetClassName = user32.func('GetClassNameA', 'int', ['int', 'uint8*', 'int']);
    WindowFromPointRaw = user32.func('WindowFromPoint', 'int', ['int64']);
    return true;
  } catch {
    return false;
  }
}

// Get WorkerW handle (desktop icons layer)
export function getWorkerW(): number {
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

// Pack point coordinates for WindowFromPoint
function packPoint(x: number, y: number): bigint {
  const bigX = BigInt(Math.round(x));
  const bigY = BigInt(Math.round(y));
  const u32X = bigX & 0xFFFFFFFFn;
  const u32Y = bigY & 0xFFFFFFFFn;
  return u32X | (u32Y << 32n);
}

// Get window from point (with DPI correction)
export function windowFromPoint(physicalX: number, physicalY: number): number {
  if (!WindowFromPointRaw) return 0;
  const packed = packPoint(physicalX, physicalY);
  return WindowFromPointRaw(packed);
}

// Get window class name
export function getWindowClassName(hwnd: number): string {
  if (!GetClassName || !hwnd) return '';
  const buffer = Buffer.alloc(256);
  const length = GetClassName(hwnd, buffer, 256);
  return length > 0 ? buffer.toString('utf8', 0, length) : '';
}

// Get ancestor window
export function getAncestorWindow(hwnd: number, flags: number): number {
  return GetAncestor ? GetAncestor(hwnd, flags) : hwnd;
}

// Get mouse button state
export function getAsyncKeyState(vKey: number): number {
  return GetAsyncKeyState ? GetAsyncKeyState(vKey) : 0;
}

// Set window parent
export function setWindowParent(child: number, parent: number): number {
  return SetParent ? SetParent(child, parent) : 0;
}

// Check if Windows API is available
export function isWindowsAPIAvailable(): boolean {
  return SetParent !== null && GetAsyncKeyState !== null;
}
