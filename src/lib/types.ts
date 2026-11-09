import type { MemberStats } from './assign';
import type { HouseChore } from './chores';
import type { ReviewStatus } from './review';
import type { ResetRule } from './period';

export type Gender = 'Male' | 'Female' | 'Non-binary' | 'Other' | 'Prefer not to say';
export const GENDERS: Gender[] = ['Male', 'Female', 'Non-binary', 'Other', 'Prefer not to say'];

/** users/{uid} — private to the user. Demographics live here for later analysis. */
export interface UserProfile {
  username: string;
  /** "YYYY-MM-DD". Older test accounts may not have one yet. */
  dob: string | null;
  gender: Gender;
  isStudent: boolean;
  university: string | null;
  houseId: string | null;
  createdAt: number;
}

export type ProfileDetails = Pick<UserProfile, 'username' | 'dob' | 'gender' | 'isStudent' | 'university'>;

/** houses/{houseId} */
export interface House {
  id: string;
  name: string;
  code: string;
  createdBy: string;
  /** The house admin: first person in, or whoever it was handed to. */
  adminUid: string;
  chores: HouseChore[];
  /** When the leaderboard resets: every N months (default 2) or custom dates. */
  reset: ResetRule;
  createdAt: number;
}

/**
 * houses/{houseId}/members/{uid} — visible to everyone in the house.
 * totalCompleted / choreCounts are for the CURRENT 2-month period.
 */
export interface Member extends MemberStats {
  pushToken: string | null;
  /** Their monzo.me / paypal.me link, so housemates can pay them for chores. */
  payLink: string | null;
}

/** houses/{houseId}/logs/{id} — a completed chore. */
export interface ChoreLog {
  id: string;
  choreKey: string;
  choreName: string;
  userId: string;
  username: string;
  at: number;
  /** 2-month period it counts towards, e.g. "p2026_11". */
  period: string | null;
  requestId: string | null;
  /** Small JPEG (base64). Full photo is in photos/{logId}. */
  photoThumb: string | null;
  status: ReviewStatus;
  reviewedBy: string | null;
  reviewedByName: string | null;
  /** Why it was sent back, e.g. "Still dirty: the hob is greasy". */
  rejectReason: string | null;
  /** Done for someone else, who paid for it (see ChoreOffer): they get the point, not the doer. */
  offerId: string | null;
  creditTo: string | null;
  creditToName: string | null;
}

/** houses/{houseId}/requests/{id} — "this needs doing". */
export interface ChoreRequest {
  id: string;
  choreKey: string;
  choreName: string;
  needs: string;
  /** 'needs': someone flagged it. 'redo': a checker sent a chore back. */
  kind: 'needs' | 'redo';
  /** For redo: why it was sent back. */
  reason: string | null;
  requestedBy: string;
  requestedByName: string;
  assignedTo: string;
  assignedToName: string;
  status: 'open' | 'done';
  createdAt: number;
  completedBy: string | null;
  completedAt: number | null;
  /** A redo of a chore someone was paid to do. */
  offerId: string | null;
}

/**
 * houses/{houseId}/offers/{requestId} — "I'll pay £3 for someone to do my
 * chore". Each housemate can accept the price or make one counter offer;
 * the offerer accepts or declines counters. Whoever pays gets the point,
 * once they mark it as paid. The app never holds money.
 */
export interface ChoreOffer {
  id: string;
  requestId: string;
  choreKey: string;
  choreName: string;
  fromUid: string;
  fromName: string;
  /** Pence. */
  price: number;
  /** open → agreed (someone's doing it) → done (photo logged) → paid. Or cancelled. */
  status: 'open' | 'agreed' | 'done' | 'cancelled';
  counters: Record<string, { name: string; price: number }>;
  /** uids whose counter offers were declined. */
  declined: string[];
  doerUid: string | null;
  doerName: string | null;
  agreedPrice: number | null;
  logId: string | null;
  paid: boolean;
  createdAt: number;
}
