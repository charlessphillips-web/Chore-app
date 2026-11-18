/**
 * "Rotawise Wrapped": the end-of-period recap. Pure (no imports) so it can
 * be unit tested.
 */
export interface WrapMember {
  uid: string;
  username: string;
  points?: number;
  totalCompleted: number;
  choreCounts: Record<string, number>;
}

export interface Wrapped {
  totalChores: number;
  totalPoints: number;
  /** Who did the biggest share (ties shared). */
  top: { names: string[]; pct: number } | null;
  fairPct: number;
  mostDone: { key: string; name: string; count: number } | null;
  me: { pct: number; chores: number; points: number; topChore: string | null; place: number } | null;
}

const pts = (m: WrapMember) => m.points ?? m.totalCompleted;

export function wrap(members: WrapMember[], uid: string, choreName: (key: string) => string): Wrapped {
  const totalPoints = members.reduce((n, m) => n + pts(m), 0);
  const totalChores = members.reduce((n, m) => n + m.totalCompleted, 0);
  const pct = (m: WrapMember) => (totalPoints ? Math.round((pts(m) / totalPoints) * 100) : 0);
  const max = Math.max(0, ...members.map(pts));
  const top = totalPoints > 0 && members.length > 1
    ? { names: members.filter((m) => pts(m) === max).map((m) => m.username), pct: pct(members.find((m) => pts(m) === max)!) }
    : null;

  const counts: Record<string, number> = {};
  for (const m of members) for (const [k, n] of Object.entries(m.choreCounts)) counts[k] = (counts[k] ?? 0) + n;
  const best = Object.entries(counts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const mostDone = best ? { key: best[0], name: choreName(best[0]), count: best[1] } : null;

  const mine = members.find((m) => m.uid === uid);
  const myBest = mine ? Object.entries(mine.choreCounts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] : null;
  const me = mine
    ? {
        pct: pct(mine), chores: mine.totalCompleted, points: pts(mine),
        topChore: myBest ? choreName(myBest[0]) : null,
        place: members.filter((m) => pts(m) > pts(mine)).length + 1,
      }
    : null;

  return { totalChores, totalPoints, top, fairPct: members.length ? Math.round(100 / members.length) : 100, mostDone, me };
}
