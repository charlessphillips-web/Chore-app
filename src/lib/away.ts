/**
 * "I'm away" (visiting a friend, going home for the weekend...). While
 * you're away you aren't asked to do chores, and your fair share shrinks in
 * proportion to the days you were away this period.
 *
 * Pure (no imports) so it can be unit tested.
 */
export interface Away {
  /** Start of the first day away (ms). */
  from: number;
  /** End of the last day away (ms, exclusive: midnight after it). */
  until: number;
}

const DAY = 24 * 60 * 60 * 1000;

/** Keep at most this many trips on a member doc. */
export const MAX_AWAYS = 20;
/** Longest single trip you can set. */
export const MAX_AWAY_DAYS = 120;

/** "YYYY-MM-DD" (local) → start of that day (ms). */
export function dayStart(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/** Build a trip from two "YYYY-MM-DD" days (both inclusive), or an error. */
export function makeAway(fromYmd: string, untilYmd: string, now: number): Away | string {
  const from = dayStart(fromYmd);
  const last = dayStart(untilYmd);
  if (from == null || last == null) return 'Pick both dates.';
  const until = new Date(last).setDate(new Date(last).getDate() + 1);
  if (until <= from) return 'The last day must be on or after the first day.';
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (from < today.getTime()) return 'Trips can start today at the earliest.';
  if (until - from > MAX_AWAY_DAYS * DAY) return `That's more than ${MAX_AWAY_DAYS} days.`;
  return { from, until };
}

export function isAway(aways: Away[] | undefined, now: number): boolean {
  return (aways ?? []).some((a) => a.from <= now && now < a.until);
}

/** The trip you're on now, or the next one coming up. */
export function currentOrNextAway(aways: Away[] | undefined, now: number): Away | null {
  return [...(aways ?? [])].filter((a) => a.until > now).sort((a, b) => a.from - b.from)[0] ?? null;
}

/**
 * How much of the period you were (or will be) around: 1 = all of it.
 * Never below 0.05 so maths stays sane.
 */
export function presentWeight(aways: Away[] | undefined, start: number, end: number): number {
  const len = end - start;
  if (len <= 0) return 1;
  // Merge overlaps so a double-booked trip isn't counted twice.
  const sorted = [...(aways ?? [])].sort((a, b) => a.from - b.from);
  let away = 0;
  let curFrom = -Infinity;
  let curTo = -Infinity;
  const flush = () => { away += Math.max(0, Math.min(curTo, end) - Math.max(curFrom, start)); };
  for (const a of sorted) {
    if (a.from > curTo) { flush(); curFrom = a.from; curTo = a.until; } else curTo = Math.max(curTo, a.until);
  }
  flush();
  return Math.max(0.05, 1 - away / len);
}

/** Days (can be fractional) of trips that fall between from and to. */
export function awayDaysBetween(aways: Away[] | undefined, from: number, to: number): number {
  return (1 - presentWeight(aways, from, to)) * ((to - from) / DAY);
}

/** Your fair share (0–1) of the house's points, given everyone's weights. */
export function fairShareOf(uid: string, members: { uid: string; weight?: number }[]): number {
  const total = members.reduce((n, m) => n + (m.weight ?? 1), 0);
  const me = members.find((m) => m.uid === uid);
  return total > 0 && me ? (me.weight ?? 1) / total : 1;
}

/** Come back early: ends the trip you're on now (and cancels it if it hadn't started). */
export function endAway(aways: Away[] | undefined, a: Away, now: number): Away[] {
  return (aways ?? []).flatMap((x) => {
    if (x.from !== a.from || x.until !== a.until) return [x];
    return x.from >= now ? [] : [{ from: x.from, until: now }];
  });
}

/** Drop finished trips (keep the newest MAX_AWAYS) and add a new one. */
export function addAway(aways: Away[] | undefined, a: Away): Away[] {
  return [...(aways ?? []), a].sort((x, y) => y.from - x.from).slice(0, MAX_AWAYS);
}

/** "till Sun 22 Nov" style label for the last day away. */
export function awayLabel(a: Away): string {
  const last = new Date(a.until - 1);
  return last.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** When to ask "Not home tonight?": 9:30pm today, or in 30 minutes if it's already later than 9pm. */
export function awayAskTime(now: number): number {
  const d = new Date(now);
  d.setHours(21, 30, 0, 0);
  return now < d.getTime() - 30 * 60_000 ? d.getTime() : now + 30 * 60_000;
}
