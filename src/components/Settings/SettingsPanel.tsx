import { useState, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, Download, Upload } from 'lucide-react';
import type { Settings } from '../../types';
import { AdvancedSettings } from './AdvancedSettings';
import { useDraggableModal } from '../../hooks/useDraggableModal';
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
  const { position, isDragging, handleDragStart } = useDraggableModal();
  const [googleConnected, setGoogleConnected] = useState(initialGoogleConnected);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const googleAuthInProgressRef = useRef(false);

  // Google 연결/해제
  const handleGoogleConnect = useCallback(async () => {
    if (!window.electronAPI) return;
    if (googleAuthInProgressRef.current) return;
    googleAuthInProgressRef.current = true;

    setGoogleLoading(true);
    try {
      if (googleConnected) {
        await window.electronAPI.googleAuthLogout();
        setGoogleConnected(false);
        onGoogleConnectionChange?.(false);
      } else {
        const result = await window.electronAPI.googleAuthLogin();
        if (result.success) {
          setGoogleConnected(true);
          onGoogleConnectionChange?.(true);
          onGoogleSync?.();
        }
      }
    } catch {
      // Auth failed silently
    } finally {
      setGoogleLoading(false);
      googleAuthInProgressRef.current = false;
    }
  }, [googleConnected, onGoogleConnectionChange, onGoogleSync]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  // 데이터 내보내기
  const handleExport = useCallback(async () => {
    if (!window.electronAPI?.exportData) return;
    setExportLoading(true);
    try {
      await window.electronAPI.exportData();
    } catch {
      // Export failed silently
    } finally {
      setExportLoading(false);
    }
  }, []);

  // 데이터 가져오기
  const handleImport = useCallback(async () => {
    if (!window.electronAPI?.importData) return;
    setImportLoading(true);
    try {
      const result = await window.electronAPI.importData();
      if (result.success) window.location.reload();
    } catch {
      // Import failed silently
    } finally {
      setImportLoading(false);
    }
  }, []);

  return (
    <div className="settings-backdrop" onClick={handleBackdropClick}>
      <div
        className="settings-panel"
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      >
        <div className="settings-header">
          <div
            className="settings-drag-handle"
            onMouseDown={handleDragStart}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          >
            <h3>Settings</h3>
          </div>
          <button className="btn-close" onClick={onClose}>&times;</button>
        </div>

        <div className="settings-content">
          <div className="setting-item">
            <label>Theme</label>
            <div className="theme-options">
              <motion.button
                className={`theme-btn ${settings.theme === 'dark' ? 'active' : ''}`}
                onClick={() => onUpdateSettings({ theme: 'dark' })}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                Dark
              </motion.button>
              <motion.button
                className={`theme-btn ${settings.theme === 'light' ? 'active' : ''}`}
                onClick={() => onUpdateSettings({ theme: 'light' })}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                Light
              </motion.button>
              <motion.button
                className={`theme-btn ${settings.theme === 'orange' ? 'active' : ''}`}
                onClick={() => onUpdateSettings({ theme: 'orange' })}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                Orange
              </motion.button>
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-item-inline">
              <label>Opacity</label>
              <div className="stepper-control-compact">
                <motion.button
                  className="stepper-btn-sm"
                  onClick={() => onUpdateSettings({ opacity: Math.max(0.3, settings.opacity - 0.1) })}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                >
                  -
                </motion.button>
                <span className="stepper-value-sm">{Math.round(settings.opacity * 100)}%</span>
                <motion.button
                  className="stepper-btn-sm"
                  onClick={() => onUpdateSettings({ opacity: Math.min(1, settings.opacity + 0.1) })}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                >
                  +
                </motion.button>
              </div>
            </div>
            <div className="setting-item-inline">
              <label>Font</label>
              <div className="stepper-control-compact">
                <motion.button
                  className="stepper-btn-sm"
                  onClick={() => onUpdateSettings({ fontSize: Math.max(10, settings.fontSize - 1) })}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                >
                  -
                </motion.button>
                <span className="stepper-value-sm">{settings.fontSize}px</span>
                <motion.button
                  className="stepper-btn-sm"
                  onClick={() => onUpdateSettings({ fontSize: Math.min(20, settings.fontSize + 1) })}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                >
                  +
                </motion.button>
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

          <div className="setting-item">
            <label>
              Google Calendar
              <span className="setting-hint">
                {googleConnected ? 'Connected' : 'Sync with Google'}
              </span>
            </label>
            <motion.button
              className={`google-btn ${googleConnected ? 'connected' : ''}`}
              onClick={handleGoogleConnect}
              disabled={googleLoading}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              {googleLoading ? '...' : googleConnected ? 'Disconnect' : 'Connect'}
            </motion.button>
          </div>

          <div className="setting-divider" />

          <div className="setting-item">
            <label>
              Backup & Restore
              <span className="setting-hint">Export or import all data</span>
            </label>
            <div className="data-buttons">
              <motion.button
                className="data-btn"
                onClick={handleExport}
                disabled={exportLoading}
                title="Export data"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <Download size={14} />
                {exportLoading ? '...' : 'Export'}
              </motion.button>
              <motion.button
                className="data-btn"
                onClick={handleImport}
                disabled={importLoading}
                title="Import data"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <Upload size={14} />
                {importLoading ? '...' : 'Import'}
              </motion.button>
            </div>
          </div>

          <motion.button
            className="advanced-settings-btn"
            onClick={() => setShowAdvanced(true)}
            whileHover={{ scale: 1.01, x: 2 }}
            whileTap={{ scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <span>Advanced Settings</span>
            <ChevronRight size={16} />
          </motion.button>
        </div>
      </div>

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
