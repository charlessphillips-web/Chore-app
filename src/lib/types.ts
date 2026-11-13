import type { MemberStats } from './assign';
import type { HouseChore } from './chores';
import type { ReviewStatus } from './review';
import type { ResetRule } from './period';
import type { PayChoice } from './money';
import type { Avatar } from './avatar';
import type { HouseArea } from './postcode';
import type { NotifyPrefs } from './notifyPrefs';
import type { BinSchedule } from './bins';

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
  /** Which privacy policy they agreed to (see lib/legal.ts). */
  privacyVersion: string | null;
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
  /** Rough location from the postcode (area only, never the address). */
  area: HouseArea | null;
  /** Bin collection days, set by the admin. */
  bins: BinSchedule[];
  /** House stakes (prize for the top, forfeit for the bottom) switched on by the admin. */
  stakes: boolean;
  createdAt: number;
}

/**
 * houses/{houseId}/members/{uid} — visible to everyone in the house.
 * totalCompleted / points / choreCounts are for the CURRENT period.
 */
export interface Member extends MemberStats {
  pushToken: string | null;
  /** Profile picture: photo or drawn character (null = their initial). */
  avatar: Avatar | null;
  /** Notification types they've switched off (missing = on). */
  notifPrefs: NotifyPrefs;
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
  /** Who has verified it so far (uids and names), and how many it needs (2, or 1 in a 2-person house). */
  checks: string[];
  checkNames: string[];
  checksNeeded: number;
  /** The 12-hour "still needs checking" reminder has gone out. */
  checkReminderSent: boolean;
  /** The full-size photo has been deleted (only the thumbnail is kept). */
  photoDeleted: boolean;
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
  /** When someone last nudged the person whose turn it is. */
  lastNudgedAt: number | null;
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
  /** Counter offers, each with how that person wants to be paid. */
  counters: Record<string, { name: string; price: number; pay: PayChoice | null }>;
  /** uids whose counter offers were declined. */
  declined: string[];
  doerUid: string | null;
  doerName: string | null;
  agreedPrice: number | null;
  /** How the doer asked to be paid for this deal. */
  doerPay: PayChoice | null;
  /** When the doer last nudged the payer. */
  remindedAt: number | null;
  logId: string | null;
  paid: boolean;
  /** When it was marked paid (null for older deals). */
  paidAt?: number | null;
  createdAt: number;
}
