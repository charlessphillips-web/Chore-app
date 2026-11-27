/**
 * Stops bin night reminders on every phone once someone's logged the bins.
 * Their phone sends an invisible "bins are done" push; iPhone wakes Rotawise
 * in the background for a moment and this cancels tonight's bin alarms.
 * (Won't run on a phone where Rotawise was swiped away from the app
 * switcher; that phone catches up next time it's opened.)
 */
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { isBinsDone } from './binNight';
import { wakeData } from './turnReminders';
import { cancelTurnReminders, scheduleTurnReminders } from './reminders';

export { isBinsDone };

export const BINS_DONE_TASK = 'rw-bins-done';

/** Cancels the bin reminders due in the next 14 hours (tonight's 8pm/10pm and tomorrow's 7am). */
export async function cancelTonightsBinReminders(now = Date.now()) {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const due = all.filter((n) => {
    const m = /^rw-bin-(\d+)$/.exec(n.identifier);
    return m && Number(m[1]) <= now + 14 * 3_600_000;
  });
  await Promise.all(due.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}


TaskManager.defineTask(BINS_DONE_TASK, async ({ data }) => {
  if (isBinsDone(data)) await cancelTonightsBinReminders().catch(() => {});
  const d = wakeData(data);
  // A chore's been done or cancelled: stop its follow-ups.
  if (typeof d.turnDone === 'string') await cancelTurnReminders(d.turnDone).catch(() => {});
  // You've been given a chore: set up its follow-ups (even if you never open the app).
  if (typeof d.turnId === 'string' && typeof d.needs === 'string' && typeof d.choreKey === 'string') {
    await scheduleTurnReminders({
      id: d.turnId, kind: 'needs', needs: d.needs, choreKey: d.choreKey,
      choreName: typeof d.choreName === 'string' ? d.choreName : d.needs,
      createdAt: Number(d.createdAt) || Date.now(),
    }).catch(() => {});
  }
});

Notifications.registerTaskAsync(BINS_DONE_TASK).catch(() => {});
