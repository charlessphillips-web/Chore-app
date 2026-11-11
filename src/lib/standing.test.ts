import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ordinal, pointsToFairShare, standing } from './standing.ts';

const m = (uid: string, points: number) => ({ uid, username: uid[0].toUpperCase() + uid.slice(1), totalCompleted: points, points });

test('ordinals', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal),
    ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st']);
});

test('points needed to reach a fair share', () => {
  // 4 people, house has 20 points, I have 2 → need x: (2+x)/(20+x) >= 0.25 → x >= 4 (6 of 24 = 25%)
  assert.equal(pointsToFairShare(2, 20, 4), 4);
  assert.equal(pointsToFairShare(5, 20, 4), 0);
  assert.equal(pointsToFairShare(0, 0, 3), 1);
  assert.equal(pointsToFairShare(3, 3, 1), 0);
});

test('alone, nobody started, behind, and ahead', () => {
  assert.equal(standing([m('me', 3)], 'me').active, false);
  const zero = standing([m('me', 0), m('sam', 0)], 'me');
  assert.equal(zero.headline, 'Your fair share is 50% of the chores');
  const behind = standing([m('me', 2), m('sam', 9), m('jo', 5), m('al', 4)], 'me');
  assert.deepEqual([behind.sharePct, behind.fairPct, behind.place], [10, 25, '4th']);
  assert.equal(behind.hint, '4 points to reach your fair share');
  const ahead = standing([m('me', 9), m('sam', 2), m('jo', 5), m('al', 4)], 'me');
  assert.equal(ahead.hint, 'You’re doing more than your fair share 👏');
  assert.equal(standing([m('me', 4), m('sam', 4)], 'me').place, 'joint 1st');
});
