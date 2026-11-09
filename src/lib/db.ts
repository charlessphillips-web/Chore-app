import {
  collection, deleteDoc, deleteField, doc, getDoc, increment, limit, onSnapshot, orderBy, query,
  runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch,
  type DocumentData, type FirestoreError, type Timestamp,
} from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { auth, db } from './firebase';
import { generateHouseCode, normaliseHouseCode } from './houseCode';
import { choreKey, cleanChoreName, DEFAULT_CHORES, type HouseChore } from './chores';
import { pickAssignee } from './assign';
import { periodKey } from './period';
import { sendPush } from './notifications';
import type { ChoreLog, ChoreRequest, House, Member, ProfileDetails, UserProfile } from './types';

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
  await setDoc(userRef(uid), { ...p, houseId: null, createdAt: serverTimestamp() });
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
export async function createHouse(uid: string, username: string, name: string): Promise<string> {
  const houseDoc = doc(collection(db, 'houses'));
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateHouseCode();
    const ok = await runTransaction(db, async (tx) => {
      if ((await tx.get(codeRef(code))).exists()) return false; // code taken, try another
      tx.set(houseDoc, {
        name: name.trim(), code, createdBy: uid, adminUid: uid, chores: DEFAULT_CHORES, createdAt: serverTimestamp(),
      });
      tx.set(codeRef(code), { houseId: houseDoc.id });
      tx.set(memberRef(houseDoc.id, uid), newMemberDoc(username, code));
      tx.update(userRef(uid), { houseId: houseDoc.id });
      return true;
    });
    if (ok) return houseDoc.id;
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

export async function updateHouse(houseId: string, patch: { name?: string; chores?: HouseChore[] }): Promise<void> {
  await updateDoc(houseRef(houseId), patch);
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
        createdAt: ms(d.createdAt) ?? Date.now(),
      });
    },
    onError,
  );
}

/** Turns a member doc into scores for the current 2-month period. */
const toMember = (id: string, d: DocumentData, period: string): Member => {
  const p = d.stats?.[period] ?? {};
  return {
    uid: id,
    username: d.username,
    totalCompleted: p.total ?? 0,
    choreCounts: p.chores ?? {},
    lastCompletedAt: ms(d.lastCompletedAt),
    joinedAt: ms(d.joinedAt) ?? Date.now(),
    pushToken: d.pushToken ?? null,
  };
};

export function watchMembers(houseId: string, cb: (m: Member[]) => void, onError?: OnError) {
  return onSnapshot(
    collection(db, 'houses', houseId, 'members'),
    (snap) => {
      const period = periodKey();
      cb(snap.docs.map((s) => toMember(s.id, s.data(), period)));
    },
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
          };
        }),
      ),
    onError,
  );
}

export async function setPushToken(houseId: string, uid: string, token: string | null) {
  await updateDoc(memberRef(houseId, uid), { pushToken: token });
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
}): Promise<void> {
  const { house, uid, username, photo } = opts;
  const requestId = opts.requestId ?? null;
  const name = cleanChoreName(opts.chore.name);
  const key = opts.chore.key || choreKey(name);
  if (!key) throw new Error('Pick a chore.');
  if (!photo?.thumb || !photo?.full) throw new Error('Take a photo of the finished chore first.');
  const period = periodKey();

  const batch = writeBatch(db);
  const logRef = doc(collection(db, 'houses', house.id, 'logs'));
  batch.set(logRef, {
    choreKey: key, choreName: name, userId: uid, username, at: serverTimestamp(), period, requestId,
    photoThumb: photo.thumb, status: 'pending', reviewedBy: null, reviewedByName: null,
  });
  batch.set(doc(db, 'houses', house.id, 'photos', logRef.id), { userId: uid, data: photo.full });
  // Dot-paths so only this period's / this chore's counters change.
  batch.update(memberRef(house.id, uid), {
    currentPeriod: period,
    [`stats.${period}.total`]: increment(1),
    [`stats.${period}.chores.${key}`]: increment(1),
    lastCompletedAt: serverTimestamp(),
  });
  if (requestId) {
    batch.update(doc(db, 'houses', house.id, 'requests', requestId), {
      status: 'done', completedBy: uid, completedAt: serverTimestamp(),
    });
  }
  await batch.commit();

  const others = opts.members.filter((m) => m.uid !== uid && m.pushToken).map((m) => m.pushToken!);
  if (others.length) {
    await sendPush(others, {
      title: `${username} did: ${name}`,
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

/** One housemate verifies a chore photo. */
export async function verifyChore(houseId: string, logId: string, reviewer: { uid: string; username: string }) {
  await reviewChore(houseId, logId, reviewer, null);
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
  const owner = members.find((m) => m.uid === log.userId);
  if (owner?.pushToken) {
    await sendPush([owner.pushToken], {
      title: `Redo: ${log.choreName}`,
      body: `${reviewer.username} sent it back — ${reason}`,
      data: { type: 'chore_redo', houseId: house.id },
    });
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
      if (log.period) {
        tx.update(ownerRef, {
          [`stats.${log.period}.total`]: increment(-1),
          [`stats.${log.period}.chores.${log.choreKey}`]: increment(-1),
          lastReviewAdjust: logId,
        });
      }
      // Back on their list to redo.
      tx.set(doc(collection(db, 'houses', houseId, 'requests')), {
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
      });
    }
    return { userId: log.userId as string, choreName: log.choreName as string };
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

  let notified = false;
  if (assignee.pushToken) {
    notified = await sendPush([assignee.pushToken], {
      title: `${house.name}: ${chore.needs}`,
      body: "You've done the fewest chores in the house — your turn!",
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
}
