import type { AssignMode, MemberStats } from './assign';
import type { ReviewStatus } from './review';

export type Gender = 'Male' | 'Female' | 'Non-binary' | 'Other' | 'Prefer not to say';

/** users/{uid} — private to the user. Demographics live here for later analysis. */
export interface UserProfile {
  username: string;
  age: number;
  gender: Gender;
  isStudent: boolean;
  university: string | null;
  houseId: string | null;
  createdAt: number;
}

/** houses/{houseId} */
export interface House {
  id: string;
  name: string;
  code: string;
  createdBy: string;
  createdAt: number;
}

/** houses/{houseId}/members/{uid} — visible to everyone in the house. */
export interface Member extends MemberStats {
  pushToken: string | null;
}

/** houses/{houseId}/logs/{id} — a completed chore. */
export interface ChoreLog {
  id: string;
  choreKey: string;
  choreName: string;
  userId: string;
  username: string;
  at: number;
  requestId: string | null;
  /** Small JPEG (base64) shown in the feed. Full photo is in photos/{logId}. */
  photoThumb: string | null;
  okVoters: string[];
  notOkVoters: string[];
  status: ReviewStatus;
}

/** houses/{houseId}/requests/{id} — "this needs doing". */
export interface ChoreRequest {
  id: string;
  choreKey: string;
  choreName: string;
  mode: AssignMode;
  requestedBy: string;
  requestedByName: string;
  assignedTo: string;
  assignedToName: string;
  status: 'open' | 'done';
  createdAt: number;
  completedBy: string | null;
  completedAt: number | null;
}
