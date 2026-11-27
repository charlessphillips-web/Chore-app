/**
 * Reminders the phone schedules for itself: bin night (8pm and 10pm the night
 * before, 7am on bin day) and the day before the leaderboard resets.
 * Rescheduled whenever the app sees a change, so once someone's logged the
 * bins, or the bins have been given to someone, every phone that opens the
 * app updates. Phones only: the web version can't schedule notifications.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { wants, type NotifyPrefs } from './notifyPrefs';
import { binNightPlan, type BinNightInput } from './binNight';
import { turnReminderPlan, type MyTurn } from './turnReminders';
import type { PushMessage } from './pushMessages';

const PREFIX = 'rw-';
const level = { big: 'timeSensitive', normal: 'active', quiet: 'passive' } as const;

export async function scheduleReminders(opts: {
  binNight: BinNightInput;
  prefs: NotifyPrefs;
  /** When the leaderboard resets (start of the next period). */
  periodEnd: Date;
  /** Chores you've been given and haven't done: follow-up reminders until you do. */
  turns?: MyTurn[];
}) {
  if (Platform.OS === 'web') return;
  // Start clean: remove every reminder we scheduled before.
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(existing.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  const now = new Date();

  if (wants(opts.prefs, 'bins')) {
    // iPhones allow 64 scheduled notifications per app; this stays well under.
    for (const r of binNightPlan(opts.binNight, now).slice(0, 15)) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}bin-${r.at.getTime()}`,
        content: {
          title: r.msg.title,
          body: r.msg.body,
          sound: r.msg.size === 'quiet' ? undefined : 'default',
          interruptionLevel: level[r.msg.size],
          categoryIdentifier: r.msg.category,
          data: { url: r.msg.url, size: r.msg.size, kind: 'bins' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at },
      });
    }
  }

  if (wants(opts.prefs, 'turn')) {
    for (const r of turnReminderPlan(opts.turns ?? [], now.getTime()).slice(0, 30)) await schedule(r.id, r.at, r.msg);
  }

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

  if (wants(opts.prefs, 'weekly')) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${PREFIX}weekly`,
      content: { title: '🏆 Who topped the house this week?', data: { url: '/leaderboard', size: 'quiet' }, interruptionLevel: 'passive' },
      // Sunday (1) at 6pm, every week.
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour: 18, minute: 0 },
    });
  }
}

const levels = { big: 'timeSensitive', normal: 'active', quiet: 'passive' } as const;

async function schedule(id: string, at: Date, msg: PushMessage) {
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: msg.title,
      body: msg.body,
      sound: msg.size === 'quiet' ? undefined : 'default',
      interruptionLevel: levels[msg.size],
      categoryIdentifier: msg.category,
      data: { url: msg.url, size: msg.size, kind: msg.kind },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
  });
}

/** Follow-ups for one chore you've just been given (called in the background when "your turn" arrives). */
export async function scheduleTurnReminders(turn: MyTurn) {
  if (Platform.OS === 'web') return;
  await cancelTurnReminders(turn.id);
  for (const r of turnReminderPlan([turn], Date.now())) await schedule(r.id, r.at, r.msg);
}

/** Stop the follow-ups for a chore (it's been done or cancelled). */
export async function cancelTurnReminders(requestId: string) {
  if (Platform.OS === 'web') return;
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(all.filter((n) => n.identifier.startsWith(`rw-turn-${requestId}-`)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}
