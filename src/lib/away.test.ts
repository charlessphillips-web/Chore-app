import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addAway, awayAskTime, endAway, currentOrNextAway, fairShareOf, isAway, makeAway, presentWeight } from './away.ts';

const DAY = 86_400_000;
const now = new Date(2026, 10, 16, 12).getTime();

test('makeAway: inclusive days and checks', () => {
  const a = makeAway('2026-11-20', '2026-11-22', now);
  assert.ok(typeof a === 'object');
  assert.equal((a.until - a.from) / DAY, 3);
  assert.equal(typeof makeAway('2026-11-22', '2026-11-20', now), 'string');
  assert.equal(typeof makeAway('2026-11-01', '2026-11-02', now), 'string');
});

test('isAway / currentOrNextAway', () => {
  const a = { from: now - DAY, until: now + DAY };
  const b = { from: now + 5 * DAY, until: now + 6 * DAY };
  assert.equal(isAway([a], now), true);
  assert.equal(isAway([b], now), false);
  assert.deepEqual(currentOrNextAway([b, a], now), a);
  assert.deepEqual(currentOrNextAway([b], now), b);
});

test('presentWeight: away 6 of 60 days → 0.9; overlaps not double counted', () => {
  const start = 0;
  const end = 60 * DAY;
  assert.equal(presentWeight([{ from: 10 * DAY, until: 16 * DAY }], start, end), 0.9);
  assert.equal(presentWeight([{ from: 10 * DAY, until: 16 * DAY }, { from: 12 * DAY, until: 16 * DAY }], start, end), 0.9);
  assert.equal(presentWeight([{ from: -5 * DAY, until: 3 * DAY }], start, end), 0.95);
  assert.equal(presentWeight([], start, end), 1);
  assert.equal(presentWeight([{ from: -DAY, until: 99 * DAY }], start, end), 0.05);
});

test('fairShareOf: away person gets a smaller share', () => {
  const ms = [{ uid: 'a', weight: 1 }, { uid: 'b', weight: 1 }, { uid: 'c', weight: 0.5 }];
  assert.equal(fairShareOf('a', ms), 0.4);
  assert.equal(fairShareOf('c', ms), 0.2);
  assert.equal(fairShareOf('x', []), 1);
});

test('addAway keeps newest first and caps', () => {
  let list: { from: number; until: number }[] = [];
  for (let i = 0; i < 25; i++) list = addAway(list, { from: i * DAY, until: (i + 1) * DAY });
  assert.equal(list.length, 20);
  assert.equal(list[0].from, 24 * DAY);
});

test('endAway: back early, or cancel a future trip', () => {
  const on = { from: now - DAY, until: now + DAY };
  const later = { from: now + DAY, until: now + 2 * DAY };
  assert.deepEqual(endAway([on, later], on, now), [{ from: now - DAY, until: now }, later]);
  assert.deepEqual(endAway([on, later], later, now), [on]);
});

test('awayAskTime: 9:30pm, or 30 minutes later if it is already evening', () => {
  const noon = new Date(2026, 10, 16, 12).getTime();
  assert.equal(new Date(awayAskTime(noon)).getHours(), 21);
  const late = new Date(2026, 10, 16, 22, 10).getTime();
  assert.equal(awayAskTime(late), late + 30 * 60_000);
});
