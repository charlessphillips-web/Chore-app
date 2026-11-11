import { test } from 'node:test';
import assert from 'node:assert/strict';
import { names, rankedStakes, stakeResult, topStake, type Stake } from './stakes.ts';
import { periodKey, previousPeriodKey } from './period.ts';

const s = (id: string, kind: Stake['kind'], votes: string[], createdAt: number, period = 'p1'): Stake =>
  ({ id, kind, text: id, period, byUid: 'a', byName: 'A', votes, createdAt });

test('top stake: most votes, then earliest; ignores no-vote and other periods', () => {
  const list = [s('a', 'prize', ['1'], 2), s('b', 'prize', ['1', '2'], 3), s('c', 'prize', ['3', '4'], 1), s('d', 'prize', ['1', '2', '3'], 0, 'p0'), s('e', 'forfeit', ['9'], 0)];
  assert.equal(topStake(list, 'prize', 'p1')?.id, 'c');
  assert.equal(topStake(list, 'forfeit', 'p1')?.id, 'e');
  assert.equal(topStake([s('x', 'prize', [], 0)], 'prize', 'p1'), null);
  assert.deepEqual(rankedStakes(list, 'prize', 'p1').map((x) => x.id), ['c', 'b', 'a']);
});

test('result: ties shared, all level = no result', () => {
  assert.deepEqual(stakeResult([{ username: 'A', points: 5 }, { username: 'B', points: 5 }, { username: 'C', points: 1 }]), { winners: ['A', 'B'], losers: ['C'] });
  assert.equal(stakeResult([{ username: 'A', points: 3 }, { username: 'B', points: 3 }]), null);
  assert.equal(stakeResult([{ username: 'A', points: 3 }]), null);
});

test('names and previous period', () => {
  assert.equal(names(['A', 'B', 'C']), 'A, B and C');
  assert.equal(names(['A']), 'A');
  assert.equal(previousPeriodKey(new Date(2026, 10, 11), 2), periodKey(new Date(2026, 9, 15), 2));
  assert.notEqual(previousPeriodKey(new Date(2026, 10, 11), 2), periodKey(new Date(2026, 10, 11), 2));
});

test('last result text', async () => {
  const { lastResult } = await import('./stakes.ts');
  const list = [s('Pint', 'prize', ['1'], 0), s('Roast', 'forfeit', ['1', '2'], 0)];
  assert.equal(lastResult(list, 'p1', [{ username: 'A', points: 6 }, { username: 'B', points: 2 }]), 'A won: Pint. B owes the forfeit: Roast.');
  assert.equal(lastResult([], 'p1', [{ username: 'A', points: 6 }, { username: 'B', points: 2 }]), null);
});
