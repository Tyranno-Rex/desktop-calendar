import { useState, useEffect, useCallback } from 'react';
import type { Settings } from '../types';

const defaultSettings: Settings = {
  opacity: 0.95,
  alwaysOnTop: true,
  desktopMode: false,
  theme: 'dark',
  fontSize: 14,
};

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
        setSettings(savedSettings);
      } else {
        const savedSettings = localStorage.getItem('calendar-settings');
        if (savedSettings) {
          setSettings(JSON.parse(savedSettings));
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
