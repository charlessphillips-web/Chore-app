/**
 * Photo checks. Each chore photo is checked by ONE housemate (not the person
 * who did it), who either verifies or rejects it. If nobody checks it within
 * 24 hours it counts as verified automatically.
 *
 *   pending  -> still counts, shown in everyone else's Checks tab
 *   verified -> counts
 *   rejected -> taken off the chore-doer's score
 *
 * Kept free of Firebase so it can be tested; mirrored in firestore.rules.
 */
export type ReviewStatus = 'pending' | 'verified' | 'rejected';

export const AUTO_VERIFY_MS = 24 * 60 * 60 * 1000;

/** What the status really is right now, taking the 24-hour rule into account. */
export function effectiveStatus(
  log: { status: ReviewStatus; at: number },
  now: number = Date.now(),
): ReviewStatus | 'auto_verified' {
  if (log.status === 'pending' && now - log.at >= AUTO_VERIFY_MS) return 'auto_verified';
  return log.status;
}

/** Should this chore be in `uid`'s Checks list? */
export function needsCheckBy(
  log: { status: ReviewStatus; at: number; userId: string },
  uid: string,
  now: number = Date.now(),
): boolean {
  return log.userId !== uid && effectiveStatus(log, now) === 'pending';
}

/** Hours and minutes left before auto-verification, e.g. "23h left". */
export function timeLeft(at: number, now: number = Date.now()): string {
  const ms = Math.max(0, at + AUTO_VERIFY_MS - now);
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return `${h}h left`;
  return `${Math.max(1, Math.ceil(ms / 60_000))}m left`;
}

/** Reasons a checker can give for sending a chore back. */
export const REDO_REASONS = ['Still dirty', 'Only half done', "Photo doesn't show it", 'Wrong chore'] as const;

/** "Still dirty" + optional note -> "Still dirty: the hob is greasy" (max 140 chars). */
export function redoReason(reason: string, note: string): string {
  const n = note.trim().replace(/\s+/g, ' ');
  return (n ? `${reason}: ${n}` : reason).slice(0, 140);
}
