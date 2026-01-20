import React from 'react';
import type { Settings } from '../../types';
import './Settings.css';

interface SettingsPanelProps {
  settings: Settings;
  onUpdateSettings: (updates: Partial<Settings>) => void;
  onClose: () => void;
}

export function SettingsPanel({
  settings,
  onUpdateSettings,
  onClose,
}: SettingsPanelProps) {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="settings-backdrop" onClick={handleBackdropClick}>
      <div className="settings-panel">
        <div className="settings-header">
          <h3>Settings</h3>
          <button className="btn-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="settings-content">
          <div className="setting-item">
            <label>Theme</label>
            <div className="theme-options">
              <button
                className={`theme-btn ${settings.theme === 'dark' ? 'active' : ''}`}
                onClick={() => onUpdateSettings({ theme: 'dark' })}
              >
                Dark
              </button>
              <button
                className={`theme-btn ${settings.theme === 'light' ? 'active' : ''}`}
                onClick={() => onUpdateSettings({ theme: 'light' })}
              >
                Light
              </button>
            </div>
          </div>

          <div className="setting-item">
            <label>
              Opacity: {Math.round(settings.opacity * 100)}%
            </label>
            <input
              type="range"
              min="30"
              max="100"
              value={settings.opacity * 100}
              onChange={(e) =>
                onUpdateSettings({ opacity: Number(e.target.value) / 100 })
              }
              className="slider"
            />
          </div>

          <div className="setting-item">
            <label>
              Font Size: {settings.fontSize}px
            </label>
            <input
              type="range"
              min="10"
              max="20"
              value={settings.fontSize}
              onChange={(e) =>
                onUpdateSettings({ fontSize: Number(e.target.value) })
              }
              className="slider"
            />
          </div>

          <div className="setting-item">
            <label>Always on Top</label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.alwaysOnTop}
                disabled={settings.desktopMode}
                onChange={(e) =>
                  onUpdateSettings({ alwaysOnTop: e.target.checked })
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <label>
              Desktop Mode
              <span className="setting-hint">Stay behind other windows</span>
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.desktopMode}
                onChange={(e) =>
                  onUpdateSettings({
                    desktopMode: e.target.checked,
                    alwaysOnTop: e.target.checked ? false : settings.alwaysOnTop
                  })
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
