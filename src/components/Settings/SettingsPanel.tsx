import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Settings } from '../../types';
import { AdvancedSettings } from './AdvancedSettings';
import './Settings.css';

interface SettingsPanelProps {
  settings: Settings;
  onUpdateSettings: (updates: Partial<Settings>) => void;
  onClose: () => void;
  onGoogleSync?: () => void;
}

export function SettingsPanel({
  settings,
  onUpdateSettings,
  onClose,
  onGoogleSync,
}: SettingsPanelProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragHandleRef = useRef<HTMLDivElement>(null);

  // Google 연결 상태 확인
  useEffect(() => {
    const checkGoogleAuth = async () => {
      if (window.electronAPI?.googleAuthStatus) {
        const isConnected = await window.electronAPI.googleAuthStatus();
        setGoogleConnected(isConnected);
      }
    };
    checkGoogleAuth();
  }, []);

  // Google 연결/해제
  const handleGoogleConnect = async () => {
    if (!window.electronAPI) return;

    setGoogleLoading(true);
    try {
      if (googleConnected) {
        // 연결 해제
        await window.electronAPI.googleAuthLogout();
        setGoogleConnected(false);
      } else {
        // 연결
        const result = await window.electronAPI.googleAuthLogin();
        if (result.success) {
          setGoogleConnected(true);
          // 연결 성공 후 동기화
          onGoogleSync?.();
        }
      }
    } catch (error) {
      console.error('Google auth error:', error);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleDragHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      className="settings-backdrop"
      onClick={handleBackdropClick}
    >
      <div
        className="settings-panel"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`
        }}
      >
        <div className="settings-header">
          <div
            className="settings-drag-handle"
            ref={dragHandleRef}
            onMouseDown={handleDragHandleMouseDown}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          >
            <h3>Settings</h3>
          </div>
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
            <div className="stepper-control">
              <button
                className="stepper-btn"
                onClick={() => onUpdateSettings({ opacity: Math.max(0.3, settings.opacity - 0.1) })}
              >
                -
              </button>
              <span className="stepper-value">{Math.round(settings.opacity * 100)}%</span>
              <button
                className="stepper-btn"
                onClick={() => onUpdateSettings({ opacity: Math.min(1, settings.opacity + 0.1) })}
              >
                +
              </button>
            </div>
          </div>

          <div className="setting-item">
            <label>
              Font Size: {settings.fontSize}px
            </label>
            <div className="stepper-control">
              <button
                className="stepper-btn"
                onClick={() => onUpdateSettings({ fontSize: Math.max(10, settings.fontSize - 1) })}
              >
                -
              </button>
              <span className="stepper-value">{settings.fontSize}px</span>
              <button
                className="stepper-btn"
                onClick={() => onUpdateSettings({ fontSize: Math.min(20, settings.fontSize + 1) })}
              >
                +
              </button>
            </div>
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

          <div className="setting-item">
            <label>
              Resize Mode
              <span className="setting-hint">Show handles to resize window</span>
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.resizeMode}
                onChange={(e) =>
                  onUpdateSettings({ resizeMode: e.target.checked })
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <label>
              Show Holidays
              <span className="setting-hint">Display holidays on calendar</span>
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.showHolidays}
                onChange={(e) =>
                  onUpdateSettings({ showHolidays: e.target.checked })
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <label>
              Adjacent Months
              <span className="setting-hint">Show prev/next month dates</span>
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.showAdjacentMonths}
                onChange={(e) =>
                  onUpdateSettings({ showAdjacentMonths: e.target.checked })
                }
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {/* Google Calendar 연동 */}
          <div className="setting-item">
            <label>
              Google Calendar
              <span className="setting-hint">
                {googleConnected ? 'Connected' : 'Sync with Google'}
              </span>
            </label>
            <button
              className={`google-btn ${googleConnected ? 'connected' : ''}`}
              onClick={handleGoogleConnect}
              disabled={googleLoading}
            >
              {googleLoading ? '...' : googleConnected ? 'Disconnect' : 'Connect'}
            </button>
          </div>

          {/* 고급 설정 */}
          <button
            className="advanced-settings-btn"
            onClick={() => setShowAdvanced(true)}
          >
            <span>Advanced Settings</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* 고급 설정 팝업 */}
      {showAdvanced && (
        <AdvancedSettings
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          onClose={() => setShowAdvanced(false)}
        />
      )}
    </div>
  );
}
