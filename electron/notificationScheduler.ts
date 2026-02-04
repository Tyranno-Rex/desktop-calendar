// Notification scheduler for event reminders
import { Notification, BrowserWindow } from 'electron';
import path from 'path';
import type { SimpleStore, CalendarEvent } from './store';
import { isDateInRepeatSchedule, getLocalDateString } from './dateUtils';

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

// Check and show notifications
function checkAndShowNotifications(): void {
  if (!storeRef) return;

  const events: CalendarEvent[] = storeRef.get('events') || [];
  const now = new Date();
  const todayStr = getLocalDateString(now);

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
  const yesterdayStr = getLocalDateString(yesterday);

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
