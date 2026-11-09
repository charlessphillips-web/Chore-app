import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ordinal, standing } from './standing.ts';

const m = (uid: string, totalCompleted: number) => ({ uid, username: uid[0].toUpperCase() + uid.slice(1), totalCompleted });

test('ordinals', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal),
    ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st']);
});

test('alone in the house', () => {
  const s = standing([m('me', 1)], 'me');
  assert.equal(s.headline, "You've done 1 chore this period");
  assert.equal(s.progress, null);
});

test('nobody has done anything', () => {
  const s = standing([m('me', 0), m('sam', 0)], 'me');
  assert.equal(s.hint, 'Log a chore to take the lead');
  assert.equal(s.progress, 0);
});

test('2nd: how many to overtake the person above', () => {
  const s = standing([m('me', 3), m('sam', 4), m('jo', 5), m('al', 1)], 'me');
  assert.equal(s.headline, "You're 3rd with 3 chores");
  assert.equal(s.hint, '2 more to overtake Sam');
  assert.equal(s.progress, 3 / 5);
});

test('top, and joint top', () => {
  assert.deepEqual(standing([m('me', 5), m('sam', 3), m('jo', 3)], 'me'),
    { headline: "You're top with 5 chores", hint: '2 ahead of Jo and Sam', progress: 1, place: '1st' });
  assert.equal(standing([m('me', 4), m('sam', 4)], 'me').hint, '1 more to beat Sam');
});

test('joint lower place and zero chores', () => {
  assert.equal(standing([m('me', 2), m('sam', 2), m('jo', 6)], 'me').headline, "You're joint 2nd with 2 chores");
  const z = standing([m('me', 0), m('sam', 2)], 'me');
  assert.equal(z.headline, 'You haven’t logged a chore yet');
  assert.equal(z.hint, '3 more to overtake Sam');
});
