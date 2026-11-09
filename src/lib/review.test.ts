import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUTO_VERIFY_MS, effectiveStatus, needsCheckBy, redoReason, timeLeft } from './review.ts';

const H = 3_600_000;

test('pending becomes auto-verified after 24 hours', () => {
  assert.equal(effectiveStatus({ status: 'pending', at: 0 }, 23 * H), 'pending');
  assert.equal(effectiveStatus({ status: 'pending', at: 0 }, AUTO_VERIFY_MS), 'auto_verified');
  assert.equal(effectiveStatus({ status: 'rejected', at: 0 }, 48 * H), 'rejected');
  assert.equal(effectiveStatus({ status: 'verified', at: 0 }, 48 * H), 'verified');
});

test('checks list: only other people\'s pending chores, within 24h', () => {
  const log = { status: 'pending' as const, at: 0, userId: 'alice' };
  assert.equal(needsCheckBy(log, 'sam', H), true);
  assert.equal(needsCheckBy(log, 'alice', H), false);
  assert.equal(needsCheckBy(log, 'sam', 25 * H), false);
  assert.equal(needsCheckBy({ ...log, status: 'verified' }, 'sam', H), false);
});

test('time left label', () => {
  assert.equal(timeLeft(0, H), '23h left');
  assert.equal(timeLeft(0, 23.5 * H), '30m left');
});

test('redo reason text', () => {
  assert.equal(redoReason('Still dirty', ''), 'Still dirty');
  assert.equal(redoReason('Still dirty', '  the   hob is greasy '), 'Still dirty: the hob is greasy');
  assert.equal(redoReason('Other', 'x'.repeat(300)).length, 140);
});
