/**
 * "Where am I on the leaderboard?" for the purple card on Home.
 * Pure function so it can be unit tested.
 */
export interface Standing {
  /** Big line, e.g. "You're 2nd with 3 chores". */
  headline: string;
  /** Small line under the bar, e.g. "2 more to overtake Sam". */
  hint: string;
  /** 0–1 for the progress bar, or null to hide it (no one to race). */
  progress: number | null;
  /** e.g. "2nd", "joint 1st", or null if alone / nobody has scored. */
  place: string | null;
}

interface Scored {
  uid: string;
  username: string;
  totalCompleted: number;
}

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

const chores = (n: number) => `${n} chore${n === 1 ? '' : 's'}`;

function names(list: Scored[]): string {
  const n = list.map((m) => m.username).sort((a, b) => a.localeCompare(b));
  if (n.length <= 2) return n.join(' and ');
  return `${n[0]}, ${n[1]} and ${n.length - 2} more`;
}

export function standing(members: Scored[], uid: string): Standing {
  const me = members.find((m) => m.uid === uid);
  const mine = me?.totalCompleted ?? 0;
  const others = members.filter((m) => m.uid !== uid);

  if (others.length === 0) {
    return {
      headline: `You've done ${chores(mine)} this period`,
      hint: 'Share the house code to get your housemates on the board',
      progress: null,
      place: null,
    };
  }

  const best = Math.max(mine, ...others.map((m) => m.totalCompleted));
  if (best === 0) {
    return { headline: 'Nobody’s on the board yet', hint: 'Log a chore to take the lead', progress: 0, place: null };
  }

  const ahead = others.filter((m) => m.totalCompleted > mine);
  const rank = ahead.length + 1;

  if (rank === 1) {
    const tied = others.filter((m) => m.totalCompleted === mine);
    if (tied.length > 0) {
      return { headline: `You're joint 1st with ${chores(mine)}`, hint: `1 more to beat ${names(tied)}`, progress: 1, place: 'joint 1st' };
    }
    const second = Math.max(...others.map((m) => m.totalCompleted));
    const runnersUp = others.filter((m) => m.totalCompleted === second);
    return {
      headline: `You're top with ${chores(mine)}`,
      hint: `${mine - second} ahead of ${names(runnersUp)}`,
      progress: 1,
      place: '1st',
    };
  }

  // The next person up (lowest score that's still above mine).
  const target = Math.min(...ahead.map((m) => m.totalCompleted));
  const targets = ahead.filter((m) => m.totalCompleted === target);
  const tiedWithMe = others.some((m) => m.totalCompleted === mine);
  return {
    headline: mine === 0
      ? 'You haven’t logged a chore yet'
      : `You're ${tiedWithMe ? 'joint ' : ''}${ordinal(rank)} with ${chores(mine)}`,
    hint: `${target - mine + 1} more to overtake ${names(targets)}`,
    progress: mine / best,
    place: `${tiedWithMe ? 'joint ' : ''}${ordinal(rank)}`,
  };
}
