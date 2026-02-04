// Simple JSON store for persistent data
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Settings {
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
  autoBackup: boolean;
  showOverdueTasks: boolean;
}

export interface ReminderConfig {
  enabled: boolean;
  minutesBefore: number;
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
  repeat?: {
    type: string;
    interval: number;
    endDate?: string;
  };
  repeatGroupId?: string;
  isRepeatInstance?: boolean;
  reminder?: ReminderConfig;
  isDDay?: boolean;
}

export interface Memo {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// 반복 인스턴스별 완료 상태
export interface RepeatInstanceState {
  eventId: string;      // 반복 원본 이벤트 ID
  instanceDate: string; // 인스턴스 날짜 (YYYY-MM-DD)
  completed: boolean;
}

export interface StoreData {
  windowBounds?: WindowBounds;
  settings?: Settings;
  events?: CalendarEvent[];
  memo?: Memo; // Legacy (single memo) - for migration
  memos?: Memo[];
  repeatInstanceStates?: RepeatInstanceState[]; // 반복 인스턴스 완료 상태
}

export const DEFAULT_SETTINGS: Settings = {
  opacity: 0.95,
  alwaysOnTop: false,
  desktopMode: false,
  theme: 'dark',
  fontSize: 14,
  resizeMode: false,
  showHolidays: true,
  showAdjacentMonths: true,
  showGridLines: true,
  hiddenDays: [],
  schedulePanelPosition: 'right',
  showEventDots: false,
  autoBackup: true,
  showOverdueTasks: true,
};

export class SimpleStore {
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
    } catch {
      // Failed to load, return empty
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
    } catch {
      // Failed to save
    }
  }

  get<K extends keyof StoreData>(key: K, defaultValue?: StoreData[K]): StoreData[K] | undefined {
    return this.data[key] ?? defaultValue;
  }

  set<K extends keyof StoreData>(key: K, value: StoreData[K]): void {
    this.data[key] = value;
    this.save();
  }

  getFilePath(): string {
    return this.filePath;
  }
}
