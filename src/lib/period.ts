/**
 * The leaderboard (and "who's done the fewest") resets every few months.
 * Default is every 2 months; the house admin can pick 1, 2, 3 or 6.
 * Periods are calendar blocks counted from January, e.g. for 2 months:
 * Jan–Feb, Mar–Apr, May–Jun, Jul–Aug, Sep–Oct, Nov–Dec.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const RESET_OPTIONS = [1, 2, 3, 6] as const;
export type ResetMonths = (typeof RESET_OPTIONS)[number];
export const DEFAULT_RESET_MONTHS: ResetMonths = 2;

export function toResetMonths(v: unknown): ResetMonths {
  return RESET_OPTIONS.includes(v as ResetMonths) ? (v as ResetMonths) : DEFAULT_RESET_MONTHS;
}

/** "every month", "every 2 months" */
export function resetLabel(months: ResetMonths): string {
  return months === 1 ? 'every month' : `every ${months} months`;
}

/** First month (1-12) of the block containing `date`. */
function startMonth(date: Date, months: ResetMonths): number {
  const m = date.getMonth() + 1;
  return m - ((m - 1) % months);
}

/**
 * e.g. "p2026_11" for Nov–Dec 2026 (2-month periods), "p2026_10_m3" for
 * Oct–Dec 2026 (3-month periods). Safe to use as a Firestore field name.
 * Changing the length gives new keys, so the leaderboard starts fresh.
 */
export function periodKey(date: Date = new Date(), months: ResetMonths = DEFAULT_RESET_MONTHS): string {
  const base = `p${date.getFullYear()}_${String(startMonth(date, months)).padStart(2, '0')}`;
  return months === 2 ? base : `${base}_m${months}`;
}

/** e.g. "Nov – Dec 2026", or "Nov 2026" for monthly. */
export function periodLabel(date: Date = new Date(), months: ResetMonths = DEFAULT_RESET_MONTHS): string {
  const s = startMonth(date, months);
  const first = MONTHS[s - 1];
  return months === 1 ? `${first} ${date.getFullYear()}` : `${first} – ${MONTHS[s + months - 2]} ${date.getFullYear()}`;
}

/** When the current period ends (start of the next one). */
export function periodEnd(date: Date = new Date(), months: ResetMonths = DEFAULT_RESET_MONTHS): Date {
  return new Date(date.getFullYear(), startMonth(date, months) - 1 + months, 1);
}
