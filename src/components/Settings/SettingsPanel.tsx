import { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronRight, Download, Upload } from 'lucide-react';
import type { Settings } from '../../types';
import { AdvancedSettings } from './AdvancedSettings';
import './Settings.css';

interface SettingsPanelProps {
  settings: Settings;
  onUpdateSettings: (updates: Partial<Settings>) => void;
  onClose: () => void;
  onGoogleSync?: () => void;
  googleConnected?: boolean;
  onGoogleConnectionChange?: (connected: boolean) => void;
}

export function SettingsPanel({
  settings,
  onUpdateSettings,
  onClose,
  onGoogleSync,
  googleConnected: initialGoogleConnected = false,
  onGoogleConnectionChange,
}: SettingsPanelProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(initialGoogleConnected);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const googleAuthInProgressRef = useRef(false);

  // Google 연결/해제
  const handleGoogleConnect = async () => {
    if (!window.electronAPI) return;
    // 중복 호출 방지 (Desktop Mode에서 클릭 이벤트가 두 번 발생할 수 있음)
    if (googleAuthInProgressRef.current) return;
    googleAuthInProgressRef.current = true;

    setGoogleLoading(true);
    try {
      if (googleConnected) {
        // 연결 해제
        await window.electronAPI.googleAuthLogout();
        setGoogleConnected(false);
        onGoogleConnectionChange?.(false);
      } else {
        // 연결
        const result = await window.electronAPI.googleAuthLogin();
        if (result.success) {
          setGoogleConnected(true);
          onGoogleConnectionChange?.(true);
          // 연결 성공 후 동기화
          onGoogleSync?.();
        }
      }
    } catch (error) {
      console.error('Google auth error:', error);
    } finally {
      setGoogleLoading(false);
      googleAuthInProgressRef.current = false;
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // 데이터 내보내기
  const handleExport = async () => {
    if (!window.electronAPI?.exportData) return;
    setExportLoading(true);
    try {
      const result = await window.electronAPI.exportData();
      if (result.success) {
        console.log('Exported to:', result.path);
      }
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setExportLoading(false);
    }
  };

  // 데이터 가져오기
  const handleImport = async () => {
    if (!window.electronAPI?.importData) return;
    setImportLoading(true);
    try {
      const result = await window.electronAPI.importData();
      if (result.success) {
        // 페이지 새로고침으로 모든 데이터 반영
        window.location.reload();
      }
    } catch (error) {
      console.error('Import error:', error);
    } finally {
      setImportLoading(false);
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

          <div className="setting-row">
            <div className="setting-item-inline">
              <label>Opacity</label>
              <div className="stepper-control-compact">
                <button
                  className="stepper-btn-sm"
                  onClick={() => onUpdateSettings({ opacity: Math.max(0.3, settings.opacity - 0.1) })}
                >
                  -
                </button>
                <span className="stepper-value-sm">{Math.round(settings.opacity * 100)}%</span>
                <button
                  className="stepper-btn-sm"
                  onClick={() => onUpdateSettings({ opacity: Math.min(1, settings.opacity + 0.1) })}
                >
                  +
                </button>
              </div>
            </div>
            <div className="setting-item-inline">
              <label>Font</label>
              <div className="stepper-control-compact">
                <button
                  className="stepper-btn-sm"
                  onClick={() => onUpdateSettings({ fontSize: Math.max(10, settings.fontSize - 1) })}
                >
                  -
                </button>
                <span className="stepper-value-sm">{settings.fontSize}px</span>
                <button
                  className="stepper-btn-sm"
                  onClick={() => onUpdateSettings({ fontSize: Math.min(20, settings.fontSize + 1) })}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="setting-divider" />

          <div className="setting-item">
            <label>Always on Top</label>
            <div
              className={`toggle-btn ${settings.alwaysOnTop ? 'active' : ''} ${settings.desktopMode ? 'disabled' : ''}`}
              onClick={() => !settings.desktopMode && onUpdateSettings({ alwaysOnTop: !settings.alwaysOnTop })}
            >
              <span className="toggle-slider"></span>
            </div>
          </div>

          <div className="setting-item">
            <label>
              Desktop Mode
              <span className="setting-hint">Stay behind other windows</span>
            </label>
            <div
              className={`toggle-btn ${settings.desktopMode ? 'active' : ''}`}
              onClick={() => onUpdateSettings({
                desktopMode: !settings.desktopMode,
                alwaysOnTop: !settings.desktopMode ? false : settings.alwaysOnTop
              })}
            >
              <span className="toggle-slider"></span>
            </div>
          </div>

          <div className="setting-item">
            <label>
              Resize Mode
              <span className="setting-hint">Show handles to resize window</span>
            </label>
            <div
              className={`toggle-btn ${settings.resizeMode ? 'active' : ''}`}
              onClick={() => onUpdateSettings({ resizeMode: !settings.resizeMode })}
            >
              <span className="toggle-slider"></span>
            </div>
          </div>

          <div className="setting-divider" />

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

          <div className="setting-divider" />

          {/* 데이터 내보내기/가져오기 */}
          <div className="setting-item">
            <label>
              Backup & Restore
              <span className="setting-hint">Export or import all data</span>
            </label>
            <div className="data-buttons">
              <button
                className="data-btn"
                onClick={handleExport}
                disabled={exportLoading}
                title="Export data"
              >
                <Download size={14} />
                {exportLoading ? '...' : 'Export'}
              </button>
              <button
                className="data-btn"
                onClick={handleImport}
                disabled={importLoading}
                title="Import data"
              >
                <Upload size={14} />
                {importLoading ? '...' : 'Import'}
              </button>
            </div>
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
