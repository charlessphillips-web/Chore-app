/**
 * Bin days, set by the house admin (no council websites needed).
 * Each bin: a name, how often (every 1 or 2 weeks), and the date of one
 * collection (the next one). Everything else is worked out from that.
 */
export interface BinSchedule {
  id: string;
  name: string;
  /** 1 = every week, 2 = every other week. */
  every: 1 | 2;
  /** Any collection date ("YYYY-MM-DD"); later ones repeat from it. */
  anchor: string;
}

export const BIN_NAMES = ['General waste', 'Recycling', 'Food waste', 'Garden waste', 'Glass'];
export const MAX_BINS = 6;

const DAY = 86_400_000;
const dayNo = (d: Date) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
const parse = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const fromDayNo = (n: number) => {
  const u = new Date(n * DAY);
  return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
};

/** The next `count` collection dates on or after `from` (local midnight). */
export function nextCollections(b: BinSchedule, from: Date, count = 1): Date[] {
  const a = parse(b.anchor);
  if (!a) return [];
  const step = 7 * b.every;
  const start = dayNo(from);
  const anchor = dayNo(a);
  let first = anchor;
  if (first < start) first = anchor + Math.ceil((start - anchor) / step) * step;
  return Array.from({ length: count }, (_, i) => fromDayNo(first + i * step));
}

/** Bins collected on a given day. */
export function binsOn(bins: BinSchedule[], day: Date): string[] {
  return bins.filter((b) => {
    const [next] = nextCollections(b, day, 1);
    return next && dayNo(next) === dayNo(day);
  }).map((b) => b.name);
}

/** "Tuesday" */
export const weekdayName = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'long' });

/** "every Tuesday" / "every other Tuesday" */
export function scheduleLabel(b: BinSchedule): string {
  const a = parse(b.anchor);
  if (!a) return '';
  return `${b.every === 1 ? 'every' : 'every other'} ${weekdayName(a)}`;
}

/** Reminder times: 8pm the night before each of the next collections, merged by night. */
export function reminderTimes(bins: BinSchedule[], now: Date, weeks = 6): { at: Date; names: string[] }[] {
  const byNight = new Map<number, string[]>();
  for (const b of bins) {
    for (const d of nextCollections(b, now, Math.ceil(weeks / b.every))) {
      const night = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 20, 0);
      if (night.getTime() <= now.getTime()) continue;
      const k = night.getTime();
      byNight.set(k, [...(byNight.get(k) ?? []), b.name]);
    }
  }
  return [...byNight.entries()].sort((x, y) => x[0] - y[0]).map(([k, names]) => ({ at: new Date(k), names }));
}

/** "General waste and Recycling" */
export function listNames(names: string[]): string {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
