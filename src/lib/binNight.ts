/** Bin night reminders a phone schedules for itself (see reminders.ts). */
import { nextCollections, binsOn, type BinSchedule } from './bins.ts';
import { binNight, type BinRound, type PushMessage } from './pushMessages.ts';
import { isAway, type Away } from './away.ts';

export interface BinNightInput {
  bins: BinSchedule[];
  /** When the big bins were last logged (ms), recent ones. */
  binLogs: number[];
  /** Whose turn it is, if someone's flagged "Big bins need taking out". */
  turn: { uid: string; name: string } | null;
  me: string;
  aways: Away[];
}

/** Every bin night reminder from now: when, and what it says for this phone. */
export function binNightPlan(o: BinNightInput, now: Date, weeks = 4): { at: Date; round: BinRound; msg: PushMessage }[] {
  const days = new Map<number, Date>();
  for (const b of o.bins) for (const d of nextCollections(b, now, Math.ceil(weeks / b.every))) days.set(d.getTime(), d);
  const out: { at: Date; round: BinRound; msg: PushMessage }[] = [];
  for (const day of [...days.values()].sort((a, b) => a.getTime() - b.getTime())) {
    const bins = binsOn(o.bins, day);
    const eve = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1, 18, 0).getTime();
    if (o.binLogs.some((t) => t >= eve)) continue; // already done
    const times: [BinRound, Date][] = [
      ['first', new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1, 20, 0)],
      ['again', new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1, 22, 0)],
      ['last', new Date(day.getFullYear(), day.getMonth(), day.getDate(), 7, 0)],
    ];
    // Whose turn only counts for the coming bin night.
    const turn = eve - now.getTime() < 30 * 3_600_000 ? o.turn : null;
    for (const [round, at] of times) {
      if (at.getTime() <= now.getTime() || isAway(o.aways, at.getTime())) continue;
      const msg = binNight({ round, bins, turn: turn?.name ?? null, forTurn: !!turn && turn.uid === o.me });
      out.push({ at, round, msg });
    }
  }
  return out;
}

