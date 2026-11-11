/**
 * "Where am I?" for Home and Ranks, framed as fair share: what share of the
 * house's chore points you've done, against an equal share (100% ÷ people).
 * Pure function so it can be unit tested.
 */
export interface Standing {
  /** e.g. "22%". */
  sharePct: number;
  /** An equal share, e.g. 25 in a 4-person house. */
  fairPct: number;
  /** Big line under the number. */
  headline: string;
  /** Small line under the bar. */
  hint: string;
  /** Is there anyone to compare with (and any chores yet)? */
  active: boolean;
  /** e.g. "2nd", "joint 1st" (by points), or null. */
  place: string | null;
}

interface Scored {
  uid: string;
  username: string;
  totalCompleted: number;
  points?: number;
}

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

const pts = (m: Scored) => m.points ?? m.totalCompleted;

/** Points you'd need to do (alone) to reach an equal share. */
export function pointsToFairShare(mine: number, total: number, people: number): number {
  if (people <= 1) return 0;
  const fair = 1 / people;
  if (total > 0 && mine / total >= fair) return 0;
  return Math.max(1, Math.ceil((fair * total - mine) / (1 - fair)));
}

export function standing(members: Scored[], uid: string): Standing {
  const people = members.length;
  const me = members.find((m) => m.uid === uid);
  const mine = me ? pts(me) : 0;
  const total = members.reduce((n, m) => n + pts(m), 0);
  const fairPct = people > 0 ? Math.round(100 / people) : 100;

  if (people <= 1) {
    return {
      sharePct: 100, fairPct: 100, active: false, place: null,
      headline: 'Just you so far',
      hint: 'Share the house code to get your housemates on board',
    };
  }
  if (total === 0) {
    return {
      sharePct: 0, fairPct, active: false, place: null,
      headline: `Your fair share is ${fairPct}% of the chores`,
      hint: 'Nobody’s done a chore yet. Log one to get started',
    };
  }
  const sharePct = Math.round((mine / total) * 100);
  const need = pointsToFairShare(mine, total, people);
  const rank = members.filter((m) => pts(m) > mine).length + 1;
  const tied = members.filter((m) => m.uid !== uid && pts(m) === mine).length > 0;
  return {
    sharePct,
    fairPct,
    active: true,
    place: `${tied ? 'joint ' : ''}${ordinal(rank)}`,
    headline: `of the house's chores · fair share ${fairPct}%`,
    hint: need > 0
      ? `${need} point${need === 1 ? '' : 's'} to reach your fair share`
      : sharePct > fairPct + 5 ? 'You’re doing more than your fair share 👏' : 'You’re doing your fair share 👍',
  };
}
