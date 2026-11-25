/**
 * The "post room" rules: given a change in the database, who gets which
 * notification. Pure functions (no Firebase), so they can be tested.
 * Messages are built from what actually changed, never from text a phone sends.
 */
import * as M from '../../src/lib/pushMessages.ts';
import { needsRedo } from '../../src/lib/review.ts';
import { binsOn } from '../../src/lib/bins.ts';
import type { PushMessage } from '../../src/lib/pushMessages.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>;
export interface Send { to: string[]; msg: PushMessage }

const HOUR = 3_600_000;
const ms = (t: unknown): number | null => {
  if (!t) return null;
  if (typeof t === 'number') return t;
  const x = t as { toMillis?: () => number };
  return typeof x.toMillis === 'function' ? x.toMillis() : null;
};

/** Is it bin night (6pm the night before → noon on bin day)? Which bins? */
export function binNightNow(bins: Doc[] | undefined, now: Date): string[] {
  if (!bins?.length) return [];
  const h = now.getHours();
  if (h >= 18) return binsOn(bins as never, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  if (h < 12) return binsOn(bins as never, now);
  return [];
}

/** A chore was logged. */
export function logCreated(log: Doc, logId: string, house: Doc, memberUids: string[], now: Date): Send[] {
  const others = memberUids.filter((u) => u !== log.userId);
  if (log.choreKey === M.BIG_BINS_KEY && binNightNow(house.bins, now).length) {
    return [{ to: others, msg: M.binsDone(log.username, logId) }];
  }
  return [{ to: others, msg: M.toCheck({ who: log.username, chore: log.choreName, logId, forName: log.creditToName ?? null, choreKey: log.choreKey }) }];
}

/** A chore changed: sent back, reacted to, or the 12-hour "still needs a check". */
export function logUpdated(before: Doc, after: Doc, logId: string, memberUids: string[], names: Record<string, string>): Send[] {
  const out: Send[] = [];
  const owner = after.userId as string;
  if (before.status === 'pending' && after.status === 'rejected') {
    const reason = String(after.rejectReason ?? '');
    const by = String(after.reviewedByName ?? 'A housemate');
    out.push({ to: [owner], msg: needsRedo(reason) ? M.redo({ chore: after.choreName, reason, by }) : M.notCounted({ chore: after.choreName }) });
  }
  const was: Doc = before.reactions ?? {};
  const now: Doc = after.reactions ?? {};
  for (const [uid, emoji] of Object.entries(now)) {
    if (uid === owner || was[uid] === emoji || typeof emoji !== 'string') continue;
    out.push({ to: [owner], msg: M.reacted({ who: names[uid] ?? 'A housemate', emoji, chore: after.choreName }) });
  }
  if (!before.checkReminderSent && after.checkReminderSent && after.status === 'pending') {
    const checked: string[] = after.checks ?? [];
    const to = memberUids.filter((u) => u !== owner && !checked.includes(u));
    out.push({ to, msg: M.stillToCheck({ who: after.username, chore: after.choreName, logId }) });
  }
  return out;
}

/** "Bins are full" given to someone (redos already got a "Redo" notification). */
export function requestCreated(r: Doc): Send[] {
  if (r.kind !== 'needs' || r.status !== 'open' || !r.assignedTo) return [];
  return [{ to: [r.assignedTo], msg: M.yourTurn({ name: r.assignedToName, needs: r.needs, choreKey: r.choreKey }) }];
}

/** Someone nudged (at most every 3 hours, also enforced by the rules). */
export function requestUpdated(before: Doc, after: Doc, names: Record<string, string>): Send[] {
  const a = ms(after.lastNudgedAt);
  const b = ms(before.lastNudgedAt);
  if (!a || a === b || after.status !== 'open' || !after.assignedTo) return [];
  if (b && a - b < 3 * HOUR) return [];
  return [{ to: [after.assignedTo], msg: M.nudge({ from: names[after.lastNudgedBy] ?? 'A housemate', needs: after.needs, choreKey: after.choreKey }) }];
}

export function offerCreated(o: Doc, offerId: string, memberUids: string[]): Send[] {
  return [{ to: memberUids.filter((u) => u !== o.fromUid), msg: M.offerMade({ from: o.fromName, chore: o.choreName, price: o.price, offerId }) }];
}

export function offerUpdated(b: Doc, a: Doc, offerId: string): Send[] {
  const out: Send[] = [];
  const chore = a.choreName as string;
  // New counter offers → the person offering.
  for (const [uid, c] of Object.entries((a.counters ?? {}) as Doc)) {
    if (!b.counters?.[uid]) out.push({ to: [a.fromUid], msg: M.counterMade({ who: c.name, chore, price: c.price, offerId }) });
  }
  // Counters declined → that person.
  for (const uid of (a.declined ?? []) as string[]) {
    if (!(b.declined ?? []).includes(uid) && a.counters?.[uid]) {
      out.push({ to: [uid], msg: M.counterDeclined({ who: a.fromName, price: a.counters[uid].price, offerId }) });
    }
  }
  // Agreed: either someone took it at the price, or a counter was accepted.
  if (b.status === 'open' && a.status === 'agreed' && a.doerUid) {
    const counter = a.counters?.[a.doerUid];
    if (counter && counter.price === a.agreedPrice && a.agreedPrice !== a.price) {
      out.push({ to: [a.doerUid], msg: M.counterAccepted({ chore, price: a.agreedPrice, offerId }) });
    } else {
      out.push({ to: [a.fromUid], msg: M.offerTaken({ who: a.doerName, chore, price: a.agreedPrice ?? a.price, offerId }) });
    }
  }
  const ra = ms(a.remindedAt);
  if (ra && ra !== ms(b.remindedAt) && !a.paid) {
    out.push({ to: [a.fromUid], msg: M.payReminder({ who: a.doerName, chore, price: a.agreedPrice ?? a.price, offerId }) });
  }
  if (!b.paid && a.paid && a.doerUid) {
    out.push({ to: [a.doerUid], msg: M.paid({ who: a.fromName, price: a.agreedPrice ?? a.price, offerId }) });
  }
  return out;
}

/**
 * Bin night round for one house. Returns nothing if the bins aren't due or
 * someone's already logged them since 6pm the night before.
 */
export function binRound(o: {
  round: M.BinRound;
  now: Date;
  house: Doc;
  members: { uid: string; username: string; away: boolean }[];
  /** Times big-bins was logged recently. */
  binLogs: number[];
  /** An open "big bins need taking out" request, if any. */
  request: { assignedTo: string; assignedToName: string } | null;
}): Send[] {
  const { now } = o;
  const day = o.round === 'last' ? now : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const bins = binsOn(o.house.bins ?? [], day);
  if (!bins.length) return [];
  const eve = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1, 18, 0).getTime();
  if (o.binLogs.some((t) => t >= eve)) return [];
  const here = o.members.filter((m) => !m.away).map((m) => m.uid);
  if (!here.length) return [];
  const turn = o.request && here.includes(o.request.assignedTo) ? o.request : null;
  if (!turn) return [{ to: here, msg: M.binNight({ round: o.round, bins, turn: null, forTurn: false }) }];
  return [
    { to: [turn.assignedTo], msg: M.binNight({ round: o.round, bins, turn: turn.assignedToName, forTurn: true }) },
    { to: here.filter((u) => u !== turn.assignedTo), msg: M.binNight({ round: o.round, bins, turn: turn.assignedToName, forTurn: false }) },
  ];
}

/** Sunday evening: who did the most points in the last 7 days. */
export function weeklyTop(logs: { userId: string; username: string; points: number }[]): { uids: string[]; names: string[] } {
  const by = new Map<string, { name: string; pts: number }>();
  for (const l of logs) {
    const x = by.get(l.userId) ?? { name: l.username, pts: 0 };
    x.pts += l.points || 1;
    by.set(l.userId, x);
  }
  const best = Math.max(0, ...[...by.values()].map((x) => x.pts));
  if (!best) return { uids: [], names: [] };
  const top = [...by.entries()].filter(([, x]) => x.pts === best);
  return { uids: top.map(([u]) => u), names: top.map(([, x]) => x.name) };
}
