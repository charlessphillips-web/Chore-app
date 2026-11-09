/**
 * Anonymous usage counts for the owner dashboard: one counter per event
 * per day (e.g. "2026-11-09_chore_log": 12). Never linked to who did it.
 */
import { doc, increment, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

/** Every event we count. Keep in step with firestore.rules (analytics). */
export const EVENTS = {
  app_open: 'App opened',
  intro_start: 'Intro started',
  intro_skip: 'Intro skipped',
  intro_finish: 'Intro finished',
  signup: 'Signed up',
  house_create: 'House created',
  house_join: 'House joined',
  first_chore: 'First chore logged',
  chore_log: 'Chore logged',
  chore_flag: 'Chore flagged',
  chore_verify: 'Photo verified',
  chore_sendback: 'Chore sent back',
  offer_create: 'Offer made',
  offer_counter: 'Counter offer',
  offer_accept: 'Offer accepted',
  offer_paid: 'Offer paid',
  avatar_set: 'Profile picture set',
  feedback_sent: 'Feedback sent',
  tab_home: 'Home tab',
  tab_checks: 'Checks tab',
  tab_leaderboard: 'Ranks tab',
  tab_pay: 'Pay tab',
  tab_house: 'House tab',
  tab_settings: 'Settings tab',
} as const;
export type EventName = keyof typeof EVENTS;

/** "2026-11-09" in the phone's own time zone. */
export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Counts one event. Never throws or slows anything down. */
export function track(event: EventName) {
  if (!auth.currentUser || !(event in EVENTS)) return;
  const day = dayKey();
  setDoc(doc(db, 'analytics', `${day}_${event}`), { day, event, n: increment(1) }, { merge: true }).catch(() => {});
}
