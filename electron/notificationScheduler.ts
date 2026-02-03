// Notification scheduler for event reminders
import { Notification, BrowserWindow } from 'electron';
import path from 'path';
import type { SimpleStore, CalendarEvent } from './store';

const shownNotifications = new Set<string>();
let notificationCheckInterval: NodeJS.Timeout | null = null;
let storeRef: SimpleStore | null = null;
let mainWindowRef: BrowserWindow | null = null;

export function initNotificationScheduler(store: SimpleStore, mainWindow: BrowserWindow | null): void {
  storeRef = store;
  mainWindowRef = mainWindow;
}

export function setMainWindowRef(mainWindow: BrowserWindow | null): void {
  mainWindowRef = mainWindow;
}

// Check if date is in repeat schedule
function isDateInRepeatSchedule(targetDateStr: string, event: CalendarEvent): boolean {
  if (!event.repeat || event.repeat.type === 'none') {
    return event.date === targetDateStr;
  }

  const parseLocalDateString = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  };

  const targetDate = parseLocalDateString(targetDateStr);
  const startDate = parseLocalDateString(event.date);
  const { type, interval, endDate } = event.repeat;

  if (targetDate < startDate) return false;
  if (endDate && targetDate > parseLocalDateString(endDate)) return false;
  if (targetDateStr === event.date) return true;

  const intervalNum = interval || 1;
  switch (type) {
    case 'daily': {
      const diffDays = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays % intervalNum === 0;
    }
    case 'weekly': {
      const diffDays = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays % (intervalNum * 7) === 0;
    }
    case 'monthly': {
      if (targetDate.getDate() !== startDate.getDate()) return false;
      const monthsDiff = (targetDate.getFullYear() - startDate.getFullYear()) * 12 +
                         (targetDate.getMonth() - startDate.getMonth());
      return monthsDiff >= 0 && monthsDiff % intervalNum === 0;
    }
    case 'yearly': {
      if (targetDate.getMonth() !== startDate.getMonth() ||
          targetDate.getDate() !== startDate.getDate()) return false;
      const yearsDiff = targetDate.getFullYear() - startDate.getFullYear();
      return yearsDiff >= 0 && yearsDiff % intervalNum === 0;
    }
    default:
      return false;
  }
}

// Check and show notifications
function checkAndShowNotifications(): void {
  if (!storeRef) return;

  const events: CalendarEvent[] = storeRef.get('events') || [];
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  for (const event of events) {
    if (!event.reminder?.enabled || !event.time) continue;
    if (!isDateInRepeatSchedule(todayStr, event)) continue;

    const [hours, minutes] = event.time.split(':').map(Number);
    const eventTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
    const notificationTime = new Date(eventTime.getTime() - event.reminder.minutesBefore * 60 * 1000);
    const notificationId = `${event.id}_${todayStr}_${event.reminder.minutesBefore}`;

    if (shownNotifications.has(notificationId)) continue;

    const timeDiff = now.getTime() - notificationTime.getTime();
    if (timeDiff >= 0 && timeDiff < 30000) {
      const notification = new Notification({
        title: event.title,
        body: event.reminder.minutesBefore === 0
          ? 'Starts now!'
          : event.reminder.minutesBefore >= 60
            ? `Starts in ${Math.floor(event.reminder.minutesBefore / 60)} hour(s)`
            : `Starts in ${event.reminder.minutesBefore} minutes`,
        icon: path.join(__dirname, '../build/icon.png'),
        silent: false,
      });

      notification.show();
      shownNotifications.add(notificationId);

      notification.on('click', () => {
        if (mainWindowRef) {
          if (mainWindowRef.isMinimized()) mainWindowRef.restore();
          mainWindowRef.focus();
        }
      });
    }
  }

  // Clean old notification IDs
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  for (const id of shownNotifications) {
    if (id.includes(yesterdayStr)) {
      shownNotifications.delete(id);
    }
  }
}

export function startNotificationScheduler(): void {
  if (notificationCheckInterval) {
    clearInterval(notificationCheckInterval);
  }
  checkAndShowNotifications();
  notificationCheckInterval = setInterval(checkAndShowNotifications, 15000);
}

export function stopNotificationScheduler(): void {
  if (notificationCheckInterval) {
    clearInterval(notificationCheckInterval);
    notificationCheckInterval = null;
  }
}
