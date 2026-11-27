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

test('weighted points beat raw counts: whoever has fewest points is asked', () => {
  // a did 3 quick chores (3 pts), b did 1 big chore (3 pts) + 1 quick (1) = 4 pts, c did 2 medium (4 pts) → a
  const r = pickAssignee([m('me'), m('a', { totalCompleted: 3, points: 3 }), m('b', { totalCompleted: 2, points: 4 }), m('c', { totalCompleted: 2, points: 4 })], 'me', 'overall', 'bins');
  assert.equal(r?.uid, 'a');
  // b has done more chores than c but fewer points → b is asked
  const r2 = pickAssignee([m('me'), m('b', { totalCompleted: 5, points: 5 }), m('c', { totalCompleted: 2, points: 6 })], 'me', 'overall', 'bins');
  assert.equal(r2?.uid, 'b');
});

test('away people are skipped; `only` limits who can be asked; weight scales points', () => {
  const m = (uid: string, points: number, extra: object = {}) =>
    ({ uid, username: uid, totalCompleted: points, points, choreCounts: {}, lastCompletedAt: null, joinedAt: 0, ...extra });
  const ms = [m('a', 0, { away: true }), m('b', 4), m('c', 6)];
  assert.equal(pickAssignee(ms, 'x', 'overall', 'k')?.uid, 'b');
  assert.equal(pickAssignee(ms, 'x', 'overall', 'k', ['c'])?.uid, 'c');
  assert.equal(pickAssignee(ms, 'x', 'overall', 'k', ['a']), null);
  // b was around half the period: 4 points ÷ 0.5 = 8 > c's 6, so c is further below.
  assert.equal(pickAssignee([m('b', 4, { weight: 0.5 }), m('c', 6)], 'x', 'overall', 'k')?.uid, 'c');
});

test('one task at a time: whoever is holding a chore is skipped until they do it', async () => {
  const { pickAssignee: pick, openTaskCounts } = await import('./assign.ts');
  const m = (uid: string, points: number) => ({ uid, username: uid, totalCompleted: points, points, choreCounts: {}, lastCompletedAt: null, joinedAt: 0 });
  const house = [m('fillip', 0), m('sam', 2), m('alice', 5), m('me', 9)];
  // Nobody busy → bottom of the table
  assert.equal(pick(house, 'me', 'overall', 'bins')?.uid, 'fillip');
  // Fillip's holding the bins → next bottom
  const open = openTaskCounts([{ assignedTo: 'fillip', status: 'open' }]);
  assert.equal(pick(house, 'me', 'overall', 'bins', null, open)?.uid, 'sam');
  // Both busy → Alice
  assert.equal(pick(house, 'me', 'overall', 'x', null, openTaskCounts([{ assignedTo: 'fillip' }, { assignedTo: 'sam' }]))?.uid, 'alice');
  // Everyone busy → fewest open, then the table
  const all = openTaskCounts([{ assignedTo: 'fillip' }, { assignedTo: 'fillip' }, { assignedTo: 'sam' }, { assignedTo: 'alice' }]);
  assert.equal(pick(house, 'me', 'overall', 'x', null, all)?.uid, 'sam');
  // Done ones don't count
  assert.equal(pick(house, 'me', 'overall', 'x', null, openTaskCounts([{ assignedTo: 'fillip', status: 'done' }]))?.uid, 'fillip');
});
