/**
 * Reminders the phone schedules for itself (no server needed): bin night,
 * the day before the leaderboard resets, and a Sunday summary. Phones only —
 * the web version can't schedule notifications.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { listNames, reminderTimes, type BinSchedule } from './bins';
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

  if (wants(opts.prefs, 'bins')) {
    for (const r of reminderTimes(opts.bins, now, 6).slice(0, 12)) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}bin-${r.at.getTime()}`,
        content: { title: '🗑 Bins go out tomorrow', body: `${listNames(r.names)}. Put them out tonight!`, data: { type: 'bins' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at },
      });
    }
  }

  if (wants(opts.prefs, 'reset')) {
    const e = opts.periodEnd;
    const eve = new Date(e.getFullYear(), e.getMonth(), e.getDate() - 1, 18, 0);
    if (eve > now) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}reset`,
        content: { title: '🏁 Leaderboard resets tomorrow', body: 'Last chance to climb the table!', data: { type: 'reset' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: eve },
      });
    }
  }

  if (wants(opts.prefs, 'weekly')) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${PREFIX}weekly`,
      content: { title: 'Your week on Rotawise', body: 'See who’s top of the table this week 🏆', data: { type: 'weekly' } },
      // Sunday (1) at 6pm, every week.
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour: 18, minute: 0 },
    });
  }
}
