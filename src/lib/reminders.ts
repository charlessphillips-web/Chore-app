/**
 * Reminders the phone schedules for itself: the day before the leaderboard
 * resets. (Bin night and the Sunday summary come from the Rotawise server,
 * so bin reminders stop as soon as someone's taken them out.) Phones only:
 * the web version can't schedule notifications.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { BinSchedule } from './bins';
import { wants, type NotifyPrefs } from './notifyPrefs';

const PREFIX = 'rw-';

export async function scheduleReminders(opts: {
  bins: BinSchedule[];
  prefs: NotifyPrefs;
  /** When the leaderboard resets (start of the next period). */
  periodEnd: Date;
}) {
  if (Platform.OS === 'web') return;
  // Start clean: remove every reminder we scheduled before.
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(existing.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  const now = new Date();

  if (wants(opts.prefs, 'reset')) {
    const e = opts.periodEnd;
    const eve = new Date(e.getFullYear(), e.getMonth(), e.getDate() - 1, 18, 0);
    if (eve > now) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}reset`,
        content: { title: '🏁 Last day! Table resets tomorrow', data: { url: '/leaderboard', size: 'quiet' }, interruptionLevel: 'passive' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: eve },
      });
    }
  }
}
