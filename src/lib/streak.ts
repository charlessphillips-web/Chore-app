/**
 * Weekly streaks: how many weeks in a row you've logged at least one chore.
 * Weekly (not daily) so it never nags you into chores the house doesn't need.
 * A week you were mostly away doesn't break it.
 *
 * Pure (no imports) so it can be unit tested.
 */
export interface Streak {
  weeks: number;
  /** Monday of the last week you logged a chore, "YYYY-MM-DD" (local). */
  lastWeek: string;
}

const DAY = 24 * 60 * 60 * 1000;
/** Streak lengths that get confetti and a shout-out. */
export const MILESTONES = [4, 8, 12, 16, 20, 26, 52];

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Monday 00:00 (local) of the week `t` is in. */
export function weekStart(t: number): Date {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export const weekKey = (t: number) => ymd(weekStart(t));

function parse(key: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : null;
}

/**
 * Are all the weeks between your last chore week and this week "excused"
 * (you were away at least 4 of the 7 days)?
 */
function gapExcused(last: number, now: number, awayDays: (from: number, to: number) => number): boolean {
  const thisWeek = weekStart(now).getTime();
  for (let w = new Date(last); ; ) {
    w.setDate(w.getDate() + 7);
    w = weekStart(w.getTime() + DAY / 2);
    const t = w.getTime();
    if (t >= thisWeek) return true;
    const end = new Date(t); end.setDate(end.getDate() + 7);
    if (awayDays(t, end.getTime()) < 4) return false;
  }
}

/** Your streak as it stands now (0 if it's broken). Still alive if you did one last week. */
export function currentStreak(s: Streak | null | undefined, now: number, awayDays: (from: number, to: number) => number = () => 0): number {
  if (!s || s.weeks <= 0) return 0;
  const last = parse(s.lastWeek);
  if (last == null) return 0;
  const thisWeek = weekStart(now).getTime();
  if (last >= thisWeek) return s.weeks;
  const prev = weekStart(thisWeek - DAY).getTime();
  if (last >= prev) return s.weeks;
  return gapExcused(last, now, awayDays) ? s.weeks : 0;
}

/** Have you logged a chore this week already? */
export const doneThisWeek = (s: Streak | null | undefined, now: number) => !!s && s.lastWeek === weekKey(now);

/** Your streak after logging a chore now. */
export function afterChore(s: Streak | null | undefined, now: number, awayDays: (from: number, to: number) => number = () => 0): Streak {
  const key = weekKey(now);
  if (s && s.lastWeek === key) return s;
  const alive = currentStreak(s, now, awayDays);
  return { weeks: alive + 1, lastWeek: key };
}

/** The milestone you just hit (e.g. 4), or null. */
export function milestoneHit(before: Streak | null | undefined, after: Streak): number | null {
  if (before && before.weeks === after.weeks && before.lastWeek === after.lastWeek) return null;
  return MILESTONES.includes(after.weeks) ? after.weeks : null;
}

/** "Thu" style: days left this week to keep the streak. */
export function daysLeftThisWeek(now: number): number {
  const end = weekStart(now).getTime() + 7 * DAY;
  return Math.max(1, Math.ceil((end - now) / DAY));
}
