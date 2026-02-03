import { useState, useEffect, useCallback } from 'react';
import type { Settings } from '../types';

const defaultSettings: Settings = {
  opacity: 0.95,
  alwaysOnTop: true,
  desktopMode: false,
  theme: 'dark',
  accentColor: 'blue',
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

// 기존 orange 테마를 새 시스템으로 마이그레이션
function migrateSettings(saved: Record<string, unknown>): Settings {
  const migrated = { ...defaultSettings, ...saved };

  // 기존 theme: 'orange'를 theme: 'dark' + accentColor: 'orange'로 변환
  if (saved.theme === 'orange') {
    migrated.theme = 'dark';
    migrated.accentColor = 'orange';
  }

  // accentColor가 없으면 기본값 설정
  if (!migrated.accentColor) {
    migrated.accentColor = 'blue';
  }

  return migrated as Settings;
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();

    if (window.electronAPI) {
      window.electronAPI.onSettingsUpdated((updatedSettings) => {
        setSettings((prev) => ({ ...prev, ...updatedSettings }));
      });
    }
  }, []);

  const loadSettings = async () => {
    try {
      if (window.electronAPI) {
        const savedSettings = await window.electronAPI.getSettings();
        const migrated = migrateSettings(savedSettings as Record<string, unknown>);
        setSettings(migrated);
        // 마이그레이션된 설정 저장
        if (JSON.stringify(savedSettings) !== JSON.stringify(migrated)) {
          await window.electronAPI.saveSettings(migrated);
        }
      } else {
        const savedSettings = localStorage.getItem('calendar-settings');
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          const migrated = migrateSettings(parsed);
          setSettings(migrated);
          // 마이그레이션된 설정 저장
          if (JSON.stringify(parsed) !== JSON.stringify(migrated)) {
            localStorage.setItem('calendar-settings', JSON.stringify(migrated));
          }
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = useCallback(async (updates: Partial<Settings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);

    try {
      if (window.electronAPI) {
        await window.electronAPI.saveSettings(newSettings);
      } else {
        localStorage.setItem('calendar-settings', JSON.stringify(newSettings));
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }, [settings]);

  return {
    settings,
    loading,
    updateSettings,
  };
}
