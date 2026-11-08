/**
 * The leaderboard (and "who's done the fewest") resets every 2 months:
 * Jan–Feb, Mar–Apr, May–Jun, Jul–Aug, Sep–Oct, Nov–Dec.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** First month (1-12) of the 2-month block containing `date`. */
function startMonth(date: Date): number {
  const m = date.getMonth() + 1;
  return m - ((m - 1) % 2);
}

/** e.g. "p2026_11" for Nov–Dec 2026. Safe to use as a Firestore field name. */
export function periodKey(date: Date = new Date()): string {
  return `p${date.getFullYear()}_${String(startMonth(date)).padStart(2, '0')}`;
}

/** e.g. "Nov – Dec 2026" */
export function periodLabel(date: Date = new Date()): string {
  const s = startMonth(date);
  return `${MONTHS[s - 1]} – ${MONTHS[s]} ${date.getFullYear()}`;
}

/** When the current period ends (start of the next one). */
export function periodEnd(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), startMonth(date) + 1, 1);
}
