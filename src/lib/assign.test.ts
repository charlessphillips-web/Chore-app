import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickAssignee, type MemberStats } from './assign.ts';

const m = (uid: string, over: Partial<MemberStats> = {}): MemberStats => ({
  uid,
  username: uid,
  totalCompleted: 0,
  choreCounts: {},
  lastCompletedAt: null,
  joinedAt: 0,
  ...over,
});

test('returns null when the requester is alone', () => {
  assert.equal(pickAssignee([m('me')], 'me', 'overall', 'bins'), null);
});

test('never picks the requester, even if they have done least', () => {
  const r = pickAssignee([m('me'), m('a', { totalCompleted: 5 })], 'me', 'overall', 'bins');
  assert.equal(r?.uid, 'a');
});

test('overall mode picks fewest total chores', () => {
  const r = pickAssignee(
    [m('me'), m('a', { totalCompleted: 4 }), m('b', { totalCompleted: 2 }), m('c', { totalCompleted: 3 })],
    'me', 'overall', 'bins',
  );
  assert.equal(r?.uid, 'b');
});

test('chore mode picks fewest of that chore, ignoring overall lead', () => {
  const r = pickAssignee(
    [
      m('me'),
      m('a', { totalCompleted: 1, choreCounts: { bins: 1 } }),
      m('b', { totalCompleted: 9, choreCounts: { bins: 0, hoover: 9 } }),
    ],
    'me', 'chore', 'bins',
  );
  assert.equal(r?.uid, 'b');
});

test('chore mode breaks ties on overall total', () => {
  const r = pickAssignee(
    [m('me'), m('a', { totalCompleted: 5 }), m('b', { totalCompleted: 2 })],
    'me', 'chore', 'bins',
  );
  assert.equal(r?.uid, 'b');
});

test('tie on count goes to whoever has been idle longest (never first)', () => {
  const r = pickAssignee(
    [m('me'), m('a', { totalCompleted: 1, lastCompletedAt: 100 }), m('b', { totalCompleted: 1, lastCompletedAt: 50 })],
    'me', 'overall', 'bins',
  );
  assert.equal(r?.uid, 'b');
  const r2 = pickAssignee([m('me'), m('a', { lastCompletedAt: 100 }), m('b')], 'me', 'overall', 'bins');
  assert.equal(r2?.uid, 'b');
});

test('full tie falls back to longest in house, then uid', () => {
  assert.equal(pickAssignee([m('me'), m('a', { joinedAt: 20 }), m('b', { joinedAt: 10 })], 'me', 'overall', 'x')?.uid, 'b');
  assert.equal(pickAssignee([m('me'), m('b'), m('a')], 'me', 'overall', 'x')?.uid, 'a');
});
