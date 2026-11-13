import { test } from 'node:test';
import assert from 'node:assert/strict';
import { celebration, celebrationLine } from './celebrate.ts';

test('quick chore → toast, medium/big → popup', () => {
  // 4 people, already above fair share (10 of 20 points).
  assert.equal(celebration({ mine: 10, total: 20, people: 4, points: 1, choreKey: 'bins' }).tier, 'toast');
  assert.equal(celebration({ mine: 10, total: 20, people: 4, points: 2, choreKey: 'bins' }).tier, 'popup');
  assert.equal(celebration({ mine: 10, total: 20, people: 4, points: 3, choreKey: 'bins' }).tier, 'popup');
});

test('crossing fair share → fair (full confetti)', () => {
  // 4 of 20 = 20% < 25%; +2 → 6 of 22 = 27%.
  const c = celebration({ mine: 4, total: 20, people: 4, points: 2, choreKey: 'bins' });
  assert.equal(c.tier, 'fair');
  assert.equal(c.beforePct, 20);
  assert.equal(c.afterPct, 27);
  assert.equal(c.fairPct, 25);
});

test('first chore in the house counts as hitting fair share; alone does not', () => {
  assert.equal(celebration({ mine: 0, total: 0, people: 3, points: 1, choreKey: 'x' }).tier, 'fair');
  assert.equal(celebration({ mine: 0, total: 0, people: 1, points: 1, choreKey: 'x' }).tier, 'toast');
});

test('lines: chore-specific, generic fallback', () => {
  assert.equal(celebrationLine('bins', 0), 'Bins conquered.');
  assert.ok(celebrationLine('unknown chore', 0.99).length > 0);
});
