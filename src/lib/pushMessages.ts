/**
 * Every push notification Rotawise sends: the words, how loud it is, and
 * where tapping it goes. The server ("post room", functions/) builds
 * messages from these, so housemates can't send made-up ones.
 *
 * Sizes:
 *   big    → sound + buzz + "Time Sensitive" (gets through Focus), red badge
 *   normal → sound + banner, like a message
 *   quiet  → no sound or buzz, waits in the notification list
 */
import { formatPrice } from './money.ts';
import { listNames } from './bins.ts';
import type { NotifyKind } from './notifyPrefs.ts';

export type PushSize = 'big' | 'normal' | 'quiet';

export interface PushMessage {
  kind: NotifyKind;
  size: PushSize;
  title: string;
  body?: string;
  /** In-app link opened when it's tapped. */
  url: string;
  /** Buttons on the notification (registered in the app, see notifyActions). */
  category?: 'check' | 'bins';
  /** Extra info for the buttons. */
  extra?: Record<string, string>;
  /** Also wake the app in the background (e.g. to set up follow-up reminders). */
  wake?: boolean;
}

/** The big bins chore ("Taking big bins out on bin days"). */
export const BIG_BINS_KEY = 'taking big bins out on bin days';

/** "Cleaning the oven" → "cleaning the oven" (keeps "TV" etc). */
export const lower = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

const choreUrl = (key: string) => `/chore/${encodeURIComponent(key)}`;

// ---------- Bin night ----------

export type BinRound = 'first' | 'again' | 'last';

/**
 * Bin night reminders (8pm, 10pm, 7am bin day) until someone logs the bins.
 * Nobody's turn yet → big for everyone. Once someone's flagged it and it's
 * been given to a housemate → big for them, quiet for everyone else.
 */
export function binNight(o: { round: BinRound; bins: string[]; turn: string | null; forTurn: boolean }): PushMessage {
  const what = listNames(o.bins);
  const go = o.bins.length > 1 ? 'go' : 'goes';
  const base = { kind: 'bins' as const, url: choreUrl(BIG_BINS_KEY), category: 'bins' as const };
  const when = o.round === 'last' ? 'this morning' : 'tonight';
  if (o.turn && o.forTurn) {
    const title = o.round === 'first' ? `${o.turn}, your turn for the bins! 🗑`
      : o.round === 'again' ? `${o.turn}, bins still not out! 🗑` : `${o.turn}, last call for the bins! 🗑`;
    return { ...base, size: 'big', title, body: `${what} ${go} out ${when}.` };
  }
  if (o.turn) {
    const title = o.round === 'first' ? `Bin night 🗑 ${o.turn}'s turn` : `Bins still not out 🗑 ${o.turn}'s turn`;
    return { ...base, size: 'quiet', title, body: `${what} ${go} out ${when}.` };
  }
  const title = o.round === 'first' ? 'Bin night! 🗑' : o.round === 'again' ? 'Bins still not out! 🗑' : 'Last call! Bins out now 🗑';
  return { ...base, size: 'big', title, body: `${what} ${go} out ${when}. Anyone can do it.` };
}

/** Bin night: someone's logged the bins. Also asks for the photo check (one notification, not two). */
export const binsDone = (who: string, logId: string): PushMessage =>
  ({ kind: 'bins', size: 'quiet', title: `${who} took the bins out ✅`, body: 'Check the photo?', url: `/photo/${logId}`, category: 'check', extra: { logId } });

/** Short chore names for notifications ("Taking big bins out on bin days" → "the big bins"). */
const choreLabel = (name: string, key?: string) => (key === BIG_BINS_KEY ? 'the big bins' : lower(name));

// ---------- Chores ----------

/** It's your turn (someone flagged "Bins are full"). */
export function yourTurn(o: { name: string; needs: string; choreKey: string; turn?: { id: string; createdAt: number; choreName: string } }): PushMessage {
  // The chore's details ride along so their phone can set up follow-up reminders (turnReminders.ts).
  const follow = o.turn
    ? { wake: true, extra: { turnId: o.turn.id, needs: o.needs, choreKey: o.choreKey, choreName: o.turn.choreName, createdAt: String(o.turn.createdAt) } }
    : {};
  if (o.choreKey === BIG_BINS_KEY) {
    return { kind: 'turn', size: 'big', title: `${o.name}, your turn for the bins! 🗑`, url: choreUrl(o.choreKey), category: 'bins', ...follow };
  }
  return { kind: 'turn', size: 'big', title: `${o.name}, your turn: ${lower(o.needs)}`, url: choreUrl(o.choreKey), ...follow };
}

export const nudge = (o: { from: string; needs: string; choreKey: string }): PushMessage =>
  ({ kind: 'nudge', size: 'normal', title: `👋 ${o.from} nudged you: ${lower(o.needs)}`, url: choreUrl(o.choreKey) });

export const toCheck = (o: { who: string; chore: string; logId: string; forName?: string | null; choreKey?: string }): PushMessage => ({
  kind: 'check',
  size: 'quiet',
  title: `📸 ${o.who}: ${choreLabel(o.chore, o.choreKey)}${o.forName ? ` (for ${o.forName})` : ''}`,
  body: 'Check it?',
  url: `/photo/${o.logId}`,
  category: 'check',
  extra: { logId: o.logId },
});

export const stillToCheck = (o: { who: string; chore: string; logId: string }): PushMessage => ({
  kind: 'check',
  size: 'quiet',
  title: `📸 ${o.who}'s ${lower(o.chore)} still needs a check`,
  url: `/photo/${o.logId}`,
  category: 'check',
  extra: { logId: o.logId },
});

export const redo = (o: { chore: string; reason: string; by: string }): PushMessage =>
  ({ kind: 'redo', size: 'big', title: `↩️ Redo: ${lower(o.chore)}`, body: `“${o.reason}” (${o.by})`, url: '/home' });

export const notCounted = (o: { chore: string }): PushMessage =>
  ({ kind: 'redo', size: 'quiet', title: `${o.chore} didn't count`, body: 'Logged twice', url: '/home' });

export const reacted = (o: { who: string; emoji: string; chore: string }): PushMessage =>
  ({ kind: 'reactions', size: 'quiet', title: `${o.who} ${o.emoji} your ${lower(o.chore)}`, url: '/house' });

// ---------- Money ----------

export const offerMade = (o: { from: string; chore: string; price: number; offerId: string }): PushMessage =>
  ({ kind: 'offers', size: 'normal', title: `💰 ${formatPrice(o.price)} to do ${lower(o.chore)}`, body: `From ${o.from}`, url: `/offer/${o.offerId}` });

export const offerTaken = (o: { who: string; chore: string; price: number; offerId: string }): PushMessage =>
  ({ kind: 'offers', size: 'normal', title: `🤝 ${o.who}'s doing your ${lower(o.chore)} for ${formatPrice(o.price)}`, url: `/offer/${o.offerId}` });

export const counterMade = (o: { who: string; chore: string; price: number; offerId: string }): PushMessage =>
  ({ kind: 'offers', size: 'normal', title: `${o.who} wants ${formatPrice(o.price)} for ${lower(o.chore)}`, body: 'Accept or decline?', url: `/offer/${o.offerId}` });

export const counterAccepted = (o: { chore: string; price: number; offerId: string }): PushMessage =>
  ({ kind: 'offers', size: 'normal', title: `✅ Deal: ${lower(o.chore)} for ${formatPrice(o.price)}`, url: `/offer/${o.offerId}` });

export const counterDeclined = (o: { who: string; price: number; offerId: string }): PushMessage =>
  ({ kind: 'offers', size: 'quiet', title: `${o.who} said no to ${formatPrice(o.price)}`, url: `/offer/${o.offerId}` });

export const payReminder = (o: { who: string; chore: string; price: number; offerId: string }): PushMessage =>
  ({ kind: 'payments', size: 'big', title: `💷 Pay ${o.who} ${formatPrice(o.price)} for ${lower(o.chore)}`, url: `/offer/${o.offerId}` });

export const paid = (o: { who: string; price: number; offerId: string }): PushMessage =>
  ({ kind: 'payments', size: 'normal', title: `💷 ${o.who} paid you ${formatPrice(o.price)}`, url: `/offer/${o.offerId}` });

// ---------- Weekly ----------

export function weekly(o: { top: string[]; me: boolean }): PushMessage {
  const title = o.top.length === 0 ? '🏆 Quiet week. New week, fresh start'
    : o.me && o.top.length === 1 ? '🏆 You topped the house this week'
      : `🏆 ${listNames(o.top)} topped the house this week`;
  return { kind: 'weekly', size: 'quiet', title, url: '/leaderboard' };
}

// ---------- Sending ----------

/** What goes to Expo's push service for one phone. */
export function toExpo(m: PushMessage, token: string, badge?: number) {
  return {
    to: token,
    title: m.title,
    ...(m.body ? { body: m.body } : {}),
    sound: m.size === 'quiet' ? null : 'default',
    interruptionLevel: m.size === 'big' ? 'time-sensitive' : m.size === 'normal' ? 'active' : 'passive',
    priority: m.size === 'quiet' ? 'normal' : 'high',
    channelId: m.size === 'quiet' ? 'quiet' : 'default',
    ...(m.category ? { categoryId: m.category } : {}),
    ...(typeof badge === 'number' ? { badge } : {}),
    ...(m.wake ? { contentAvailable: true } : {}),
    data: { url: m.url, kind: m.kind, size: m.size, ...(m.extra ?? {}) },
  };
}
