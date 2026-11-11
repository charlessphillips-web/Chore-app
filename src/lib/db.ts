import {
  collectionGroup, count, getAggregateFromServer, getCountFromServer, getDocs, sum, Timestamp,
  collection, deleteDoc, deleteField, doc, getDoc, increment, limit, onSnapshot, orderBy, query,
  runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch,
  type DocumentData, type FirestoreError,
} from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { auth, db } from './firebase';
import { generateHouseCode, normaliseHouseCode } from './houseCode';
import { choreKey, choreSize, cleanChoreName, DEFAULT_CHORES, type HouseChore } from './chores';
import { pickAssignee } from './assign';
import { checksNeededFor, needsRedo } from './review';
import { DEFAULT_RESET_MONTHS, periodKey, toResetRule, type ResetRule } from './period';
import { sendPush } from './notifications';
import type { ChoreLog, ChoreOffer, ChoreRequest, House, Member, ProfileDetails, UserProfile } from './types';
import { formatPrice, type PayChoice } from './money';
import { toAvatar, type Avatar } from './avatar';
import type { HouseArea } from './postcode';
import { PRIVACY_VERSION } from './legal';
import { wants, type NotifyKind, type NotifyPrefs } from './notifyPrefs';
import type { BinSchedule } from './bins';
import { track } from './analytics';

// Firestore stores server timestamps; the app works in millis.
const ms = (v: unknown): number | null =>
  v && typeof (v as Timestamp).toMillis === 'function' ? (v as Timestamp).toMillis() : null;

type OnError = (e: FirestoreError) => void;

const userRef = (uid: string) => doc(db, 'users', uid);
const houseRef = (houseId: string) => doc(db, 'houses', houseId);
const memberRef = (houseId: string, uid: string) => doc(db, 'houses', houseId, 'members', uid);
const codeRef = (code: string) => doc(db, 'houseCodes', code);
const wallpaperRef = (houseId: string) => doc(db, 'houses', houseId, 'wallpaper', 'current');

// ---------- Profile ----------

export async function createProfile(uid: string, p: ProfileDetails): Promise<void> {
  await setDoc(userRef(uid), {
    ...p, houseId: null, createdAt: serverTimestamp(),
    privacyVersion: PRIVACY_VERSION, privacyAcceptedAt: serverTimestamp(),
  });
  track('signup');
}

/** Records that you agreed to the current privacy policy. */
export async function acceptPrivacy(uid: string): Promise<void> {
  await updateDoc(userRef(uid), { privacyVersion: PRIVACY_VERSION, privacyAcceptedAt: serverTimestamp() });
}

/** Edits your details. Your housemates see your new username straight away. */
export async function updateProfile(uid: string, p: ProfileDetails, houseId: string | null): Promise<void> {
  const batch = writeBatch(db);
  batch.update(userRef(uid), { ...p, age: deleteField() });
  if (houseId) batch.update(memberRef(houseId, uid), { username: p.username });
  await batch.commit();
}

export function watchProfile(uid: string, cb: (p: UserProfile | null) => void) {
  // includeMetadataChanges: also tell us when the server confirms a write,
  // even if the data itself didn't change.
  return onSnapshot(userRef(uid), { includeMetadataChanges: true }, (snap) => {
    // Ignore the instant local copy of our own write: wait until the server
    // has confirmed it, otherwise we'd try to read a house before the server
    // knows we've joined it (and the security rules would refuse).
    if (snap.metadata.hasPendingWrites) return;
    if (!snap.exists()) return cb(null);
    const d = snap.data();
    cb({
      username: d.username,
      dob: d.dob ?? null,
      gender: d.gender,
      isStudent: d.isStudent,
      university: d.university ?? null,
      houseId: d.houseId ?? null,
      createdAt: ms(d.createdAt) ?? Date.now(),
      privacyVersion: typeof d.privacyVersion === 'string' ? d.privacyVersion : null,
    });
  });
}

// ---------- Houses ----------

// joinCode lets the security rules check you actually knew the house code.
function newMemberDoc(username: string, joinCode: string) {
  return {
    username,
    joinCode,
    stats: {},
    lastCompletedAt: null,
    joinedAt: serverTimestamp(),
    pushToken: null,
  };
}

/** Creates a house with a fresh unique code. The creator becomes its admin. */
export async function createHouse(uid: string, username: string, name: string, area: HouseArea | null = null): Promise<string> {
  const houseDoc = doc(collection(db, 'houses'));
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateHouseCode();
    const ok = await runTransaction(db, async (tx) => {
      if ((await tx.get(codeRef(code))).exists()) return false; // code taken, try another
      tx.set(houseDoc, {
        name: name.trim(), code, createdBy: uid, adminUid: uid, chores: DEFAULT_CHORES, resetMonths: DEFAULT_RESET_MONTHS, area, createdAt: serverTimestamp(),
      });
      tx.set(codeRef(code), { houseId: houseDoc.id });
      tx.set(memberRef(houseDoc.id, uid), newMemberDoc(username, code));
      tx.update(userRef(uid), { houseId: houseDoc.id });
      return true;
    });
    if (ok) {
      track('house_create');
      return houseDoc.id;
    }
  }
  throw new Error('Could not create a unique house code — please try again.');
}

export async function joinHouse(uid: string, username: string, rawCode: string): Promise<string> {
  const code = normaliseHouseCode(rawCode);
  if (!code) throw new Error('House codes are 6 letters/numbers, e.g. K7MPQ2.');
  const codeSnap = await getDoc(codeRef(code));
  if (!codeSnap.exists()) throw new Error('No house found with that code. Double-check it with your housemate.');
  const houseId = codeSnap.data().houseId as string;

  const batch = writeBatch(db);
  batch.set(memberRef(houseId, uid), newMemberDoc(username, code));
  batch.update(userRef(uid), { houseId });
  await batch.commit();
  track('house_join');
  return houseId;
}

/** Who takes over as admin if `leavingUid` goes: whoever has been in the house longest. */
export function nextAdmin(members: Member[], leavingUid: string): string | null {
  const others = members.filter((m) => m.uid !== leavingUid).sort((a, b) => a.joinedAt - b.joinedAt);
  return others[0]?.uid ?? null;
}

export async function leaveHouse(uid: string, house: House, members: Member[]): Promise<void> {
  // Hand over admin first, while we're still allowed to.
  if (house.adminUid === uid) {
    const next = nextAdmin(members, uid);
    if (next) await updateDoc(houseRef(house.id), { adminUid: next });
  }
  // Clear the profile next so the app routes away before the house data
  // becomes unreadable.
  await updateDoc(userRef(uid), { houseId: null });
  await deleteDoc(memberRef(house.id, uid));
}

/** Deletes the user's profile and account completely. */
export async function deleteAccount(uid: string, house: House | null, members: Member[]): Promise<void> {
  if (house) await leaveHouse(uid, house, members);
  await deleteDoc(userRef(uid));
  if (auth.currentUser) await deleteUser(auth.currentUser);
}

/** Clears your house if you were removed from it (your profile still pointed there). */
export async function clearRemovedHouse(uid: string): Promise<void> {
  await updateDoc(userRef(uid), { houseId: null });
}

// --- Admin-only ---

export async function removeMember(houseId: string, uid: string): Promise<void> {
  await deleteDoc(memberRef(houseId, uid));
}

export async function makeAdmin(houseId: string, uid: string): Promise<void> {
  await updateDoc(houseRef(houseId), { adminUid: uid });
}

export async function updateHouse(
  houseId: string,
  patch: { name?: string; chores?: HouseChore[]; area?: HouseArea | null; bins?: BinSchedule[] },
): Promise<void> {
  await updateDoc(houseRef(houseId), patch);
}

/** Admin: how often the leaderboard resets. Stored as resetMonths (0 = custom dates). */
export async function setResetRule(houseId: string, rule: ResetRule): Promise<void> {
  await updateDoc(
    houseRef(houseId),
    typeof rule === 'object'
      ? { resetMonths: 0, customStart: rule.start, customEnd: rule.end }
      : { resetMonths: rule, customStart: deleteField(), customEnd: deleteField() },
  );
}

export async function setWallpaper(houseId: string, uid: string, data: string | null): Promise<void> {
  if (data) await setDoc(wallpaperRef(houseId), { data, updatedBy: uid, updatedAt: serverTimestamp() });
  else await deleteDoc(wallpaperRef(houseId));
}

// --- Live data ---

export function watchWallpaper(houseId: string, cb: (data: string | null) => void, onError?: OnError) {
  return onSnapshot(wallpaperRef(houseId), (s) => cb(s.exists() ? (s.data().data as string) : null), onError);
}

export function watchHouse(houseId: string, cb: (h: House | null) => void, onError?: OnError) {
  return onSnapshot(
    houseRef(houseId),
    (snap) => {
      if (!snap.exists()) return cb(null);
      const d = snap.data();
      cb({
        id: snap.id,
        name: d.name,
        code: d.code,
        createdBy: d.createdBy,
        // Houses made before admins existed: the creator is admin.
        adminUid: d.adminUid ?? d.createdBy,
        chores: Array.isArray(d.chores) ? d.chores : DEFAULT_CHORES,
        reset: toResetRule(d.resetMonths, d.customStart, d.customEnd),
        area: d.area && typeof d.area.outcode === 'string' ? (d.area as HouseArea) : null,
        bins: Array.isArray(d.bins) ? (d.bins as BinSchedule[]) : [],
        createdAt: ms(d.createdAt) ?? Date.now(),
      });
    },
    onError,
  );
}

/** Turns a member doc into scores for the given period (see periodKey). */
export const toMember = (id: string, d: DocumentData, period: string): Member => {
  const p = d.stats?.[period] ?? {};
  return {
    uid: id,
    username: d.username,
    totalCompleted: p.total ?? 0,
    // Older chores (before sizes) were worth 1 point each.
    points: p.points ?? p.total ?? 0,
    choreCounts: p.chores ?? {},
    lastCompletedAt: ms(d.lastCompletedAt),
    joinedAt: ms(d.joinedAt) ?? Date.now(),
    pushToken: d.pushToken ?? null,
    avatar: toAvatar(d.avatar),
    notifPrefs: d.notifPrefs && typeof d.notifPrefs === 'object' ? (d.notifPrefs as NotifyPrefs) : {},
  };
};

/** Raw member docs; turn them into scores with toMember (the period depends on the house's reset setting). */
export interface MemberDoc {
  id: string;
  data: DocumentData;
}

export function watchMembers(houseId: string, cb: (m: MemberDoc[]) => void, onError?: OnError) {
  return onSnapshot(
    collection(db, 'houses', houseId, 'members'),
    (snap) => cb(snap.docs.map((s) => ({ id: s.id, data: s.data() }))),
    onError,
  );
}

export function watchOpenRequests(houseId: string, cb: (r: ChoreRequest[]) => void, onError?: OnError) {
  const q = query(
    collection(db, 'houses', houseId, 'requests'),
    where('status', '==', 'open'),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) =>
      cb(
        snap.docs.map((s) => {
          const d = s.data();
          return {
            ...(d as ChoreRequest),
            id: s.id,
            needs: d.needs ?? `${d.choreName} needs doing`,
            kind: d.kind === 'redo' ? 'redo' : 'needs',
            reason: d.reason ?? null,
            offerId: d.offerId ?? null,
            lastNudgedAt: ms(d.lastNudgedAt),
            createdAt: ms(d.createdAt) ?? Date.now(),
            completedAt: ms(d.completedAt),
          };
        }),
      ),
    onError,
  );
}

export function watchRecentLogs(houseId: string, cb: (l: ChoreLog[]) => void, onError?: OnError) {
  const q = query(collection(db, 'houses', houseId, 'logs'), orderBy('at', 'desc'), limit(50));
  return onSnapshot(
    q,
    (snap) =>
      cb(
        snap.docs.map((s) => {
          const d = s.data();
          return {
            id: s.id,
            choreKey: d.choreKey,
            choreName: d.choreName,
            userId: d.userId,
            username: d.username,
            at: ms(d.at) ?? Date.now(),
            period: d.period ?? null,
            requestId: d.requestId ?? null,
            photoThumb: d.photoThumb ?? null,
            status: d.status ?? 'pending',
            reviewedBy: d.reviewedBy ?? null,
            reviewedByName: d.reviewedByName ?? null,
            rejectReason: d.rejectReason ?? null,
            checks: Array.isArray(d.checks) ? d.checks : [],
            checkNames: Array.isArray(d.checkNames) ? d.checkNames : [],
            checksNeeded: typeof d.checksNeeded === 'number' ? d.checksNeeded : 1,
            checkReminderSent: d.checkReminderSent === true,
            photoDeleted: d.photoDeleted === true,
            offerId: d.offerId ?? null,
            creditTo: d.creditTo ?? null,
            creditToName: d.creditToName ?? null,
          };
        }),
      ),
    onError,
  );
}

export async function setPushToken(houseId: string, uid: string, token: string | null) {
  await updateDoc(memberRef(houseId, uid), { pushToken: token });
}

/** Which notifications you want (only your own). */
export async function setNotifPrefs(houseId: string, uid: string, prefs: NotifyPrefs) {
  await updateDoc(memberRef(houseId, uid), { notifPrefs: prefs });
}

/** Your profile picture (only you can change yours). null = back to your initial. */
export async function setAvatar(houseId: string, uid: string, avatar: Avatar | null) {
  await updateDoc(memberRef(houseId, uid), { avatar });
  if (avatar) track('avatar_set');
}

// ---------- Chores ----------

/**
 * "Done it." Saves the photo, adds to the activity log and bumps the user's
 * score for this 2-month period. Closes the request if it was one, and lets
 * everyone else know there's a photo to check.
 */
export async function logChore(opts: {
  house: House;
  members: Member[];
  uid: string;
  username: string;
  chore: { key: string; name: string };
  photo: { thumb: string; full: string };
  requestId?: string | null;
  /** Doing it for someone who's paying (an agreed offer): they get the point. */
  offer?: ChoreOffer | null;
}): Promise<void> {
  const { house, uid, username, photo } = opts;
  const offer = opts.offer && opts.offer.doerUid === uid ? opts.offer : null;
  const requestId = opts.requestId ?? null;
  const name = cleanChoreName(opts.chore.name);
  const key = opts.chore.key || choreKey(name);
  if (!key) throw new Error('Pick a chore.');
  if (!photo?.thumb || !photo?.full) throw new Error('Take a photo of the finished chore first.');
  const period = periodKey(new Date(), house.reset);
  const points = choreSize(house.chores.find((c) => c.key === key) ?? { key });

  const batch = writeBatch(db);
  const logRef = doc(collection(db, 'houses', house.id, 'logs'));
  batch.set(logRef, {
    choreKey: key, choreName: name, userId: uid, username, at: serverTimestamp(), period, requestId,
    photoThumb: photo.thumb, status: 'pending', reviewedBy: null, reviewedByName: null,
    checks: [], checkNames: [], checksNeeded: checksNeededFor(opts.members.length), points,
    offerId: offer?.id ?? null, creditTo: offer?.fromUid ?? null, creditToName: offer?.fromName ?? null,
  });
  batch.set(doc(db, 'houses', house.id, 'photos', logRef.id), { userId: uid, data: photo.full });
  if (offer) {
    // The payer gets the point when they mark it as paid, not now.
    batch.update(doc(db, 'houses', house.id, 'offers', offer.id), { status: 'done', logId: logRef.id });
  } else {
    // Dot-paths so only this period's / this chore's counters change.
    batch.update(memberRef(house.id, uid), {
      currentPeriod: period,
      [`stats.${period}.total`]: increment(1),
      // Set (not increment) so chores from before points existed count as 1 each.
      [`stats.${period}.points`]: (opts.members.find((m) => m.uid === uid)?.points ?? 0) + points,
      [`stats.${period}.chores.${key}`]: increment(1),
      lastCompletedAt: serverTimestamp(),
    });
  }
  if (requestId) {
    batch.update(doc(db, 'houses', house.id, 'requests', requestId), {
      status: 'done', completedBy: uid, completedAt: serverTimestamp(),
    });
  }
  await batch.commit();
  track('chore_log');
  if (!offer && !opts.members.find((m) => m.uid === uid)?.lastCompletedAt) track('first_chore');

  const others = opts.members.filter((m) => m.uid !== uid && m.pushToken && wants(m.notifPrefs, 'check')).map((m) => m.pushToken!);
  if (others.length) {
    await sendPush(others, {
      title: offer ? `${username} did: ${name} (for ${offer.fromName})` : `${username} did: ${name}`,
      body: 'Check the photo — one of you needs to verify it.',
      data: { type: 'chore_check', houseId: house.id },
    });
  }
}

/** Loads the full-size photo for one chore. */
export async function getChorePhoto(houseId: string, logId: string): Promise<string | null> {
  const snap = await getDoc(doc(db, 'houses', houseId, 'photos', logId));
  return snap.exists() ? (snap.data().data as string) : null;
}

/**
 * Deletes a checked chore's full-size photo (keeps the small thumbnail), so
 * the free database doesn't fill up. Safe to call more than once.
 */
export async function clearFullPhoto(houseId: string, logId: string) {
  const b = writeBatch(db);
  b.update(doc(db, 'houses', houseId, 'logs', logId), { photoDeleted: true });
  b.delete(doc(db, 'houses', houseId, 'photos', logId));
  await b.commit();
}

export const CHECK_REMINDER_MS = 12 * 60 * 60 * 1000;

/**
 * 12 hours after a chore is logged, if it still isn't fully checked, remind
 * everyone who hasn't checked it yet. Whichever phone opens the app first
 * sends it; the rules make sure it only goes out once.
 */
export async function sendCheckReminder(houseId: string, log: ChoreLog, members: Member[]) {
  await updateDoc(doc(db, 'houses', houseId, 'logs', log.id), { checkReminderSent: true });
  const still = log.checksNeeded - log.checks.length;
  const to = members
    .filter((m) => m.uid !== log.userId && !log.checks.includes(m.uid) && m.pushToken && wants(m.notifPrefs, 'check'))
    .map((m) => m.pushToken!);
  if (to.length) {
    await sendPush(to, {
      title: `📸 ${log.choreName} still needs ${still} more check${still === 1 ? '' : 's'}`,
      body: `${log.username}'s photo hasn't been fully checked yet. Can you take a look?`,
      data: { type: 'chore_check', houseId },
    }).catch(() => false);
  }
}

/** One housemate verifies a chore photo. */
/**
 * One housemate verifies a chore photo. It's fully verified once enough
 * people have (2, or 1 in a 2-person house). Returns how many have checked.
 */
export async function verifyChore(houseId: string, logId: string, reviewer: { uid: string; username: string }) {
  const logRef = doc(db, 'houses', houseId, 'logs', logId);
  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(logRef);
    if (!snap.exists()) throw new Error('That chore no longer exists.');
    const log = snap.data();
    if (log.userId === reviewer.uid) throw new Error("You can't check your own chore.");
    if (log.status !== 'pending') throw new Error('This one has already been checked.');
    const checks: string[] = Array.isArray(log.checks) ? log.checks : [];
    const names: string[] = Array.isArray(log.checkNames) ? log.checkNames : [];
    if (checks.includes(reviewer.uid)) throw new Error('You’ve already checked this one.');
    const needed = typeof log.checksNeeded === 'number' ? log.checksNeeded : 1;
    const nextChecks = [...checks, reviewer.uid];
    const nextNames = [...names, reviewer.username];
    if (nextChecks.length >= needed) {
      tx.update(logRef, {
        checks: nextChecks, checkNames: nextNames, status: 'verified', reviewedBy: reviewer.uid,
        reviewedByName: nextNames.join(' and '), reviewedAt: serverTimestamp(), rejectReason: null,
      });
    } else {
      tx.update(logRef, { checks: nextChecks, checkNames: nextNames });
    }
    return { done: nextChecks.length, needed };
  });
  track('chore_verify');
  return result;
}

/**
 * One housemate sends a chore back: it comes off the chore-doer's score
 * (in the same write, so the two can't get out of step) and goes back to
 * them as "Redo" in their "Your turn" list.
 */
export async function sendBackChore(
  house: House,
  logId: string,
  reviewer: { uid: string; username: string },
  reason: string,
  members: Member[],
) {
  const log = await reviewChore(house.id, logId, reviewer, reason);
  track('chore_sendback');
  const owner = members.find((m) => m.uid === log.userId);
  if (owner?.pushToken && wants(owner.notifPrefs, 'redo')) {
    await sendPush([owner.pushToken], needsRedo(reason)
      ? { title: `Redo: ${log.choreName}`, body: `${reviewer.username} sent it back: ${reason}`, data: { type: 'chore_redo', houseId: house.id } }
      : { title: `${log.choreName} wasn't counted`, body: `${reviewer.username} marked it as logged twice. Nothing to redo.`, data: { type: 'chore_redo', houseId: house.id } });
  }
}

/** reason null = verify; a reason = send back. Returns the chore. */
async function reviewChore(
  houseId: string,
  logId: string,
  reviewer: { uid: string; username: string },
  reason: string | null,
): Promise<{ userId: string; choreName: string }> {
  const logRef = doc(db, 'houses', houseId, 'logs', logId);
  return runTransaction(db, async (tx) => {
    // Transactions must do all reads before any writes.
    const snap = await tx.get(logRef);
    if (!snap.exists()) throw new Error('That chore no longer exists.');
    const log = snap.data();
    if (log.userId === reviewer.uid) throw new Error("You can't check your own chore.");
    if (log.status !== 'pending') throw new Error('Someone has already checked this one.');
    const ownerRef = memberRef(houseId, log.userId);
    const owner = await tx.get(ownerRef);

    tx.update(logRef, {
      status: reason ? 'rejected' : 'verified',
      reviewedBy: reviewer.uid,
      reviewedByName: reviewer.username,
      reviewedAt: serverTimestamp(),
      rejectReason: reason,
    });
    if (reason && owner.exists()) {
      // Paid-for chores never added to the doer's score, so nothing to take off.
      if (log.period && !log.creditTo) {
        const was = owner.data().stats?.[log.period] ?? {};
        tx.update(ownerRef, {
          [`stats.${log.period}.total`]: increment(-1),
          [`stats.${log.period}.points`]: (was.points ?? was.total ?? 0) - (log.points ?? 1),
          [`stats.${log.period}.chores.${log.choreKey}`]: increment(-1),
          lastReviewAdjust: logId,
        });
      }
      // Back on their list to redo (not if it was just logged twice).
      if (needsRedo(reason)) tx.set(doc(collection(db, 'houses', houseId, 'requests')), {
        kind: 'redo',
        reason,
        logId,
        choreKey: log.choreKey,
        choreName: log.choreName,
        needs: `Redo: ${log.choreName}`,
        mode: 'overall',
        requestedBy: reviewer.uid,
        requestedByName: reviewer.username,
        assignedTo: log.userId,
        assignedToName: owner.data().username ?? log.username,
        status: 'open',
        createdAt: serverTimestamp(),
        completedBy: null,
        completedAt: null,
        offerId: log.offerId ?? null,
      });
    }
    return { userId: log.userId as string, choreName: log.choreName as string };
  });
}

export const NUDGE_EVERY_MS = 3 * 60 * 60 * 1000;

/** Reminds whoever's turn it is (at most every 3 hours per chore). */
export async function nudgeChore(houseId: string, request: ChoreRequest, from: { uid: string; username: string }, members: Member[]) {
  await updateDoc(doc(db, 'houses', houseId, 'requests', request.id), { lastNudgedAt: serverTimestamp(), lastNudgedBy: from.uid });
  track('chore_nudge');
  const who = members.find((m) => m.uid === request.assignedTo);
  const to = who && wants(who.notifPrefs, 'nudge') ? who.pushToken : null;
  if (to) {
    await sendPush([to], {
      title: `${from.username} nudged you 👋`,
      body: `${request.needs}. It's your turn.`,
      data: { type: 'chore_nudge', houseId },
    }).catch(() => false);
  }
}

/**
 * Closes a request without doing it: e.g. a redo that was a mistake, or a
 * "needs doing" that's no longer needed. Allowed for whoever it's for (redos
 * only), whoever made it, and the house admin.
 */
export async function cancelRequest(houseId: string, requestId: string, uid: string) {
  await updateDoc(doc(db, 'houses', houseId, 'requests', requestId), {
    status: 'cancelled', completedBy: uid, completedAt: serverTimestamp(),
  });
}

/**
 * "Bins are full." Picks whoever has done the fewest chores this period,
 * records the request, and pings them.
 */
export async function requestChore(opts: {
  house: House;
  requester: { uid: string; username: string };
  members: Member[];
  chore: HouseChore;
}): Promise<{ assignee: Member; notified: boolean }> {
  const { house, chore } = opts;
  const assignee = pickAssignee(opts.members, opts.requester.uid, 'overall', chore.key) as Member | null;
  if (!assignee) throw new Error("You're the only one in the house so far — share your house code first!");

  await setDoc(doc(collection(db, 'houses', house.id, 'requests')), {
    choreKey: chore.key,
    choreName: chore.name,
    needs: chore.needs,
    kind: 'needs',
    reason: null,
    mode: 'overall',
    requestedBy: opts.requester.uid,
    requestedByName: opts.requester.username,
    assignedTo: assignee.uid,
    assignedToName: assignee.username,
    status: 'open',
    createdAt: serverTimestamp(),
    completedBy: null,
    completedAt: null,
  });
  track('chore_flag');

  let notified = false;
  if (assignee.pushToken && wants(assignee.notifPrefs, 'turn')) {
    notified = await sendPush([assignee.pushToken], {
      title: `${chore.needs}!`,
      body: "It's your turn to do it. You've done the fewest chores in the house.",
      data: { type: 'chore_request', houseId: house.id },
    });
  }
  return { assignee, notified };
}

// ---------- Feedback (bug reports + suggestions) ----------

export type FeedbackType = 'bug' | 'suggestion';

/**
 * Sends a bug report or suggestion to feedback/{id}. Only the app owner can
 * read these (Firebase console, or scripts/export-feedback.mjs).
 */
export async function submitFeedback(opts: {
  type: FeedbackType;
  uid: string;
  username: string | null;
  houseId: string | null;
  message: string;
  screenshot: string | null;
}): Promise<void> {
  const message = opts.message.trim();
  if (message.length < 5) throw new Error('Tell us a bit more.');
  await setDoc(doc(collection(db, 'feedback')), {
    type: opts.type,
    userId: opts.uid,
    username: opts.username,
    houseId: opts.houseId,
    message,
    screenshot: opts.screenshot,
    device: {
      os: Platform.OS,
      osVersion: String(Platform.Version ?? ''),
      model: Device.modelName ?? null,
      appVersion: Constants.expoConfig?.version ?? null,
    },
    createdAt: serverTimestamp(),
  });
  track('feedback_sent');
}

// ---------- Feedback inbox (app owners only) ----------

export interface FeedbackItem {
  id: string;
  type: FeedbackType;
  username: string | null;
  message: string;
  screenshot: string | null;
  phone: string;
  appVersion: string | null;
  createdAt: number;
  done: boolean;
}

/** True if this account is listed in "owners" (set up in the Firebase console). */
export async function isAppOwner(uid: string): Promise<boolean> {
  try {
    return (await getDoc(doc(db, 'owners', uid))).exists();
  } catch {
    return false;
  }
}

/** The 40 most recent reports, newest first. */
export function watchFeedback(cb: (items: FeedbackItem[]) => void, onError: (e: FirestoreError) => void) {
  return onSnapshot(
    query(collection(db, 'feedback'), orderBy('createdAt', 'desc'), limit(40)),
    (snap) =>
      cb(snap.docs.map((d) => {
        const r = d.data();
        return {
          id: d.id,
          type: r.type === 'suggestion' ? 'suggestion' : 'bug',
          username: r.username ?? null,
          message: r.message ?? '',
          screenshot: r.screenshot ?? null,
          phone: [r.device?.model, r.device?.os === 'ios' ? 'iOS' : r.device?.os, r.device?.osVersion].filter(Boolean).join(' '),
          appVersion: r.device?.appVersion ?? null,
          createdAt: (r.createdAt as Timestamp | null)?.toMillis() ?? Date.now(),
          done: r.done === true,
        };
      })),
    onError,
  );
}

export async function setFeedbackDone(id: string, done: boolean): Promise<void> {
  await updateDoc(doc(db, 'feedback', id), { done });
}

// ---------- Chore offers ("I'll pay £3 for someone to do this") ----------

const offerRef = (houseId: string, id: string) => doc(db, 'houses', houseId, 'offers', id);

/** Offers still in progress (not cancelled or paid). */
export function watchOffers(houseId: string, cb: (o: ChoreOffer[]) => void, onError?: OnError) {
  return onSnapshot(
    query(collection(db, 'houses', houseId, 'offers'), where('closed', '==', false)),
    (snap) =>
      cb(
        snap.docs
          .map((s) => {
            const d = s.data();
            return {
              id: s.id,
              requestId: d.requestId,
              choreKey: d.choreKey,
              choreName: d.choreName,
              fromUid: d.fromUid,
              fromName: d.fromName,
              price: d.price,
              status: d.status,
              counters: d.counters ?? {},
              declined: d.declined ?? [],
              doerUid: d.doerUid ?? null,
              doerName: d.doerName ?? null,
              agreedPrice: d.agreedPrice ?? null,
              doerPay: d.doerPay ?? null,
              remindedAt: ms(d.remindedAt),
              logId: d.logId ?? null,
              paid: d.paid === true,
              createdAt: ms(d.createdAt) ?? Date.now(),
            } as ChoreOffer;
          })
          .sort((a, b) => b.createdAt - a.createdAt),
      ),
    onError,
  );
}

const tokensOf = (members: Member[], uids: string[], kind: NotifyKind) =>
  members.filter((m) => uids.includes(m.uid) && m.pushToken && wants(m.notifPrefs, kind)).map((m) => m.pushToken!);

async function ping(members: Member[], uids: string[], houseId: string, title: string, body: string, kind: NotifyKind = 'offers') {
  const to = tokensOf(members, uids, kind);
  if (to.length) await sendPush(to, { title, body, data: { type: 'chore_offer', houseId } }).catch(() => false);
}

/** Offer your chore (a "needs doing" assigned to you) to housemates for a price. */
export async function createOffer(opts: {
  house: House;
  members: Member[];
  request: ChoreRequest;
  from: { uid: string; username: string };
  price: number;
}) {
  const { house, request, from, price } = opts;
  await setDoc(offerRef(house.id, request.id), {
    requestId: request.id,
    choreKey: request.choreKey,
    choreName: request.choreName,
    fromUid: from.uid,
    fromName: from.username,
    price,
    status: 'open',
    counters: {},
    declined: [],
    doerUid: null,
    doerName: null,
    agreedPrice: null,
    doerPay: null,
    logId: null,
    paid: false,
    closed: false,
    createdAt: serverTimestamp(),
  });
  track('offer_create');
  const others = opts.members.filter((m) => m.uid !== from.uid).map((m) => m.uid);
  await ping(opts.members, others, house.id, `${from.username} will pay ${formatPrice(price)}`, `for someone to do: ${request.choreName}. Tap to accept or make an offer.`);
}

/** A housemate takes the offer at its price. */
export async function acceptOffer(
  houseId: string, offer: ChoreOffer, me: { uid: string; username: string }, pay: PayChoice, members: Member[],
) {
  await updateDoc(offerRef(houseId, offer.id), {
    status: 'agreed', doerUid: me.uid, doerName: me.username, agreedPrice: offer.price, doerPay: pay, agreedAt: serverTimestamp(),
  });
  track('offer_accept');
  await ping(members, [offer.fromUid], houseId, `${me.username} will do ${offer.choreName}`, `for ${formatPrice(offer.price)}. You'll pay once it's been checked.`);
}

/** A housemate's one counter offer. */
export async function counterOffer(
  houseId: string, offer: ChoreOffer, me: { uid: string; username: string }, price: number, pay: PayChoice, members: Member[],
) {
  if (offer.counters[me.uid]) throw new Error('You can only make one counter offer.');
  await updateDoc(offerRef(houseId, offer.id), { [`counters.${me.uid}`]: { name: me.username, price, pay } });
  track('offer_counter');
  await ping(members, [offer.fromUid], houseId, `${me.username} will do ${offer.choreName} for ${formatPrice(price)}`, 'Tap to accept or decline.');
}

export async function declineCounter(houseId: string, offer: ChoreOffer, uid: string, members: Member[]) {
  await updateDoc(offerRef(houseId, offer.id), { declined: [...offer.declined, uid] });
  const c = offer.counters[uid];
  if (c) await ping(members, [uid], houseId, `${offer.fromName} declined your ${formatPrice(c.price)}`, `for ${offer.choreName}.`);
}

export async function acceptCounter(houseId: string, offer: ChoreOffer, uid: string, members: Member[]) {
  const c = offer.counters[uid];
  if (!c) throw new Error('That counter offer no longer exists.');
  await updateDoc(offerRef(houseId, offer.id), {
    status: 'agreed', doerUid: uid, doerName: c.name, agreedPrice: c.price, doerPay: c.pay ?? null, agreedAt: serverTimestamp(),
  });
  track('offer_accept');
  await ping(members, [uid], houseId, `${offer.fromName} accepted your ${formatPrice(c.price)}`, `You're doing: ${offer.choreName}.`);
}

/** The doer nudges the payer (at most once a day). */
export async function remindPayer(houseId: string, offer: ChoreOffer, members: Member[]) {
  await updateDoc(offerRef(houseId, offer.id), { remindedAt: serverTimestamp() });
  await ping(
    members, [offer.fromUid], houseId,
    `Reminder: pay ${offer.doerName} ${formatPrice(offer.agreedPrice ?? offer.price)}`,
    `for ${offer.choreName}. Open Rotawise → Pay.`,
    'payments',
  );
}

/** The offerer withdraws (only before anyone's agreed). */
export async function cancelOffer(houseId: string, offer: ChoreOffer) {
  await updateDoc(offerRef(houseId, offer.id), { status: 'cancelled', closed: true });
}

/**
 * The offerer has paid the doer (outside the app). Closes the offer and
 * gives the offerer the point for this chore.
 */
export async function markOfferPaid(house: House, offer: ChoreOffer, members: Member[]) {
  const period = periodKey(new Date(), house.reset);
  const batch = writeBatch(db);
  batch.update(offerRef(house.id, offer.id), { paid: true, paidAt: serverTimestamp(), closed: true });
  batch.update(memberRef(house.id, offer.fromUid), {
    currentPeriod: period,
    [`stats.${period}.total`]: increment(1),
    [`stats.${period}.points`]: (members.find((m) => m.uid === offer.fromUid)?.points ?? 0)
      + choreSize(house.chores.find((c) => c.key === offer.choreKey) ?? { key: offer.choreKey }),
    [`stats.${period}.chores.${offer.choreKey}`]: increment(1),
    lastCompletedAt: serverTimestamp(),
  });
  await batch.commit();
  track('offer_paid');
  if (offer.doerUid && offer.agreedPrice) {
    await ping(members, [offer.doerUid], house.id, `${offer.fromName} paid you ${formatPrice(offer.agreedPrice)}`, `for ${offer.choreName}. Check your bank app.`, 'payments');
  }
}

// ---------- Owner dashboard ----------

/** Marks you as active (for the dashboard's "active" numbers). At most every few hours. */
export async function touchLastSeen(houseId: string, uid: string) {
  await updateDoc(memberRef(houseId, uid), { lastSeenAt: serverTimestamp() });
}

export interface DashboardData {
  users: { dob: string | null; gender: string | null; isStudent: boolean | null; university: string | null; createdAt: number | null; houseId: string | null; agreed: boolean }[];
  houses: { id: string; createdAt: number | null; area: HouseArea | null }[];
  /** null = not available yet (e.g. Firebase is still building an index). */
  members: number | null;
  active1d: number | null;
  active7d: number | null;
  chores: number | null;
  chores7d: number | null;
  sentBack: number | null;
  deals: number | null;
  dealPence: number | null;
  /** Anonymous usage counters for the last 30 days. */
  usage: { day: string; event: string; n: number }[];
  /** Some numbers couldn't load yet. */
  partial: boolean;
}

/**
 * Everything the owner dashboard shows. Profiles and houses are read in
 * full (they're small); everything else uses server-side counts, so it
 * stays cheap as the app grows.
 */
export async function loadDashboard(): Promise<DashboardData> {
  const ago = (days: number) => Timestamp.fromMillis(Date.now() - days * 86_400_000);
  let partial = false;
  // One number not being ready (e.g. index still building) shouldn't hide the rest.
  const n = async (q: Parameters<typeof getCountFromServer>[0]) => {
    try {
      return (await getCountFromServer(q)).data().count;
    } catch {
      partial = true;
      return null;
    }
  };
  const members = collectionGroup(db, 'members');
  const logs = collectionGroup(db, 'logs');
  const since = new Date(Date.now() - 30 * 86_400_000);
  const sinceDay = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}-${String(since.getDate()).padStart(2, '0')}`;
  const usageSnap = await getDocs(query(collection(db, 'analytics'), where('day', '>=', sinceDay))).catch(() => {
    partial = true;
    return null;
  });
  const [usersSnap, housesSnap, memberCount, active1d, active7d, chores, chores7d, sentBack, deals] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'houses')),
    n(members),
    n(query(members, where('lastSeenAt', '>=', ago(1)))),
    n(query(members, where('lastSeenAt', '>=', ago(7)))),
    n(logs),
    n(query(logs, where('at', '>=', ago(7)))),
    n(query(logs, where('status', '==', 'rejected'))),
    getAggregateFromServer(query(collectionGroup(db, 'offers'), where('paid', '==', true)), { deals: count(), pence: sum('agreedPrice') })
      .then((a) => a.data())
      .catch(() => {
        partial = true;
        return null;
      }),
  ]);
  return {
    users: usersSnap.docs.map((d) => {
      const u = d.data();
      return {
        dob: u.dob ?? null, gender: u.gender ?? null, isStudent: typeof u.isStudent === 'boolean' ? u.isStudent : null,
        university: u.university ?? null, createdAt: ms(u.createdAt), houseId: u.houseId ?? null, agreed: !!u.privacyVersion,
      };
    }),
    houses: housesSnap.docs.map((d) => ({ id: d.id, createdAt: ms(d.data().createdAt), area: d.data().area ?? null })),
    members: memberCount,
    active1d,
    active7d,
    chores,
    chores7d,
    sentBack,
    deals: deals?.deals ?? null,
    dealPence: deals ? deals.pence ?? 0 : null,
    usage: usageSnap ? usageSnap.docs.map((d) => d.data() as { day: string; event: string; n: number }) : [],
    partial,
  };
}
