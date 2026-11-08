import {
  collection, doc, getDoc, increment, onSnapshot, orderBy, query, runTransaction,
  serverTimestamp, setDoc, updateDoc, where, limit, writeBatch, deleteDoc,
  type DocumentData, type FirestoreError, type Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { generateHouseCode, normaliseHouseCode } from './houseCode';
import { choreKey, cleanChoreName } from './chores';
import { pickAssignee, type AssignMode } from './assign';
import { sendPush } from './notifications';
import type { ChoreLog, ChoreRequest, House, Member, UserProfile } from './types';

// Firestore stores server timestamps; the app works in millis.
const ms = (v: unknown): number | null =>
  v && typeof (v as Timestamp).toMillis === 'function' ? (v as Timestamp).toMillis() : null;

type OnError = (e: FirestoreError) => void;

const userRef = (uid: string) => doc(db, 'users', uid);
const houseRef = (houseId: string) => doc(db, 'houses', houseId);
const memberRef = (houseId: string, uid: string) => doc(db, 'houses', houseId, 'members', uid);
const codeRef = (code: string) => doc(db, 'houseCodes', code);

// ---------- Profile ----------

export async function saveProfile(
  uid: string,
  p: Omit<UserProfile, 'createdAt' | 'houseId'>,
): Promise<void> {
  await setDoc(
    userRef(uid),
    { ...p, houseId: null, createdAt: serverTimestamp() },
    { merge: true },
  );
}

export function watchProfile(uid: string, cb: (p: UserProfile | null) => void) {
  return onSnapshot(userRef(uid), (snap) => {
    // Ignore the instant local copy of our own write: wait until the server
    // has confirmed it, otherwise we'd try to read a house before the server
    // knows we've joined it (and the security rules would refuse).
    if (snap.metadata.hasPendingWrites) return;
    if (!snap.exists()) return cb(null);
    const d = snap.data();
    cb({ ...(d as UserProfile), createdAt: ms(d.createdAt) ?? Date.now() });
  });
}

// ---------- Houses ----------

// joinCode lets the security rules check you actually knew the house code.
function newMemberDoc(username: string, joinCode: string) {
  return {
    username,
    joinCode,
    totalCompleted: 0,
    choreCounts: {},
    lastCompletedAt: null,
    joinedAt: serverTimestamp(),
    pushToken: null,
  };
}

/** Creates a house with a fresh unique code and makes the user its first member. */
export async function createHouse(uid: string, username: string, name: string): Promise<string> {
  const houseDoc = doc(collection(db, 'houses'));
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateHouseCode();
    const ok = await runTransaction(db, async (tx) => {
      if ((await tx.get(codeRef(code))).exists()) return false; // code taken, try another
      tx.set(houseDoc, { name: name.trim(), code, createdBy: uid, createdAt: serverTimestamp() });
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
  if (!codeSnap.exists()) throw new Error("No house found with that code. Double-check it with your housemate.");
  const houseId = codeSnap.data().houseId as string;

  const batch = writeBatch(db);
  const existing = await getDoc(memberRef(houseId, uid)).catch(() => null);
  if (!existing?.exists()) batch.set(memberRef(houseId, uid), newMemberDoc(username, code));
  batch.update(userRef(uid), { houseId });
  await batch.commit();
  return houseId;
}

export async function leaveHouse(uid: string, houseId: string): Promise<void> {
  // Clear the profile first so the app routes away before the house data
  // becomes unreadable.
  await updateDoc(userRef(uid), { houseId: null });
  await deleteDoc(memberRef(houseId, uid));
}

export function watchHouse(houseId: string, cb: (h: House | null) => void, onError?: OnError) {
  return onSnapshot(
    houseRef(houseId),
    (snap) => {
      if (!snap.exists()) return cb(null);
      const d = snap.data();
      cb({ id: snap.id, name: d.name, code: d.code, createdBy: d.createdBy, createdAt: ms(d.createdAt) ?? Date.now() });
    },
    onError,
  );
}

const toMember = (id: string, d: DocumentData): Member => ({
  uid: id,
  username: d.username,
  totalCompleted: d.totalCompleted ?? 0,
  choreCounts: d.choreCounts ?? {},
  lastCompletedAt: ms(d.lastCompletedAt),
  joinedAt: ms(d.joinedAt) ?? Date.now(),
  pushToken: d.pushToken ?? null,
});

export function watchMembers(houseId: string, cb: (m: Member[]) => void, onError?: OnError) {
  return onSnapshot(
    collection(db, 'houses', houseId, 'members'),
    (snap) => cb(snap.docs.map((s) => toMember(s.id, s.data()))),
    onError,
  );
}

export function watchOpenRequests(houseId: string, cb: (r: ChoreRequest[]) => void, onError?: OnError) {
  const q = query(
    collection(db, 'houses', houseId, 'requests'),
    where('status', '==', 'open'),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(q, (snap) =>
    cb(
      snap.docs.map((s) => {
        const d = s.data();
        return {
          ...(d as ChoreRequest),
          id: s.id,
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
    (snap) => cb(snap.docs.map((s) => ({ ...(s.data() as ChoreLog), id: s.id, at: ms(s.data().at) ?? Date.now() }))),
    onError,
  );
}

export async function setPushToken(houseId: string, uid: string, token: string | null) {
  await updateDoc(memberRef(houseId, uid), { pushToken: token });
}

// ---------- Chores ----------

/**
 * "I did a chore." Adds to the activity log and bumps the user's own
 * counters. If it fulfils an open request, that request is closed too.
 */
export async function logChore(
  houseId: string,
  uid: string,
  username: string,
  rawName: string,
  requestId: string | null = null,
): Promise<void> {
  const name = cleanChoreName(rawName);
  const key = choreKey(name);
  if (!key) throw new Error('Give the chore a name.');

  const batch = writeBatch(db);
  batch.set(doc(collection(db, 'houses', houseId, 'logs')), {
    choreKey: key, choreName: name, userId: uid, username, at: serverTimestamp(), requestId,
  });
  // Dot-path so only this chore's counter changes (choreKey has no dots).
  batch.update(memberRef(houseId, uid), {
    totalCompleted: increment(1),
    [`choreCounts.${key}`]: increment(1),
    lastCompletedAt: serverTimestamp(),
  });
  if (requestId) {
    batch.update(doc(db, 'houses', houseId, 'requests', requestId), {
      status: 'done', completedBy: uid, completedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

/**
 * "This needs doing, but not by me." Picks whoever has done the least,
 * records the request, and pings them.
 */
export async function requestChore(opts: {
  houseId: string;
  houseName: string;
  requester: { uid: string; username: string };
  members: Member[];
  choreName: string;
  mode: AssignMode;
}): Promise<{ assignee: Member; notified: boolean }> {
  const name = cleanChoreName(opts.choreName);
  const key = choreKey(name);
  if (!key) throw new Error('Give the chore a name.');

  const assignee = pickAssignee(opts.members, opts.requester.uid, opts.mode, key) as Member | null;
  if (!assignee) throw new Error("You're the only one in the house so far — share your house code first!");

  await setDoc(doc(collection(db, 'houses', opts.houseId, 'requests')), {
    choreKey: key,
    choreName: name,
    mode: opts.mode,
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
    notified = await sendPush(assignee.pushToken, {
      title: `${opts.houseName}: ${name} needs doing`,
      body:
        opts.mode === 'chore'
          ? `You've done "${name}" the fewest times in the house — your turn!`
          : `You've done the fewest chores in the house — your turn!`,
      data: { type: 'chore_request', houseId: opts.houseId },
    });
  }
  return { assignee, notified };
}
