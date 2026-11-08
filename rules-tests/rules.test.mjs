// Tests firestore.rules against the local emulator, replaying the same
// writes the app makes (see src/lib/db.ts). Run: npm test (in this folder).
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
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
  const s = db('sam');
  const b = writeBatch(s);
  b.set(doc(collection(s, 'houses', 'h1', 'logs')), {
    choreKey: 'take out bins', choreName: 'Take out bins', userId: 'sam', username: 'Sam',
    at: serverTimestamp(), requestId: reqRef.id,
  });
  b.update(doc(s, 'houses', 'h1', 'members', 'sam'), {
    totalCompleted: increment(1), 'choreCounts.take out bins': increment(1), lastCompletedAt: serverTimestamp(),
  });
  b.update(doc(s, 'houses', 'h1', 'requests', reqRef.id), {
    status: 'done', completedBy: 'sam', completedAt: serverTimestamp(),
  });
  await assertSucceeds(b.commit());
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
  await assertFails(setDoc(doc(collection(db('sam'), 'houses', 'h1', 'logs')), {
    choreKey: 'x', choreName: 'x', userId: 'alice', username: 'Alex', at: serverTimestamp(), requestId: null,
  }));
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
