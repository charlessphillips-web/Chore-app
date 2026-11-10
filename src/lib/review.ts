/**
 * Photo checks. Each chore photo needs TWO housemates to verify it (just one
 * in a 2-person house). Any ONE checker can send it back. If it isn't fully
 * checked within 24 hours it counts as verified automatically.
 *
 *   pending  -> still counts, shown in Checks for anyone who hasn't checked it
 *   verified -> counts (enough people verified)
 *   rejected -> taken off the chore-doer's score
 *
 * Kept free of Firebase so it can be tested; mirrored in firestore.rules.
 */
export type ReviewStatus = 'pending' | 'verified' | 'rejected';

export const AUTO_VERIFY_MS = 24 * 60 * 60 * 1000;

/** How many verifications a chore needs: 2, or 1 if there's only one other person. */
export function checksNeededFor(memberCount: number): 1 | 2 {
  return memberCount >= 3 ? 2 : 1;
}

/** Who has verified it so far, and how many are needed. Older chores needed 1. */
export function checkProgress(log: { checks?: string[] | null; checksNeeded?: number | null }) {
  return { done: log.checks?.length ?? 0, needed: log.checksNeeded ?? 1 };
}

/** What the status really is right now, taking the 24-hour rule into account. */
export function effectiveStatus(
  log: { status: ReviewStatus; at: number },
  now: number = Date.now(),
): ReviewStatus | 'auto_verified' {
  if (log.status === 'pending' && now - log.at >= AUTO_VERIFY_MS) return 'auto_verified';
  return log.status;
}

/** Should this chore be in `uid`'s Checks list? (Not theirs, not already verified by them.) */
export function needsCheckBy(
  log: { status: ReviewStatus; at: number; userId: string; checks?: string[] | null },
  uid: string,
  now: number = Date.now(),
): boolean {
  return log.userId !== uid && effectiveStatus(log, now) === 'pending' && !(log.checks ?? []).includes(uid);
}

/** Hours and minutes left before auto-verification, e.g. "23h left". */
export function timeLeft(at: number, now: number = Date.now()): string {
  const ms = Math.max(0, at + AUTO_VERIFY_MS - now);
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return `${h}h left`;
  return `${Math.max(1, Math.ceil(ms / 60_000))}m left`;
}

/** Reasons a checker can give for sending a chore back. */
export const REDO_REASONS = ['Still dirty', 'Only half done', "Photo doesn't show it", 'Wrong chore', 'Logged twice'] as const;

/** Reasons where the chore just doesn't count, with nothing to redo. */
export const NO_REDO_REASONS: readonly string[] = ['Logged twice'];
export const needsRedo = (reason: string) => !NO_REDO_REASONS.some((r) => reason === r || reason.startsWith(`${r}:`));

/** "Still dirty" + optional note -> "Still dirty: the hob is greasy" (max 140 chars). */
export function redoReason(reason: string, note: string): string {
  const n = note.trim().replace(/\s+/g, ' ');
  return (n ? `${reason}: ${n}` : reason).slice(0, 140);
}
