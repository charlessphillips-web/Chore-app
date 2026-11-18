import { test } from 'node:test';
import assert from 'node:assert/strict';
import { afterChore, currentStreak, doneThisWeek, milestoneHit, weekKey } from './streak.ts';

const DAY = 86_400_000;
const wed = new Date(2026, 10, 18, 12).getTime(); // Wed 18 Nov 2026

test('weekKey is the Monday', () => {
  assert.equal(weekKey(wed), '2026-11-16');
  assert.equal(weekKey(new Date(2026, 10, 22, 23).getTime()), '2026-11-16'); // Sunday
  assert.equal(weekKey(new Date(2026, 10, 23, 1).getTime()), '2026-11-23'); // Monday
});

test('streak grows once a week, survives till the end of next week, then breaks', () => {
  let s = afterChore(null, wed);
  assert.deepEqual(s, { weeks: 1, lastWeek: '2026-11-16' });
  s = afterChore(s, wed + DAY); // same week: no change
  assert.equal(s.weeks, 1);
  assert.equal(doneThisWeek(s, wed), true);
  s = afterChore(s, wed + 7 * DAY);
  assert.equal(s.weeks, 2);
  assert.equal(currentStreak(s, wed + 14 * DAY), 2); // still alive next week
  assert.equal(currentStreak(s, wed + 21 * DAY), 0); // missed a whole week
  assert.equal(afterChore(s, wed + 21 * DAY).weeks, 1);
});

test('a week you were mostly away does not break it', () => {
  const s = { weeks: 3, lastWeek: '2026-11-16' };
  const away = (from: number, to: number) => {
    const a = new Date(2026, 10, 23).getTime(); const b = new Date(2026, 10, 30).getTime();
    return Math.max(0, Math.min(to, b) - Math.max(from, a)) / DAY;
  };
  const twoWeeksOn = wed + 14 * DAY; // week of 30 Nov; 23 Nov week was all away
  assert.equal(currentStreak(s, twoWeeksOn + 7 * DAY, away), 0); // week of 30 Nov missed too
  assert.equal(currentStreak(s, twoWeeksOn + 7 * DAY - 7 * DAY, away), 3);
  assert.equal(afterChore(s, twoWeeksOn, away).weeks, 4);
});

test('milestones', () => {
  assert.equal(milestoneHit({ weeks: 3, lastWeek: 'a' }, { weeks: 4, lastWeek: 'b' }), 4);
  assert.equal(milestoneHit({ weeks: 4, lastWeek: 'b' }, { weeks: 4, lastWeek: 'b' }), null);
  assert.equal(milestoneHit(null, { weeks: 1, lastWeek: 'b' }), null);
});
