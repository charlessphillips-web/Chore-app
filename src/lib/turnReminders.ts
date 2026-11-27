/**
 * Follow-up reminders for a chore that's been given to you, until it's done:
 * 2 hours and 5 hours after you're asked, then every morning (9am) and
 * evening (6pm) for up to 3 days. Nothing between 10pm and 8am. Louder once
 * it's been waiting a day. Your own phone schedules them (see reminders.ts),
 * so they work without a server.
 */
import { BIG_BINS_KEY, lower, type PushMessage } from './pushMessages.ts';

export interface MyTurn {
  id: string;
  kind: 'needs' | 'redo';
  needs: string;
  choreKey: string;
  choreName: string;
  createdAt: number;
}

const HOUR = 3_600_000;
const quiet = (d: Date) => d.getHours() >= 22 || d.getHours() < 8;

export function turnReminder(t: MyTurn, waitingMs: number): PushMessage {
  const days = Math.floor(waitingMs / (24 * HOUR));
  const url = `/chore/${encodeURIComponent(t.choreKey)}?requestId=${t.id}`;
  const what = t.kind === 'redo' ? `redo ${lower(t.choreName)}` : lower(t.needs);
  if (days >= 1) {
    return { kind: 'turn', size: 'big', title: `⏰ Still waiting: ${what}`, body: `It's been ${days} day${days > 1 ? 's' : ''}. Your housemates are counting on you.`, url };
  }
  return { kind: 'turn', size: 'normal', title: `⏰ Still to do: ${what}`, body: 'Done it? Log it with a photo.', url };
}

/** When each reminder goes off for one chore. */
export function turnTimes(t: MyTurn, now: number): Date[] {
  const start = t.createdAt;
  const end = start + 3 * 24 * HOUR;
  const out: number[] = [start + 2 * HOUR, start + 5 * HOUR];
  const d0 = new Date(start);
  for (let day = 0; day <= 3; day++) {
    for (const h of [9, 18]) out.push(new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + day, h).getTime());
  }
  const sorted = [...new Set(out)].filter((x) => x > start + HOUR && x <= end && x > now).sort((a, b) => a - b);
  // Drop night-time ones, and any within 2 hours of the one before.
  const kept: number[] = [];
  for (const x of sorted) {
    if (quiet(new Date(x))) continue;
    if (kept.length && x - kept[kept.length - 1] < 2 * HOUR) continue;
    kept.push(x);
  }
  return kept.map((x) => new Date(x));
}

/** Every follow-up for the chores you've been given (bin night has its own reminders). */
export function turnReminderPlan(turns: MyTurn[], now: number): { id: string; at: Date; msg: PushMessage }[] {
  return turns
    .filter((t) => t.choreKey !== BIG_BINS_KEY || t.kind === 'redo')
    .flatMap((t) => turnTimes(t, now).map((at) => ({ id: `rw-turn-${t.id}-${at.getTime()}`, at, msg: turnReminder(t, at.getTime() - t.createdAt) })));
}

/** Pulls our data out of a background notification (it arrives in a few shapes). */
export function wakeData(payload: unknown): Record<string, unknown> {
  const p = payload as { data?: Record<string, unknown> & { dataString?: string }; notification?: { request?: { content?: { data?: Record<string, unknown> } } } } | null;
  if (!p) return {};
  let fromString: Record<string, unknown> = {};
  try { if (p.data?.dataString) fromString = JSON.parse(p.data.dataString); } catch { /* not JSON */ }
  return { ...(p.notification?.request?.content?.data ?? {}), ...(p.data ?? {}), ...fromString };
}
