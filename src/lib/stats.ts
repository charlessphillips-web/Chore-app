/**
 * Number-crunching for the owner dashboard. Pure functions (no database),
 * so they can be unit tested.
 */

/** Age on a date from "YYYY-MM-DD" (kept here so this file has no imports). */
function ageOn(dob: string, today: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  let age = today.getFullYear() - Number(m[1]);
  const mo = today.getMonth() + 1;
  if (mo < Number(m[2]) || (mo === Number(m[2]) && today.getDate() < Number(m[3]))) age--;
  return age;
}

export interface UserRow {
  dob: string | null;
  gender: string | null;
  isStudent: boolean | null;
  university: string | null;
  createdAt: number | null;
}

export interface Bar {
  label: string;
  count: number;
  /** 0–1 share of the total. */
  share: number;
}

/** Counts each value, biggest first; anything past `max` is grouped as "Other". */
export function tally(values: (string | null | undefined)[], max = 8): Bar[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    const k = v && v.trim() ? v.trim() : 'Not given';
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const total = values.length || 1;
  let rows = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (rows.length > max) {
    const other = rows.slice(max - 1).reduce((n, [, c]) => n + c, 0);
    rows = [...rows.slice(0, max - 1), ['Other', other]];
  }
  return rows.map(([label, count]) => ({ label, count, share: count / total }));
}

export const AGE_BANDS = ['13–17', '18–20', '21–23', '24–29', '30+'];

export function ageBand(dob: string | null, today = new Date()): string | null {
  const age = dob ? ageOn(dob, today) : null;
  if (age === null) return null;
  if (age < 18) return '13–17';
  if (age <= 20) return '18–20';
  if (age <= 23) return '21–23';
  if (age <= 29) return '24–29';
  return '30+';
}

/** Age bands in age order (not by size), so the chart reads young → old. */
export function ageBars(users: UserRow[], today = new Date()): Bar[] {
  const bands = users.map((u) => ageBand(u.dob, today));
  const total = users.length || 1;
  return AGE_BANDS.map((label) => {
    const count = bands.filter((b) => b === label).length;
    return { label, count, share: count / total };
  });
}

const WEEK = 7 * 24 * 60 * 60 * 1000;

/** Sign-ups in each of the last `weeks` weeks, oldest first. Label = week start, e.g. "3 Nov". */
export function signupsByWeek(users: UserRow[], weeks = 8, now = Date.now()): Bar[] {
  const counts = Array.from({ length: weeks }, () => 0);
  for (const u of users) {
    if (!u.createdAt) continue;
    const ago = Math.floor((now - u.createdAt) / WEEK);
    if (ago >= 0 && ago < weeks) counts[weeks - 1 - ago]++;
  }
  const most = Math.max(1, ...counts);
  return counts.map((count, i) => {
    const start = new Date(now - (weeks - i) * WEEK);
    return { label: start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), count, share: count / most };
  });
}

export function countSince(times: (number | null)[], ms: number, now = Date.now()): number {
  return times.filter((t) => t !== null && now - t <= ms).length;
}

/** Spreadsheet of users with no names or IDs (anonymous), for download. */
export function usersCsv(users: (UserRow & { area: string | null })[], today = new Date()): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['signed_up', 'age', 'age_band', 'gender', 'student', 'university', 'house_area'];
  const rows = users.map((u) => [
    u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : '',
    u.dob ? ageOn(u.dob, today) ?? '' : '',
    ageBand(u.dob, today) ?? '',
    u.gender ?? '',
    u.isStudent === null ? '' : u.isStudent ? 'yes' : 'no',
    u.university ?? '',
    u.area ?? '',
  ].map(esc).join(','));
  return [head.join(','), ...rows].join('\n');
}

// ---------- Usage analytics (anonymous daily counters) ----------

export interface Counter {
  day: string;
  event: string;
  n: number;
}

/** "YYYY-MM-DD" for `daysAgo` days before `now` (local time). */
export function dayString(daysAgo: number, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Total per event over the last `days` days (including today). */
export function eventTotals(rows: Counter[], days: number, now = new Date()): Record<string, number> {
  const from = dayString(days - 1, now);
  const out: Record<string, number> = {};
  for (const r of rows) if (r.day >= from) out[r.event] = (out[r.event] ?? 0) + r.n;
  return out;
}

/** One event per day for the last `days` days, oldest first. */
export function daily(rows: Counter[], event: string, days: number, now = new Date()): Bar[] {
  const counts = Array.from({ length: days }, (_, i) => {
    const day = dayString(days - 1 - i, now);
    return { day, count: rows.filter((r) => r.day === day && r.event === event).reduce((n, r) => n + r.n, 0) };
  });
  const most = Math.max(1, ...counts.map((c) => c.count));
  return counts.map((c) => ({ label: `${Number(c.day.slice(8))}/${Number(c.day.slice(5, 7))}`, count: c.count, share: c.count / most }));
}

/** Sign-up funnel: each step as a share of the first step. */
export function funnel(totals: Record<string, number>, steps: [string, string[]][]): Bar[] {
  const counts = steps.map(([label, events]) => ({ label, count: events.reduce((n, e) => n + (totals[e] ?? 0), 0) }));
  const first = Math.max(1, counts[0]?.count ?? 0);
  return counts.map((c) => ({ ...c, share: Math.min(1, c.count / first) }));
}
