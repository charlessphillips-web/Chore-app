// Tests firestore.rules against the local emulator, replaying the same
// writes the app makes (see src/lib/db.ts). Run: npm test (in this folder).
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, collection, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, runTransaction,
  serverTimestamp, increment, getDocs, query, where, orderBy,
} from 'firebase/firestore';

let env;
const db = (uid) => env.authenticatedContext(uid).firestore();
const profile = (over = {}) => ({
  username: 'Alex', age: 20, gender: 'Female', isStudent: true, university: 'Leeds',
  houseId: null, createdAt: serverTimestamp(), ...over,
});
const member = (username, joinCode) => ({
  username, joinCode, totalCompleted: 0, choreCounts: {}, lastCompletedAt: null,
  joinedAt: serverTimestamp(), pushToken: null,
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-choreboard',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
after(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const logData = (uid, key, requestId = null) => ({
  choreKey: key, choreName: key, userId: uid, username: uid, at: serverTimestamp(), requestId,
  photoThumb: 'thumbdata', okVoters: [], notOkVoters: [], status: 'pending',
});

// Mirrors logChore() in db.ts. Returns the log id.
async function logChore(uid, houseId, key, requestId = null) {
  const f = db(uid);
  const ref = doc(collection(f, 'houses', houseId, 'logs'));
  const b = writeBatch(f);
  b.set(ref, logData(uid, key, requestId));
  b.set(doc(f, 'houses', houseId, 'photos', ref.id), { userId: uid, data: 'fullphotodata' });
  b.update(doc(f, 'houses', houseId, 'members', uid), {
    totalCompleted: increment(1), [`choreCounts.${key}`]: increment(1), lastCompletedAt: serverTimestamp(),
  });
  if (requestId) b.update(doc(f, 'houses', houseId, 'requests', requestId), {
    status: 'done', completedBy: uid, completedAt: serverTimestamp(),
  });
  await b.commit();
  return ref.id;
}

// Mirrors voteOnChore() in db.ts.
async function vote(uid, houseId, logId, v) {
  const f = db(uid);
  const logRef = doc(f, 'houses', houseId, 'logs', logId);
  await runTransaction(f, async (tx) => {
    const log = (await tx.get(logRef)).data();
    const ownerRef = doc(f, 'houses', houseId, 'members', log.userId);
    const ownerExists = (await tx.get(ownerRef)).exists();
    const ok = log.okVoters.filter((x) => x !== uid);
    const notOk = log.notOkVoters.filter((x) => x !== uid);
    if (v === 'ok') ok.push(uid);
    if (v === 'not_ok') notOk.push(uid);
    const status = notOk.length > ok.length ? 'rejected' : ok.length ? 'verified' : 'pending';
    tx.update(logRef, { okVoters: ok, notOkVoters: notOk, status });
    const was = log.status === 'rejected', now = status === 'rejected';
    if (was !== now && ownerExists) {
      const d = now ? -1 : 1;
      tx.update(ownerRef, { totalCompleted: increment(d), [`choreCounts.${log.choreKey}`]: increment(d), lastReviewAdjust: logId });
    }
  });
}

const score = async (uid) => (await getDoc(doc(db(uid), 'houses', 'h1', 'members', uid))).data();

// Mirrors createHouse() in db.ts
async function createHouse(uid, code = 'ABCDEF', houseId = 'h1') {
  const f = db(uid);
  await setDoc(doc(f, 'users', uid), profile());
  await runTransaction(f, async (tx) => {
    await tx.get(doc(f, 'houseCodes', code));
    tx.set(doc(f, 'houses', houseId), { name: 'Hyde Park', code, createdBy: uid, createdAt: serverTimestamp() });
    tx.set(doc(f, 'houseCodes', code), { houseId });
    tx.set(doc(f, 'houses', houseId, 'members', uid), member('Alex', code));
    tx.update(doc(f, 'users', uid), { houseId });
  });
}

// Mirrors joinHouse() in db.ts
async function joinHouse(uid, code = 'ABCDEF') {
  const f = db(uid);
  await setDoc(doc(f, 'users', uid), profile({ username: 'Sam' }));
  const { houseId } = (await getDoc(doc(f, 'houseCodes', code))).data();
  const b = writeBatch(f);
  b.set(doc(f, 'houses', houseId, 'members', uid), member('Sam', code));
  b.update(doc(f, 'users', uid), { houseId });
  await b.commit();
}

test('onboarding: valid profile saves, bad data rejected', async () => {
  await assertSucceeds(setDoc(doc(db('a'), 'users', 'a'), profile()));
  await assertFails(setDoc(doc(db('b'), 'users', 'b'), profile({ age: 10 })));
  await assertFails(setDoc(doc(db('c'), 'users', 'c'), profile({ gender: 'x' })));
  await assertFails(setDoc(doc(db('d'), 'users', 'e'), profile())); // someone else's doc
});

test('demographics are private to the owner', async () => {
  await setDoc(doc(db('a'), 'users', 'a'), profile());
  await assertSucceeds(getDoc(doc(db('a'), 'users', 'a')));
  await assertFails(getDoc(doc(db('b'), 'users', 'a')));
});

test('create house then join with code', async () => {
  await assertSucceeds(createHouse('alice'));
  await assertSucceeds(joinHouse('sam'));
  await assertSucceeds(getDoc(doc(db('sam'), 'houses', 'h1')));
});

test('cannot join a house without its real code', async () => {
  await createHouse('alice');
  const f = db('eve');
  await setDoc(doc(f, 'users', 'eve'), profile());
  await assertFails(setDoc(doc(f, 'houses', 'h1', 'members', 'eve'), member('Eve', 'WRONG1')));
  await assertFails(updateDoc(doc(f, 'users', 'eve'), { houseId: 'h1' }));
  await assertFails(getDoc(doc(f, 'houses', 'h1')));
});

test('cannot list all house codes', async () => {
  await createHouse('alice');
  await assertFails(getDocs(collection(db('eve'), 'houseCodes')));
});

test('house code cannot be hijacked once taken', async () => {
  await createHouse('alice');
  await assertFails(setDoc(doc(db('eve'), 'houseCodes', 'ABCDEF'), { houseId: 'evil' }));
});

test('log chore (with and without a request) and request a chore', async () => {
  await createHouse('alice');
  await joinHouse('sam');
  const f = db('alice');

  // requestChore()
  const reqRef = doc(collection(f, 'houses', 'h1', 'requests'));
  await assertSucceeds(setDoc(reqRef, {
    choreKey: 'take out bins', choreName: 'Take out bins', mode: 'overall',
    requestedBy: 'alice', requestedByName: 'Alex', assignedTo: 'sam', assignedToName: 'Sam',
    status: 'open', createdAt: serverTimestamp(), completedBy: null, completedAt: null,
  }));

  // the home screen's open-requests query
  await assertSucceeds(getDocs(query(collection(db('sam'), 'houses', 'h1', 'requests'),
    where('status', '==', 'open'), orderBy('createdAt', 'desc'))));

  // logChore() by sam, closing the request
  await assertSucceeds(logChore('sam', 'h1', 'take out bins', reqRef.id));
});

test('cannot assign a chore to yourself or a non-member', async () => {
  await createHouse('alice');
  const base = { choreKey: 'x', choreName: 'x', mode: 'overall', requestedBy: 'alice', requestedByName: 'A',
    assignedToName: 'B', status: 'open', createdAt: serverTimestamp(), completedBy: null, completedAt: null };
  const f = db('alice');
  await assertFails(setDoc(doc(collection(f, 'houses', 'h1', 'requests')), { ...base, assignedTo: 'alice' }));
  await assertFails(setDoc(doc(collection(f, 'houses', 'h1', 'requests')), { ...base, assignedTo: 'ghost' }));
});

test('cannot inflate stats or edit housemates', async () => {
  await createHouse('alice');
  await joinHouse('sam');
  await assertFails(updateDoc(doc(db('sam'), 'houses', 'h1', 'members', 'sam'), { totalCompleted: 50 }));
  await assertFails(updateDoc(doc(db('sam'), 'houses', 'h1', 'members', 'alice'), { totalCompleted: increment(1) }));
  // can't log a chore as someone else
  const f = db('sam');
  const ref = doc(collection(f, 'houses', 'h1', 'logs'));
  const b = writeBatch(f);
  b.set(ref, logData('alice', 'x'));
  b.set(doc(f, 'houses', 'h1', 'photos', ref.id), { userId: 'alice', data: 'abc' });
  await assertFails(b.commit());
});

test('push token update and leaving the house', async () => {
  await createHouse('alice');
  await joinHouse('sam');
  const s = db('sam');
  await assertSucceeds(updateDoc(doc(s, 'houses', 'h1', 'members', 'sam'), { pushToken: 'ExponentPushToken[x]' }));
  // leaveHouse()
  await assertSucceeds(updateDoc(doc(s, 'users', 'sam'), { houseId: null }));
  await assertSucceeds(deleteDoc(doc(s, 'houses', 'h1', 'members', 'sam')));
  await assertFails(getDoc(doc(s, 'houses', 'h1')));
});

test('logging a chore requires a photo', async () => {
  await createHouse('alice');
  const f = db('alice');
  await assertFails(setDoc(doc(collection(f, 'houses', 'h1', 'logs')), logData('alice', 'bins')));
  const noThumb = { ...logData('alice', 'bins'), photoThumb: null };
  const ref = doc(collection(f, 'houses', 'h1', 'logs'));
  const b = writeBatch(f);
  b.set(ref, noThumb);
  b.set(doc(f, 'houses', 'h1', 'photos', ref.id), { userId: 'alice', data: 'x' });
  await assertFails(b.commit());
});

test('housemates can see photos, outsiders cannot', async () => {
  await createHouse('alice');
  await joinHouse('sam');
  const id = await logChore('alice', 'h1', 'bins');
  await assertSucceeds(getDoc(doc(db('sam'), 'houses', 'h1', 'photos', id)));
  await assertFails(getDoc(doc(db('eve'), 'houses', 'h1', 'photos', id)));
});

test('voting: approve, reject (score drops), overturn (score returns)', async () => {
  await createHouse('alice');
  await joinHouse('sam');
  const id = await logChore('alice', 'h1', 'bins');
  assert.equal((await score('alice')).totalCompleted, 1);

  await assertSucceeds(vote('sam', 'h1', id, 'ok'));
  assert.equal((await getDoc(doc(db('alice'), 'houses', 'h1', 'logs', id))).data().status, 'verified');

  await assertSucceeds(vote('sam', 'h1', id, 'not_ok'));
  let s = await score('alice');
  assert.equal(s.totalCompleted, 0);
  assert.equal(s.choreCounts.bins, 0);

  await assertSucceeds(vote('sam', 'h1', id, 'ok'));
  s = await score('alice');
  assert.equal(s.totalCompleted, 1);
  assert.equal(s.choreCounts.bins, 1);
});

test('voting cheats are blocked', async () => {
  await createHouse('alice');
  await joinHouse('sam');
  const id = await logChore('alice', 'h1', 'bins');
  const logRef = (uid) => doc(db(uid), 'houses', 'h1', 'logs', id);

  // can't vote on your own chore
  await assertFails(vote('alice', 'h1', id, 'ok'));
  // can't vote on someone else's behalf
  await assertFails(updateDoc(logRef('sam'), { okVoters: ['bob'], status: 'verified' }));
  // can't vote twice
  await assertFails(updateDoc(logRef('sam'), { okVoters: ['sam', 'sam'], status: 'verified' }));
  // status must match the votes
  await assertFails(updateDoc(logRef('sam'), { okVoters: ['sam'], status: 'rejected' }));
  // can't reject without the score dropping
  await assertFails(updateDoc(logRef('sam'), { notOkVoters: ['sam'], status: 'rejected' }));
  // can't knock a housemate's score down without a real rejection
  await assertFails(updateDoc(doc(db('sam'), 'houses', 'h1', 'members', 'alice'), {
    totalCompleted: increment(-1), 'choreCounts.bins': increment(-1), lastReviewAdjust: id,
  }));
  // outsiders can't vote
  await assertFails(vote('eve', 'h1', id, 'not_ok'));
  // can't delete or edit the chore itself
  await assertFails(updateDoc(logRef('sam'), { choreName: 'nothing' }));
  await assertFails(deleteDoc(logRef('alice')));
});
