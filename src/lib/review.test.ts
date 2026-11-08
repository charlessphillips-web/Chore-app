import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyVote, reviewStatus, scoreDelta } from './review.ts';

test('status from votes', () => {
  assert.equal(reviewStatus([], []), 'pending');
  assert.equal(reviewStatus(['a'], []), 'verified');
  assert.equal(reviewStatus(['a'], ['b']), 'verified'); // tie goes to the chore-doer
  assert.equal(reviewStatus([], ['b']), 'rejected');
  assert.equal(reviewStatus(['a'], ['b', 'c']), 'rejected');
});

test('one vote per person, can change or clear it', () => {
  let v = applyVote([], [], 'a', 'ok');
  assert.deepEqual(v, { okVoters: ['a'], notOkVoters: [] });
  v = applyVote(v.okVoters, v.notOkVoters, 'a', 'ok');
  assert.deepEqual(v, { okVoters: ['a'], notOkVoters: [] });
  v = applyVote(v.okVoters, v.notOkVoters, 'a', 'not_ok');
  assert.deepEqual(v, { okVoters: [], notOkVoters: ['a'] });
  v = applyVote(v.okVoters, v.notOkVoters, 'a', null);
  assert.deepEqual(v, { okVoters: [], notOkVoters: [] });
});

test('score only changes when crossing into or out of rejected', () => {
  assert.equal(scoreDelta('pending', 'verified'), 0);
  assert.equal(scoreDelta('pending', 'rejected'), -1);
  assert.equal(scoreDelta('verified', 'rejected'), -1);
  assert.equal(scoreDelta('rejected', 'verified'), 1);
  assert.equal(scoreDelta('rejected', 'rejected'), 0);
});
