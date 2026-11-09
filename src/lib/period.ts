/**
 * The leaderboard (and "who's done the fewest") resets regularly.
 * Default: every 2 months, in calendar blocks from January
 * (Jan–Feb, Mar–Apr, …, Nov–Dec). The house admin can pick 1, 2, 3 or 6
 * months, or custom dates (e.g. a uni term). A custom period repeats with
 * the same length once it ends, until the admin changes it.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = 24 * 60 * 60 * 1000;

export const RESET_OPTIONS = [1, 2, 3, 6] as const;
export type ResetMonths = (typeof RESET_OPTIONS)[number];
export const DEFAULT_RESET_MONTHS: ResetMonths = 2;

/** Custom dates are "YYYY-MM-DD"; `end` is the last day (inclusive). */
export type ResetRule = ResetMonths | { start: string; end: string };

/** Longest custom period, in days. */
export const MAX_CUSTOM_DAYS = 366;

export function toResetMonths(v: unknown): ResetMonths {
  return RESET_OPTIONS.includes(v as ResetMonths) ? (v as ResetMonths) : DEFAULT_RESET_MONTHS;
}

/** Reads the house fields (resetMonths: 0 means custom dates). */
export function toResetRule(resetMonths: unknown, start: unknown, end: unknown): ResetRule {
  if (resetMonths === 0 && typeof start === 'string' && typeof end === 'string' && !customError(start, end, null)) {
    return { start, end };
  }
  return toResetMonths(resetMonths);
}

/** Day number (days since 1970) of a local calendar date, ignoring clock changes. */
const dayNo = (d: Date) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
const fromDayNo = (n: number) => {
  const u = new Date(n * DAY);
  return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
};
function parseDay(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getMonth() !== Number(m[2]) - 1) return null;
  return dayNo(d);
}

/** Error message for custom dates, or null if fine. Pass `today` to require the period to include today. */
export function customError(start: string, end: string, today: Date | null = new Date()): string | null {
  const s = parseDay(start);
  const e = parseDay(end);
  if (s === null) return 'Pick a start date.';
  if (e === null) return 'Pick an end date.';
  if (e <= s) return 'The end date must be after the start date.';
  if (e - s + 1 > MAX_CUSTOM_DAYS) return 'Pick a period of a year or less.';
  if (today && s > dayNo(today)) return 'The start date can’t be in the future.';
  if (today && e < dayNo(today)) return 'The end date must be today or later.';
  return null;
}

interface Bounds {
  /** First day of the period (local midnight). */
  start: Date;
  /** Start of the next period (local midnight). */
  end: Date;
  key: string;
}

function bounds(date: Date, rule: ResetRule): Bounds {
  if (typeof rule === 'object') {
    const s = parseDay(rule.start)!;
    const len = parseDay(rule.end)! - s + 1;
    // Before the start date: treat as the first period. After the end: repeat.
    const k = Math.max(0, Math.floor((dayNo(date) - s) / len));
    const first = s + k * len;
    return {
      start: fromDayNo(first),
      end: fromDayNo(first + len),
      key: `c${rule.start.replace(/-/g, '')}_${len}_${k}`,
    };
  }
  const months = rule;
  const m = date.getMonth() + 1;
  const sm = m - ((m - 1) % months);
  const base = `p${date.getFullYear()}_${String(sm).padStart(2, '0')}`;
  return {
    start: new Date(date.getFullYear(), sm - 1, 1),
    end: new Date(date.getFullYear(), sm - 1 + months, 1),
    key: months === 2 ? base : `${base}_m${months}`,
  };
}

/** "every 2 months", "every month", "on custom dates" */
export function resetLabel(rule: ResetRule): string {
  if (typeof rule === 'object') return 'on custom dates';
  return rule === 1 ? 'every month' : `every ${rule} months`;
}

/**
 * Firestore field name for the period, e.g. "p2026_11" (2 months, Nov–Dec),
 * "p2026_10_m3" (3 months), "c20260915_98_0" (custom). Changing the rule
 * gives new keys, so the leaderboard starts fresh.
 */
export function periodKey(date: Date = new Date(), rule: ResetRule = DEFAULT_RESET_MONTHS): string {
  return bounds(date, rule).key;
}

/** e.g. "Nov – Dec 2026", "Nov 2026", or "15 Sep – 21 Dec 2026" for custom dates. */
export function periodLabel(date: Date = new Date(), rule: ResetRule = DEFAULT_RESET_MONTHS): string {
  const { start, end } = bounds(date, rule);
  if (typeof rule === 'object') {
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
    const sameYear = start.getFullYear() === last.getFullYear();
    const fmt = (d: Date, year: boolean) => `${d.getDate()} ${MONTHS[d.getMonth()]}${year ? ` ${d.getFullYear()}` : ''}`;
    return `${fmt(start, !sameYear)} – ${fmt(last, true)}`;
  }
  const y = start.getFullYear();
  return rule === 1 ? `${MONTHS[start.getMonth()]} ${y}` : `${MONTHS[start.getMonth()]} – ${MONTHS[start.getMonth() + rule - 1]} ${y}`;
}

export function periodStart(date: Date = new Date(), rule: ResetRule = DEFAULT_RESET_MONTHS): Date {
  return bounds(date, rule).start;
}

/** When the current period ends (start of the next one). */
export function periodEnd(date: Date = new Date(), rule: ResetRule = DEFAULT_RESET_MONTHS): Date {
  return bounds(date, rule).end;
}
