// Auto backup functionality
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import type { SimpleStore } from './store';

const MAX_AUTO_BACKUPS = 5;

function getAutoBackupDir(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'auto-backups');
}

function cleanOldBackups(backupDir: string): void {
  try {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('auto-backup-') && f.endsWith('.json'))
      .map(f => ({
        name: f,
        path: path.join(backupDir, f),
        time: fs.statSync(path.join(backupDir, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > MAX_AUTO_BACKUPS) {
      const toDelete = files.slice(MAX_AUTO_BACKUPS);
      for (const file of toDelete) {
        fs.unlinkSync(file.path);
      }
    }
  } catch {
    // Failed to clean old backups
  }
}

export function performAutoBackup(store: SimpleStore): void {
  const settings = store.get('settings');
  if (!settings?.autoBackup) return;

  try {
    const backupDir = getAutoBackupDir();

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      events: store.get('events') || [],
      memos: store.get('memos') || [],
      settings: store.get('settings') || {},
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFileName = `auto-backup-${timestamp}.json`;
    const backupFilePath = path.join(backupDir, backupFileName);

    fs.writeFileSync(backupFilePath, JSON.stringify(exportData, null, 2), 'utf-8');
    cleanOldBackups(backupDir);
  } catch {
    // Auto backup failed
  }
}
