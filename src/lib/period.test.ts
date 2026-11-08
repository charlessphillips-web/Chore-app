import { test } from 'node:test';
import assert from 'node:assert/strict';
import { periodEnd, periodKey, periodLabel } from './period.ts';
import { ageOn, dobError, parseDob, toDobString } from './dob.ts';
import { addChore, DEFAULT_CHORES, makeChore } from './chores.ts';

test('2-month periods', () => {
  assert.equal(periodKey(new Date(2026, 0, 1)), 'p2026_01');
  assert.equal(periodKey(new Date(2026, 1, 28)), 'p2026_01');
  assert.equal(periodKey(new Date(2026, 2, 1)), 'p2026_03');
  assert.equal(periodKey(new Date(2026, 10, 8)), 'p2026_11');
  assert.equal(periodKey(new Date(2026, 11, 31)), 'p2026_11');
  assert.equal(periodLabel(new Date(2026, 10, 8)), 'Nov – Dec 2026');
  assert.equal(periodLabel(new Date(2026, 3, 8)), 'Mar – Apr 2026');
  assert.deepEqual(periodEnd(new Date(2026, 10, 8)), new Date(2027, 0, 1));
});

test('date of birth', () => {
  assert.equal(toDobString(new Date(2004, 2, 7)), '2004-03-07');
  assert.equal(parseDob('2001-02-31'), null);
  assert.equal(ageOn('2004-11-09', new Date(2026, 10, 8)), 21); // birthday tomorrow
  assert.equal(ageOn('2004-11-08', new Date(2026, 10, 8)), 22); // birthday today
  assert.equal(dobError('2015-01-01', new Date(2026, 10, 8)), 'You need to be 13 or over to use Choreboard.');
  assert.equal(dobError('2004-03-07', new Date(2026, 10, 8)), null);
  assert.equal(dobError('', new Date()), 'Enter your date of birth.');
});

test('house chore list', () => {
  assert.equal(DEFAULT_CHORES.length, 10);
  assert.equal(DEFAULT_CHORES[0].needs, 'Bins are full');
  assert.equal(makeChore('Recycling', '').needs, 'Recycling needs doing');
  const r = addChore(DEFAULT_CHORES, 'Recycling', 'Recycling is full');
  assert.ok(Array.isArray(r) && r.length === 11);
  assert.equal(addChore(DEFAULT_CHORES, '  bins ', ''), 'That chore is already on the list.');
  assert.equal(addChore(DEFAULT_CHORES, '!', ''), 'Give the chore a name.');
});
