/**
 * Decides who in the house gets asked to do a chore.
 *
 * Pure function (no Firebase) so it can be unit-tested and, later, reused
 * on a server (e.g. a Cloud Function) without changes.
 */

export type AssignMode = 'overall' | 'chore';

export interface MemberStats {
  uid: string;
  username: string;
  totalCompleted: number;
  /** Points this period (chores weighted Quick 1 / Medium 2 / Big 3). Falls back to totalCompleted. */
  points?: number;
  /** Completions per chore, keyed by normalised chore key. */
  choreCounts: Record<string, number>;
  /** Millis since epoch of their most recent completion, or null if never. */
  lastCompletedAt: number | null;
  /** Millis since epoch they joined the house. */
  joinedAt: number;
}

/**
 * Returns the member who should be asked to do the chore, or null if there
 * is nobody else in the house.
 *
 * Rules:
 *  - The person reporting the chore is never chosen (they've passed on it).
 *  - mode 'overall': fewest points (chores weighted by size), i.e. furthest below their fair share.
 *  - mode 'chore':   fewest completions of this specific chore, then fewest overall.
 *  - Ties: whoever has gone longest without doing a chore (never counts as
 *    longest), then whoever has been in the house longest (more chances to
 *    have helped), then uid so the result is always deterministic.
 */
export function pickAssignee(
  members: MemberStats[],
  requesterUid: string,
  mode: AssignMode,
  choreKey: string,
): MemberStats | null {
  const candidates = members.filter((m) => m.uid !== requesterUid);
  if (candidates.length === 0) return null;

  const choreCount = (m: MemberStats) => m.choreCounts[choreKey] ?? 0;
  // Never completed anything sorts before any real timestamp.
  const last = (m: MemberStats) => m.lastCompletedAt ?? Number.MIN_SAFE_INTEGER;

  const sorted = [...candidates].sort((a, b) => {
    if (mode === 'chore') {
      const diff = choreCount(a) - choreCount(b);
      if (diff !== 0) return diff;
    }
    const total = (a.points ?? a.totalCompleted) - (b.points ?? b.totalCompleted);
    if (total !== 0) return total;
    const idle = last(a) - last(b);
    if (idle !== 0) return idle;
    const joined = a.joinedAt - b.joinedAt;
    if (joined !== 0) return joined;
    return a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0;
  });

  return sorted[0];
}
