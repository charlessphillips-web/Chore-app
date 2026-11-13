/**
 * What happens the moment you log a chore. Pure (no imports) so it can be
 * unit tested.
 *
 *   Quick chore (1 pt)      → "toast": buzz + small "+1" pill
 *   Medium / Big (2–3 pts)  → "popup": card + small purple burst, closes itself
 *   You reach fair share    → "fair": full confetti, stays until you tap
 */
export type CelebrationTier = 'toast' | 'popup' | 'fair';

export interface Celebration {
  tier: CelebrationTier;
  points: number;
  line: string;
  /** Your share of the house's points, before and after (0–100). */
  beforePct: number;
  afterPct: number;
  /** An equal share, e.g. 25 in a 4-person house. */
  fairPct: number;
}

/** Cheeky lines per chore key; anything else uses GENERIC. */
const LINES: Record<string, string[]> = {
  bins: ['Bins conquered.', 'Out of sight, out of mind.', 'Bin day, handled.'],
  'taking big bins out on bin days': ['Bins on the kerb. Legend.', 'Bin day, handled.', 'The bin men thank you.'],
  'cleaning kitchen surfaces': ['Surfaces: spotless.', 'Kitchen’s never looked better.', 'You could eat off that.'],
  hoovering: ['Crumbs eliminated.', 'Carpet looking crisp.', 'Hoovered like a pro.'],
  'tidying sitting room': ['Sofa’s ready for Match of the Day.', 'Lounge reset.', 'Tidy. Very tidy.'],
  'cleaning sink': ['Sink: sparkling.', 'Not a crumb left.', 'Plughole’s happy.'],
  'emptying dishwasher': ['Dishwasher emptied. Hero.', 'Clean mugs for all.', 'Cupboards restocked.'],
  'cleaning microwave': ['Microwave: no more mystery splatters.', 'Ding. Done.', 'Spotless in there.'],
  'cleaning oven': ['Oven reborn.', 'That was a big one. Respect.', 'Grease: defeated.'],
  'cleaning stove': ['Hob gleaming.', 'Stove sorted.', 'Ready for the next fry-up.'],
};
const GENERIC = ['Nice one.', 'Job done.', 'House points secured.', 'Clean sheet.', 'Back of the net.'];

/** Pick a line. `seed` keeps it deterministic in tests (defaults to random). */
export function celebrationLine(choreKey: string, seed = Math.random()): string {
  const list = LINES[choreKey] ?? GENERIC;
  return list[Math.min(list.length - 1, Math.floor(seed * list.length))];
}

/**
 * `mine`/`total` are points BEFORE this chore; `people` is house size.
 */
export function celebration(
  opts: { mine: number; total: number; people: number; points: number; choreKey: string },
  seed?: number,
): Celebration {
  const { mine, total, people, points, choreKey } = opts;
  const pct = (m: number, t: number) => (t > 0 ? Math.round((m / t) * 100) : 0);
  const fairPct = people > 0 ? Math.round(100 / people) : 100;
  const beforePct = pct(mine, total);
  const afterPct = pct(mine + points, total + points);
  const fair = 1 / Math.max(1, people);
  const wasBelow = total === 0 || mine / total < fair;
  const nowAt = (mine + points) / (total + points) >= fair;
  const tier: CelebrationTier = people > 1 && wasBelow && nowAt ? 'fair' : points >= 2 ? 'popup' : 'toast';
  const line = tier === 'fair' ? 'You hit your fair share.' : celebrationLine(choreKey, seed);
  return { tier, points, line, beforePct, afterPct, fairPct };
}
