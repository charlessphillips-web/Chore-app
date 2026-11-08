/**
 * Photo verification. Housemates vote on each chore photo.
 *
 *   no votes yet            -> 'pending'   (still counts)
 *   👍 >= 👎 and at least one 👍 -> 'verified'  (counts)
 *   👎 > 👍                  -> 'rejected'  (does NOT count on the leaderboard)
 *
 * Kept free of Firebase so it can be tested, and mirrored in firestore.rules.
 */
export type ReviewStatus = 'pending' | 'verified' | 'rejected';
export type Vote = 'ok' | 'not_ok';

export function reviewStatus(okVoters: string[], notOkVoters: string[]): ReviewStatus {
  if (notOkVoters.length > okVoters.length) return 'rejected';
  if (okVoters.length > 0) return 'verified';
  return 'pending';
}

/** Sets (or clears, with null) one person's vote. Each person has at most one vote. */
export function applyVote(
  okVoters: string[],
  notOkVoters: string[],
  uid: string,
  vote: Vote | null,
): { okVoters: string[]; notOkVoters: string[] } {
  const ok = okVoters.filter((v) => v !== uid);
  const notOk = notOkVoters.filter((v) => v !== uid);
  if (vote === 'ok') ok.push(uid);
  if (vote === 'not_ok') notOk.push(uid);
  return { okVoters: ok, notOkVoters: notOk };
}

/**
 * How much the chore-doer's score changes when status goes from `before` to
 * `after`: -1 when it becomes rejected, +1 when a rejection is overturned.
 */
export function scoreDelta(before: ReviewStatus, after: ReviewStatus): -1 | 0 | 1 {
  const was = before === 'rejected';
  const now = after === 'rejected';
  return was === now ? 0 : now ? -1 : 1;
}
