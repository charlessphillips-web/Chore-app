import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrap } from './wrapped.ts';

const m = (uid: string, points: number, chores: number, counts: Record<string, number>) =>
  ({ uid, username: uid.toUpperCase(), points, totalCompleted: chores, choreCounts: counts });

test('wrapped: top, most done, your stats', () => {
  const w = wrap([m('a', 10, 6, { bins: 4, oven: 2 }), m('b', 6, 5, { bins: 5 }), m('c', 4, 4, { sink: 4 })], 'c', (k) => k.toUpperCase());
  assert.equal(w.totalChores, 15);
  assert.equal(w.totalPoints, 20);
  assert.deepEqual(w.top, { names: ['A'], pct: 50 });
  assert.equal(w.fairPct, 33);
  assert.deepEqual(w.mostDone, { key: 'bins', name: 'BINS', count: 9 });
  assert.deepEqual(w.me, { pct: 20, chores: 4, points: 4, topChore: 'SINK', place: 3 });
});

test('wrapped: empty house', () => {
  const w = wrap([m('a', 0, 0, {})], 'a', (k) => k);
  assert.equal(w.top, null);
  assert.equal(w.mostDone, null);
});
