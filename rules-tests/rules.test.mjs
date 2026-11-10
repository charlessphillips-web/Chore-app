// Tests firestore.rules against the local emulator, replaying the same
// writes the app makes (see src/lib/db.ts). Run: npm test (in this folder).
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc, collection, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, runTransaction,
  serverTimestamp, increment, getDocs, query, where, orderBy, deleteField, Timestamp,
  collectionGroup, getCountFromServer, getAggregateFromServer, count, sum,
} from 'firebase/firestore';

let env;
const P = 'p2026_11';
const db = (uid) => env.authenticatedContext(uid).firestore();
const profile = (over = {}) => ({
  username: 'Alex', dob: '2004-03-07', gender: 'Female', isStudent: true, university: 'University of Leeds',
  houseId: null, createdAt: serverTimestamp(), ...over,
});
const member = (username, joinCode) => ({
  username, joinCode, stats: {}, lastCompletedAt: null, joinedAt: serverTimestamp(), pushToken: null,
});
const CHORES = [{ key: 'bins', name: 'Bins', needs: 'Bins are full', active: true }];

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
    tx.set(doc(f, 'houses', houseId), { name: '42', code, createdBy: uid, adminUid: uid, chores: CHORES, createdAt: serverTimestamp() });
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

const logData = (uid, key, requestId = null) => ({
  choreKey: key, choreName: key, userId: uid, username: uid, at: serverTimestamp(), period: P, requestId,
  photoThumb: 'thumbdata', status: 'pending', reviewedBy: null, reviewedByName: null,
});

// Mirrors logChore() in db.ts. Returns the log id.
async function logChore(uid, houseId, key, requestId = null) {
  const f = db(uid);
  const ref = doc(collection(f, 'houses', houseId, 'logs'));
  const b = writeBatch(f);
  b.set(ref, logData(uid, key, requestId));
  b.set(doc(f, 'houses', houseId, 'photos', ref.id), { userId: uid, data: 'fullphotodata' });
  b.update(doc(f, 'houses', houseId, 'members', uid), {
    currentPeriod: P, [`stats.${P}.total`]: increment(1), [`stats.${P}.chores.${key}`]: increment(1),
    lastCompletedAt: serverTimestamp(),
  });
  if (requestId) b.update(doc(f, 'houses', houseId, 'requests', requestId), {
    status: 'done', completedBy: uid, completedAt: serverTimestamp(),
  });
  await b.commit();
  return ref.id;
}

// Mirrors reviewChore() in db.ts: verify, or send back with a reason.
async function review(uid, houseId, logId, decision, reason = 'Still dirty') {
  const f = db(uid);
  const logRef = doc(f, 'houses', houseId, 'logs', logId);
  await runTransaction(f, async (tx) => {
    const log = (await tx.get(logRef)).data();
    const ownerRef = doc(f, 'houses', houseId, 'members', log.userId);
    const owner = await tx.get(ownerRef);
    const back = decision === 'rejected';
    tx.update(logRef, {
      status: decision, reviewedBy: uid, reviewedByName: uid, reviewedAt: serverTimestamp(),
      rejectReason: back ? reason : null,
    });
    if (back && owner.exists()) {
      tx.update(ownerRef, {
        [`stats.${log.period}.total`]: increment(-1), [`stats.${log.period}.chores.${log.choreKey}`]: increment(-1),
        lastReviewAdjust: logId,
      });
      tx.set(doc(collection(f, 'houses', houseId, 'requests')), {
        kind: 'redo', reason, logId, choreKey: log.choreKey, choreName: log.choreName, needs: `Redo: ${log.choreName}`,
        mode: 'overall', requestedBy: uid, requestedByName: uid, assignedTo: log.userId, assignedToName: owner.data().username,
        status: 'open', createdAt: serverTimestamp(), completedBy: null, completedAt: null,
      });
    }
  });
}

const stats = async (uid) => (await getDoc(doc(db(uid), 'houses', 'h1', 'members', uid))).data().stats[P];

test('profile: date of birth required, under-13s and old "age" field rejected', async () => {
  await assertSucceeds(setDoc(doc(db('a'), 'users', 'a'), profile()));
  await assertFails(setDoc(doc(db('b'), 'users', 'b'), profile({ dob: '2020-01-01' })));
  await assertFails(setDoc(doc(db('c'), 'users', 'c'), profile({ dob: '7 March 2004' })));
  await assertFails(setDoc(doc(db('d'), 'users', 'd'), profile({ age: 20 })));
  await assertFails(setDoc(doc(db('e'), 'users', 'f'), profile())); // someone else's doc
});

test('older account can upgrade from age to date of birth', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', 'old'), { username: 'Old', age: 20, gender: 'Male', isStudent: false, university: null, houseId: null });
  });
  await assertSucceeds(updateDoc(doc(db('old'), 'users', 'old'), { dob: '2005-01-01', age: deleteField() }));
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

test('cannot create a house with someone else as admin', async () => {
  const f = db('eve');
  await setDoc(doc(f, 'users', 'eve'), profile());
  await assertFails(runTransaction(f, async (tx) => {
    tx.set(doc(f, 'houses', 'h9'), { name: 'x', code: 'QQQQQQ', createdBy: 'eve', adminUid: 'bob', chores: [], createdAt: serverTimestamp() });
    tx.set(doc(f, 'houseCodes', 'QQQQQQ'), { houseId: 'h9' });
  }));
});

test('cannot join a house without its real code', async () => {
  await createHouse('alice');
  const f = db('eve');
  await setDoc(doc(f, 'users', 'eve'), profile());
  await assertFails(setDoc(doc(f, 'houses', 'h1', 'members', 'eve'), member('Eve', 'WRONG1')));
  await assertFails(updateDoc(doc(f, 'users', 'eve'), { houseId: 'h1' }));
  await assertFails(getDoc(doc(f, 'houses', 'h1')));
});

test('cannot list all house codes or hijack one', async () => {
  await createHouse('alice');
  await assertFails(getDocs(collection(db('eve'), 'houseCodes')));
  await assertFails(setDoc(doc(db('eve'), 'houseCodes', 'ABCDEF'), { houseId: 'evil' }));
});

test('admin: change chores, rename, set wallpaper, hand over admin', async () => {
  await createHouse('alice');
  await joinHouse('sam');
  const a = db('alice');
  await assertSucceeds(updateDoc(doc(a, 'houses', 'h1'), { chores: [...CHORES, { key: 'recycling', name: 'Recycling', needs: 'Recycling is full', active: true }] }));
  await assertSucceeds(updateDoc(doc(a, 'houses', 'h1'), { name: '42 Hyde Park Rd' }));
  await assertSucceeds(setDoc(doc(a, 'houses', 'h1', 'wallpaper', 'current'), { data: 'img', updatedBy: 'alice' }));
  await assertSucceeds(getDoc(doc(db('sam'), 'houses', 'h1', 'wallpaper', 'current')));
  await assertFails(updateDoc(doc(a, 'houses', 'h1'), { adminUid: 'stranger' }));
  await assertSucceeds(updateDoc(doc(a, 'houses', 'h1'), { adminUid: 'sam' }));
  // alice is no longer admin
  await assertFails(updateDoc(doc(a, 'houses', 'h1'), { name: 'mine' }));
  await assertSucceeds(updateDoc(doc(db('sam'), 'houses', 'h1'), { name: 'Sam house' }));
});

test('non-admins cannot change the house or remove people', async () => {
  await createHouse('alice');
  await joinHouse('sam');
  const s = db('sam');
  await assertFails(updateDoc(doc(s, 'houses', 'h1'), { chores: [] }));
  await assertFails(updateDoc(doc(s, 'houses', 'h1'), { adminUid: 'sam' }));
  await assertFails(setDoc(doc(s, 'houses', 'h1', 'wallpaper', 'current'), { data: 'img' }));
  await assertFails(deleteDoc(doc(s, 'houses', 'h1', 'members', 'alice')));
  await assertFails(updateDoc(doc(s, 'houses', 'h1'), { code: 'NEWCOD' }));
});

test('admin can remove a housemate, who then loses access but can clear their house', async () => {
  await createHouse('alice');
  await joinHouse('sam');
  await assertSucceeds(deleteDoc(doc(db('alice'), 'houses', 'h1', 'members', 'sam')));
  await assertFails(getDoc(doc(db('sam'), 'houses', 'h1')));
  await assertSucceeds(updateDoc(doc(db('sam'), 'users', 'sam'), { houseId: null }));
});

test('log chore with photo, request a chore, close it', async () => {
  await createHouse('alice');
  await joinHouse('sam');
  const f = db('alice');
  const reqRef = doc(collection(f, 'houses', 'h1', 'requests'));
  await assertSucceeds(setDoc(reqRef, {
    choreKey: 'bins', choreName: 'Bins', needs: 'Bins are full', mode: 'overall',
    requestedBy: 'alice', requestedByName: 'Alex', assignedTo: 'sam', assignedToName: 'Sam',
    status: 'open', createdAt: serverTimestamp(), completedBy: null, completedAt: null,
  }));
  await assertSucceeds(getDocs(query(collection(db('sam'), 'houses', 'h1', 'requests'),
    where('status', '==', 'open'), orderBy('createdAt', 'desc'))));
  await assertSucceeds(logChore('sam', 'h1', 'bins', reqRef.id));
  assert.equal((await stats('sam')).total, 1);
});

test('logging needs a photo', async () => {
  await createHouse('alice');
  const f = db('alice');
  await assertFails(setDoc(doc(collection(f, 'houses', 'h1', 'logs')), logData('alice', 'bins')));
});

test('cannot inflate your score or edit housemates', async () => {
  await createHouse('alice');
  await joinHouse('sam');
  const s = db('sam');
  await assertFails(updateDoc(doc(s, 'houses', 'h1', 'members', 'sam'), { currentPeriod: P, [`stats.${P}.total`]: 50 }));
  await assertFails(updateDoc(doc(s, 'houses', 'h1', 'members', 'alice'), { currentPeriod: P, [`stats.${P}.total`]: increment(1) }));
  // can't log a chore as someone else
  const ref = doc(collection(s, 'houses', 'h1', 'logs'));
  const b = writeBatch(s);
  b.set(ref, logData('alice', 'x'));
  b.set(doc(s, 'houses', 'h1', 'photos', ref.id), { userId: 'alice', data: 'abc' });
  await assertFails(b.commit());
});

test('one housemate verifies; it cannot then be changed', async () => {
  await createHouse('alice');
  await joinHouse('sam');
  const id = await logChore('alice', 'h1', 'bins');
  await assertSucceeds(review('sam', 'h1', id, 'verified'));
  assert.equal((await stats('alice')).total, 1);
  await assertFails(review('sam', 'h1', id, 'rejected'));
});

test('rejecting takes the chore off the score', async () => {
  await createHouse('alice');
  await joinHouse('sam');
  const id = await logChore('alice', 'h1', 'bins');
  await assertSucceeds(review('sam', 'h1', id, 'rejected'));
  const s = await stats('alice');
  assert.equal(s.total, 0);
  assert.equal(s.chores.bins, 0);
});

test('check cheats are blocked', async () => {
  await createHouse('alice');
  await joinHouse('sam');
  const id = await logChore('alice', 'h1', 'bins');
  const logRef = (uid) => doc(db(uid), 'houses', 'h1', 'logs', id);
  // can't check your own chore
  await assertFails(review('alice', 'h1', id, 'verified'));
  // can't check as someone else
  await assertFails(updateDoc(logRef('sam'), { status: 'verified', reviewedBy: 'bob' }));
  // can't reject without the score dropping
  await assertFails(updateDoc(logRef('sam'), { status: 'rejected', reviewedBy: 'sam' }));
  // can't knock a housemate's score down without a real rejection
  await assertFails(updateDoc(doc(db('sam'), 'houses', 'h1', 'members', 'alice'), {
    [`stats.${P}.total`]: increment(-1), [`stats.${P}.chores.bins`]: increment(-1), lastReviewAdjust: id,
  }));
  // outsiders can't check
  await assertFails(review('eve', 'h1', id, 'rejected'));
  // can't edit or delete the chore itself
  await assertFails(updateDoc(logRef('sam'), { choreName: 'nothing' }));
  await assertFails(deleteDoc(logRef('alice')));
});

test('checks close after 24 hours (auto-verified)', async () => {
  await createHouse('alice');
  await joinHouse('sam');
  const id = await logChore('alice', 'h1', 'bins');
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'houses', 'h1', 'logs', id), { at: Timestamp.fromMillis(Date.now() - 25 * 3600_000) });
  });
  await assertFails(review('sam', 'h1', id, 'rejected'));
});

test('push token update, leaving, admin hand-over on leave', async () => {
  await createHouse('alice');
  await joinHouse('sam');
  const s = db('sam');
  await assertSucceeds(updateDoc(doc(s, 'houses', 'h1', 'members', 'sam'), { pushToken: 'ExponentPushToken[x]' }));
  // admin leaving: hand over, clear profile, delete member doc
  const a = db('alice');
  await assertSucceeds(updateDoc(doc(a, 'houses', 'h1'), { adminUid: 'sam' }));
  await assertSucceeds(updateDoc(doc(a, 'users', 'alice'), { houseId: null }));
  await assertSucceeds(deleteDoc(doc(a, 'houses', 'h1', 'members', 'alice')));
  await assertFails(getDoc(doc(a, 'houses', 'h1')));
  assert.equal((await getDoc(doc(s, 'houses', 'h1'))).data().adminUid, 'sam');
});

test('delete account', async () => {
  await setDoc(doc(db('a'), 'users', 'a'), profile());
  await assertSucceeds(deleteDoc(doc(db('a'), 'users', 'a')));
});

test('feedback: anyone can send a bug or suggestion, nobody can read them back', async () => {
  const report = (uid, over = {}) => ({
    type: 'bug', userId: uid, username: 'Sam', houseId: null, message: 'Log chore button does nothing', screenshot: null,
    device: { os: 'ios' }, createdAt: serverTimestamp(), ...over,
  });
  const ref = doc(collection(db('sam'), 'feedback'));
  await assertSucceeds(setDoc(ref, report('sam')));
  await assertSucceeds(setDoc(doc(collection(db('sam'), 'feedback')), report('sam', { screenshot: 'imgdata' })));
  await assertFails(getDoc(doc(db('sam'), 'feedback', ref.id)));
  await assertFails(getDocs(collection(db('alice'), 'feedback')));
  await assertFails(setDoc(doc(collection(db('sam'), 'feedback')), report('alice')));
  await assertFails(setDoc(doc(collection(db('sam'), 'feedback')), report('sam', { message: 'hi' })));
  await assertFails(updateDoc(doc(db('sam'), 'feedback', ref.id), { message: 'changed it' }));
  await assertFails(setDoc(doc(collection(env.unauthenticatedContext().firestore(), 'feedback')), report('x')));
  await assertSucceeds(setDoc(doc(collection(db('sam'), 'feedback')), report('sam', { type: 'suggestion', message: 'Add a bin day reminder' })));
  await assertFails(setDoc(doc(collection(db('sam'), 'feedback')), report('sam', { type: 'spam' })));
});

test('feedback inbox: only owners can read reports and tick them off', async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'owners', 'charlie'), { name: 'Charlie' }));
  const ref = doc(collection(db('sam'), 'feedback'));
  await assertSucceeds(setDoc(ref, {
    type: 'bug', userId: 'sam', username: 'Sam', houseId: null, message: 'Checks tab is blank', screenshot: null,
    device: { os: 'ios' }, createdAt: serverTimestamp(),
  }));
  // Owner check: you can see your own owner doc, nobody can list or write owners.
  await assertSucceeds(getDoc(doc(db('charlie'), 'owners', 'charlie')));
  await assertFails(getDoc(doc(db('sam'), 'owners', 'charlie')));
  await assertFails(getDocs(collection(db('charlie'), 'owners')));
  await assertFails(setDoc(doc(db('sam'), 'owners', 'sam'), { name: 'Sam' }));
  // Reading the inbox.
  await assertSucceeds(getDocs(query(collection(db('charlie'), 'feedback'), orderBy('createdAt', 'desc'))));
  await assertFails(getDocs(collection(db('sam'), 'feedback')));
  // Ticking off.
  await assertSucceeds(updateDoc(doc(db('charlie'), 'feedback', ref.id), { done: true }));
  await assertFails(updateDoc(doc(db('charlie'), 'feedback', ref.id), { message: 'edited' }));
  await assertFails(updateDoc(doc(db('sam'), 'feedback', ref.id), { done: false }));
  await assertFails(deleteDoc(doc(db('charlie'), 'feedback', ref.id)));
  // Senders can't pre-tick their own report.
  await assertFails(setDoc(doc(collection(db('sam'), 'feedback')), {
    type: 'bug', userId: 'sam', username: 'Sam', houseId: null, message: 'Another one', screenshot: null, done: true,
    device: { os: 'ios' }, createdAt: serverTimestamp(),
  }));
});

test('only the admin can change how often the leaderboard resets', async () => {
  await createHouse('alice');
  await joinHouse('sam');
  await assertSucceeds(updateDoc(doc(db('alice'), 'houses', 'h1'), { resetMonths: 3 }));
  await assertSucceeds(updateDoc(doc(db('alice'), 'houses', 'h1'), { resetMonths: 1 }));
  await assertFails(updateDoc(doc(db('alice'), 'houses', 'h1'), { resetMonths: 5 }));
  await assertFails(updateDoc(doc(db('alice'), 'houses', 'h1'), { resetMonths: '2' }));
  await assertFails(updateDoc(doc(db('sam'), 'houses', 'h1'), { resetMonths: 6 }));
  // Custom dates
  await assertSucceeds(updateDoc(doc(db('alice'), 'houses', 'h1'), { resetMonths: 0, customStart: '2026-09-15', customEnd: '2026-12-21' }));
  await assertFails(updateDoc(doc(db('alice'), 'houses', 'h1'), { resetMonths: 0, customStart: '2026-12-21', customEnd: '2026-09-15' }));
  await assertFails(updateDoc(doc(db('alice'), 'houses', 'h1'), { customEnd: 'next week' }));
  await assertFails(updateDoc(doc(db('sam'), 'houses', 'h1'), { customEnd: '2026-12-30' }));
  await assertSucceeds(updateDoc(doc(db('alice'), 'houses', 'h1'), { resetMonths: 2, customStart: deleteField(), customEnd: deleteField() }));
  await assertFails(updateDoc(doc(db('alice'), 'houses', 'h1'), { resetMonths: 0 }));
});

// ---- Chore offers ----
async function needsRequest(by, to, id) {
  await setDoc(doc(db(by), 'houses', 'h1', 'requests', id), {
    choreKey: 'bins', choreName: 'Bins', needs: 'Bins are full', kind: 'needs', reason: null, mode: 'overall',
    requestedBy: by, requestedByName: by, assignedTo: to, assignedToName: to, status: 'open',
    createdAt: serverTimestamp(), completedBy: null, completedAt: null,
  });
}
const offerData = (from, id, price = 300) => ({
  requestId: id, choreKey: 'bins', choreName: 'Bins', fromUid: from, fromName: from, price, status: 'open',
  counters: {}, declined: [], doerUid: null, doerName: null, agreedPrice: null, doerPay: null, logId: null, paid: false, closed: false,
  createdAt: serverTimestamp(),
});
const MONZO = { method: 'monzo', link: 'https://monzo.me/sam' };
const CASH = { method: 'cash', link: null };
const offerRef = (uid, id) => doc(db(uid), 'houses', 'h1', 'offers', id);
// Mirrors logChore() with an agreed offer: no score for the doer, offer -> done.
async function logForOffer(uid, offerId, creditTo, requestId = null) {
  const f = db(uid);
  const ref = doc(collection(f, 'houses', 'h1', 'logs'));
  const b = writeBatch(f);
  b.set(ref, { ...logData(uid, 'bins', requestId), offerId, creditTo, creditToName: creditTo });
  b.set(doc(f, 'houses', 'h1', 'photos', ref.id), { userId: uid, data: 'fullphotodata' });
  b.update(doc(f, 'houses', 'h1', 'offers', offerId), { status: 'done', logId: ref.id });
  if (requestId) b.update(doc(f, 'houses', 'h1', 'requests', requestId), { status: 'done', completedBy: uid, completedAt: serverTimestamp() });
  await b.commit();
  return ref.id;
}

test('offers: offer, counters, accept, do it for someone, pay', async () => {
  await createHouse('alice');
  await joinHouse('sam');
  await joinHouse('jo');
  await needsRequest('sam', 'alice', 'r1');

  // Only the person whose turn it is can offer it, at a sensible price.
  await assertFails(setDoc(offerRef('jo', 'r1'), offerData('jo', 'r1')));
  await assertFails(setDoc(offerRef('alice', 'r1'), offerData('alice', 'r1', 10)));
  await assertSucceeds(setDoc(offerRef('alice', 'r1'), offerData('alice', 'r1')));

  // One counter offer each; the offerer can't counter their own.
  await assertFails(updateDoc(offerRef('sam', 'r1'), { 'counters.sam': { name: 'Sam', price: 400, pay: { method: 'monzo', link: 'https://evil.com/x' } } }));
  await assertSucceeds(updateDoc(offerRef('sam', 'r1'), { 'counters.sam': { name: 'Sam', price: 400, pay: MONZO } }));
  await assertFails(updateDoc(offerRef('sam', 'r1'), { 'counters.sam': { name: 'Sam', price: 350, pay: MONZO } }));
  await assertFails(updateDoc(offerRef('alice', 'r1'), { 'counters.alice': { name: 'Alice', price: 100, pay: CASH } }));
  await assertFails(updateDoc(offerRef('jo', 'r1'), { 'counters.sam': { name: 'Sam', price: 9999, pay: CASH } }));

  // Alice declines Sam, then can't accept him; Jo counters and Alice accepts Jo.
  await assertFails(updateDoc(offerRef('sam', 'r1'), { declined: ['sam'] }));
  await assertSucceeds(updateDoc(offerRef('alice', 'r1'), { declined: ['sam'] }));
  const agree = (uid, price, pay) => ({ status: 'agreed', doerUid: uid, doerName: uid, agreedPrice: price, doerPay: pay, agreedAt: serverTimestamp() });
  await assertFails(updateDoc(offerRef('alice', 'r1'), agree('sam', 400, MONZO)));
  await assertSucceeds(updateDoc(offerRef('jo', 'r1'), { 'counters.jo': { name: 'Jo', price: 350, pay: CASH } }));
  await assertFails(updateDoc(offerRef('alice', 'r1'), agree('jo', 100, CASH)));
  await assertFails(updateDoc(offerRef('alice', 'r1'), agree('jo', 350, MONZO)));
  await assertSucceeds(updateDoc(offerRef('alice', 'r1'), agree('jo', 350, CASH)));
  // Too late for anyone else.
  await assertFails(updateDoc(offerRef('sam', 'r1'), agree('sam', 300, CASH)));

  // Only Jo can log it for Alice; it doesn't add to Jo's score.
  await assertFails(logForOffer('sam', 'r1', 'alice', 'r1'));
  const logId = await logForOffer('jo', 'r1', 'alice', 'r1');
  assert.equal((await getDoc(offerRef('jo', 'r1'))).data().status, 'done');

  // Sending it back doesn't need to take anything off anyone's score; the redo goes to Jo.
  const f = db('sam');
  const b = writeBatch(f);
  b.update(doc(f, 'houses', 'h1', 'logs', logId), {
    status: 'rejected', reviewedBy: 'sam', reviewedByName: 'Sam', reviewedAt: serverTimestamp(), rejectReason: 'Still dirty',
  });
  b.set(doc(f, 'houses', 'h1', 'requests', 'redo1'), {
    kind: 'redo', reason: 'Still dirty', logId, choreKey: 'bins', choreName: 'Bins', needs: 'Redo: Bins', mode: 'overall',
    requestedBy: 'sam', requestedByName: 'Sam', assignedTo: 'jo', assignedToName: 'Jo', status: 'open',
    createdAt: serverTimestamp(), completedBy: null, completedAt: null, offerId: 'r1',
  });
  await assertSucceeds(b.commit());
  await assertSucceeds(logForOffer('jo', 'r1', 'alice', 'redo1'));

  // Jo can nudge Alice once a day; nobody else can.
  await assertSucceeds(updateDoc(offerRef('jo', 'r1'), { remindedAt: serverTimestamp() }));
  await assertFails(updateDoc(offerRef('jo', 'r1'), { remindedAt: serverTimestamp() }));
  await assertFails(updateDoc(offerRef('sam', 'r1'), { remindedAt: serverTimestamp() }));

  // Paying: only Alice, and she gets the point.
  await assertFails(updateDoc(offerRef('jo', 'r1'), { paid: true, paidAt: serverTimestamp(), closed: true }));
  const fa = db('alice');
  const pay = writeBatch(fa);
  pay.update(doc(fa, 'houses', 'h1', 'offers', 'r1'), { paid: true, paidAt: serverTimestamp(), closed: true });
  pay.update(doc(fa, 'houses', 'h1', 'members', 'alice'), {
    currentPeriod: P, [`stats.${P}.total`]: increment(1), [`stats.${P}.chores.bins`]: increment(1), lastCompletedAt: serverTimestamp(),
  });
  await assertSucceeds(pay.commit());
  assert.equal((await stats('alice')).total, 1);
});

test('offers: withdraw, accept the asking price', async () => {
  await createHouse('alice');
  await joinHouse('sam');
  await needsRequest('sam', 'alice', 'r2');
  await assertSucceeds(setDoc(offerRef('alice', 'r2'), offerData('alice', 'r2')));
  await assertFails(updateDoc(offerRef('sam', 'r2'), { status: 'cancelled', closed: true }));
  await assertSucceeds(updateDoc(offerRef('alice', 'r2'), { status: 'cancelled', closed: true }));
  await assertFails(updateDoc(offerRef('sam', 'r2'), { status: 'agreed', doerUid: 'sam', doerName: 'Sam', agreedPrice: 300, doerPay: CASH, agreedAt: serverTimestamp() }));

  await needsRequest('sam', 'alice', 'r3');
  await assertSucceeds(setDoc(offerRef('alice', 'r3'), offerData('alice', 'r3', 250)));
  const take = (price, pay) => ({ status: 'agreed', doerUid: 'sam', doerName: 'Sam', agreedPrice: price, doerPay: pay, agreedAt: serverTimestamp() });
  await assertFails(updateDoc(offerRef('sam', 'r3'), take(100, MONZO)));
  await assertFails(updateDoc(offerRef('sam', 'r3'), take(250, null)));
  await assertFails(updateDoc(offerRef('sam', 'r3'), take(250, { method: 'paypal', link: 'https://monzo.me/sam' })));
  await assertSucceeds(updateDoc(offerRef('sam', 'r3'), take(250, MONZO)));
});

test('profile pictures: your own only, photo or valid character', async () => {
  await createHouse('alice');
  await joinHouse('sam');
  const me = (uid, who = uid) => doc(db(uid), 'houses', 'h1', 'members', who);
  const ch = { kind: 'character', skin: 2, hair: 6, hairColor: 0, eyes: 3, mouth: 2, extra: 3, bg: 5 };
  await assertSucceeds(updateDoc(me('sam'), { avatar: ch }));
  await assertSucceeds(updateDoc(me('sam'), { avatar: { kind: 'photo', data: 'jpegdata' } }));
  await assertSucceeds(updateDoc(me('sam'), { avatar: null }));
  await assertFails(updateDoc(me('sam'), { avatar: { ...ch, hair: 7 } }));
  await assertFails(updateDoc(me('sam'), { avatar: { ...ch, extra: 'cape' } }));
  await assertFails(updateDoc(me('sam'), { avatar: { kind: 'photo', data: 'x'.repeat(60001) } }));
  await assertFails(updateDoc(me('sam'), { avatar: { kind: 'gif', data: 'x' } }));
  await assertFails(updateDoc(me('alice', 'sam'), { avatar: ch }));
});

test('house area: postcode area only, admin can change it', async () => {
  await createHouse('alice');
  await joinHouse('sam');
  const house = (uid) => doc(db(uid), 'houses', 'h1');
  const area = { outcode: 'LS6', district: 'Leeds', region: 'Yorkshire and The Humber', country: 'England' };
  await assertSucceeds(updateDoc(house('alice'), { area }));
  await assertFails(updateDoc(house('alice'), { area: { ...area, outcode: 'LS6 1AB' } }));
  await assertFails(updateDoc(house('alice'), { area: { ...area, street: '42 Hyde Park Rd' } }));
  await assertFails(updateDoc(house('sam'), { area }));
});

test('owner dashboard: only owners read totals; last seen is honest', async () => {
  await createHouse('alice');
  await joinHouse('sam');
  await logChore('alice', 'h1', 'bins');
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'owners', 'charlie'), { name: 'Charlie' }));
  const o = db('charlie');
  await assertSucceeds(getDocs(collection(o, 'users')));
  await assertSucceeds(getDocs(collection(o, 'houses')));
  assert.equal((await getCountFromServer(collectionGroup(o, 'members'))).data().count, 2);
  assert.equal((await getCountFromServer(query(collectionGroup(o, 'logs'), where('at', '>=', Timestamp.fromMillis(0))))).data().count, 1);
  await assertSucceeds(getAggregateFromServer(query(collectionGroup(o, 'offers'), where('paid', '==', true)), { n: count(), p: sum('agreedPrice') }));
  // Not for anyone else.
  await assertFails(getDocs(collection(db('sam'), 'users')));
  await assertFails(getDocs(collection(db('sam'), 'houses')));
  await assertFails(getCountFromServer(collectionGroup(db('sam'), 'members')));
  await assertFails(getDocs(collectionGroup(db('alice'), 'logs')));
  // Last seen: only "now", only yourself.
  const me = doc(db('sam'), 'houses', 'h1', 'members', 'sam');
  await assertSucceeds(updateDoc(me, { lastSeenAt: serverTimestamp() }));
  await assertFails(updateDoc(me, { lastSeenAt: Timestamp.fromMillis(Date.now() + 86400000 * 30) }));
  await assertFails(updateDoc(doc(db('alice'), 'houses', 'h1', 'members', 'sam'), { lastSeenAt: serverTimestamp() }));
});

test('profile can record which privacy policy was agreed', async () => {
  await assertSucceeds(setDoc(doc(db('a'), 'users', 'a'), profile({ privacyVersion: '2026-11-09', privacyAcceptedAt: serverTimestamp() })));
  await assertSucceeds(updateDoc(doc(db('a'), 'users', 'a'), { privacyVersion: '2026-12-01', privacyAcceptedAt: serverTimestamp() }));
});

test('analytics: anonymous +1 counters, only owners read', async () => {
  const ref = (uid, id) => doc(db(uid), 'analytics', id);
  await assertSucceeds(setDoc(ref('sam', '2026-11-09_chore_log'), { day: '2026-11-09', event: 'chore_log', n: increment(1) }, { merge: true }));
  await assertSucceeds(setDoc(ref('alice', '2026-11-09_chore_log'), { day: '2026-11-09', event: 'chore_log', n: increment(1) }, { merge: true }));
  await assertFails(setDoc(ref('sam', '2026-11-09_chore_log'), { n: 500 }, { merge: true }));
  await assertFails(setDoc(ref('sam', '2026-11-09_hacked'), { day: '2026-11-09', event: 'hacked', n: 1 }));
  await assertFails(setDoc(ref('sam', '2026-11-09_signup'), { day: '2026-11-09', event: 'chore_log', n: 1 }));
  await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'analytics', '2026-11-09_signup'), { day: '2026-11-09', event: 'signup', n: 1 }));
  await assertFails(getDocs(collection(db('sam'), 'analytics')));
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'owners', 'charlie'), { name: 'Charlie' }));
  const snap = await getDocs(query(collection(db('charlie'), 'analytics'), where('day', '>=', '2026-11-01')));
  assert.equal(snap.docs[0].data().n, 2);
});

test('university must be a real one from the list', async () => {
  const me = doc(db('u1'), 'users', 'u1');
  await assertFails(setDoc(me, profile({ university: 'Hogwarts' })));
  await assertFails(setDoc(me, profile({ university: 'leeds' })));
  await assertSucceeds(setDoc(doc(db('u2'), 'users', 'u2'), profile({ university: "King's College London" })));
  await assertSucceeds(setDoc(doc(db('u3'), 'users', 'u3'), profile({ university: 'Other UK university (not listed)' })));
  await assertSucceeds(setDoc(doc(db('u4'), 'users', 'u4'), profile({ isStudent: false, university: null })));
  await assertSucceeds(setDoc(me, profile()));
  await assertFails(updateDoc(me, { university: 'My Mum’s House' }));
  // Older accounts that typed something before the list was enforced can still update other things.
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'users', 'old'), profile({ university: 'leeds uni lol' })));
  await assertSucceeds(updateDoc(doc(db('old'), 'users', 'old'), { username: 'Oldie' }));
  await assertFails(updateDoc(doc(db('old'), 'users', 'old'), { university: 'still made up' }));
});

test('nudge: housemates can remind whoever it is, at most every 3 hours', async () => {
  await createHouse('alice');
  await joinHouse('sam');
  await joinHouse('jo');
  await needsRequest('sam', 'alice', 'n1');
  const r = (uid) => doc(db(uid), 'houses', 'h1', 'requests', 'n1');
  await assertFails(updateDoc(r('alice'), { lastNudgedAt: serverTimestamp(), lastNudgedBy: 'alice' })); // not your own
  await assertFails(updateDoc(r('jo'), { lastNudgedAt: serverTimestamp(), lastNudgedBy: 'sam' })); // as yourself
  await assertFails(updateDoc(r('jo'), { lastNudgedAt: serverTimestamp(), lastNudgedBy: 'jo', assignedTo: 'jo' }));
  await assertSucceeds(updateDoc(r('jo'), { lastNudgedAt: serverTimestamp(), lastNudgedBy: 'jo' }));
  await assertFails(updateDoc(r('sam'), { lastNudgedAt: serverTimestamp(), lastNudgedBy: 'sam' })); // too soon
  await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'houses', 'h1', 'requests', 'n1'), { lastNudgedAt: Timestamp.fromMillis(Date.now() - 4 * 3600_000) }));
  await assertSucceeds(updateDoc(r('sam'), { lastNudgedAt: serverTimestamp(), lastNudgedBy: 'sam' }));
});

test('notification settings are your own; bin days are the admin\'s', async () => {
  await createHouse('alice');
  await joinHouse('sam');
  const m = (uid, who = uid) => doc(db(uid), 'houses', 'h1', 'members', who);
  await assertSucceeds(updateDoc(m('sam'), { notifPrefs: { check: false, weekly: false } }));
  await assertFails(updateDoc(m('sam'), { notifPrefs: { spam: true } }));
  await assertFails(updateDoc(m('alice', 'sam'), { notifPrefs: { check: true } }));
  const bins = [{ id: 'a', name: 'General waste', every: 1, anchor: '2026-11-17' }];
  await assertSucceeds(updateDoc(doc(db('alice'), 'houses', 'h1'), { bins }));
  await assertFails(updateDoc(doc(db('sam'), 'houses', 'h1'), { bins }));
  await assertFails(updateDoc(doc(db('alice'), 'houses', 'h1'), { bins: Array(7).fill(bins[0]) }));
});

test('sending back creates a redo for the chore-doer', async () => {
  await createHouse('alice');
  await joinHouse('sam');
  const id = await logChore('alice', 'h1', 'bins');
  await assertSucceeds(review('sam', 'h1', id, 'rejected', 'Still dirty: lid open'));
  const reqs = await getDocs(query(collection(db('alice'), 'houses', 'h1', 'requests'), where('status', '==', 'open')));
  assert.equal(reqs.size, 1);
  const r = reqs.docs[0].data();
  assert.equal(r.kind, 'redo');
  assert.equal(r.assignedTo, 'alice');
  assert.equal(r.reason, 'Still dirty: lid open');
  assert.equal((await getDoc(doc(db('alice'), 'houses', 'h1', 'logs', id))).data().rejectReason, 'Still dirty: lid open');
});

test('cannot fake a redo request for a chore you did not send back', async () => {
  await createHouse('alice');
  await joinHouse('sam');
  const id = await logChore('alice', 'h1', 'bins');
  await assertFails(setDoc(doc(collection(db('sam'), 'houses', 'h1', 'requests')), {
    kind: 'redo', reason: 'x', logId: id, choreKey: 'bins', choreName: 'bins', needs: 'Redo: bins', mode: 'overall',
    requestedBy: 'sam', requestedByName: 'Sam', assignedTo: 'alice', assignedToName: 'Alex',
    status: 'open', createdAt: serverTimestamp(), completedBy: null, completedAt: null,
  }));
});
