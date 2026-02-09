import '@testing-library/jest-dom';

// Mock Electron API
Object.defineProperty(window, 'electronAPI', {
  value: {
    getEvents: vi.fn().mockResolvedValue([]),
    saveEvents: vi.fn().mockResolvedValue(undefined),
    getSettings: vi.fn().mockResolvedValue(null),
    saveSettings: vi.fn().mockResolvedValue(undefined),
    getMemos: vi.fn().mockResolvedValue([]),
    saveMemos: vi.fn().mockResolvedValue(undefined),
    getRepeatInstanceStates: vi.fn().mockResolvedValue([]),
    saveRepeatInstanceStates: vi.fn().mockResolvedValue(undefined),
    openPopup: vi.fn(),
    openMemo: vi.fn(),
    onEventsUpdated: vi.fn(),
    onMemosUpdated: vi.fn(),
  },
  writable: true,
});
