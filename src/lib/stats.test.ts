import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageBand, ageBars, countSince, signupsByWeek, tally, usersCsv } from './stats.ts';

const today = new Date(2026, 10, 9);
const DAY = 86400000;

test('tally groups and sorts', () => {
  const t = tally(['Leeds', 'UCL', 'Leeds', null, 'Leeds', 'UCL', 'KCL'], 3);
  assert.deepEqual(t.map((b) => [b.label, b.count]), [['Leeds', 3], ['UCL', 2], ['Other', 2]]);
  assert.equal(t[0].share, 3 / 7);
});

test('age bands', () => {
  assert.equal(ageBand('2006-11-10', today), '18–20'); // turns 20 tomorrow → 19
  assert.equal(ageBand('2009-01-01', today), '13–17');
  assert.equal(ageBand('2003-11-09', today), '21–23'); // 23 today
  assert.equal(ageBand('1990-01-01', today), '30+');
  assert.equal(ageBand(null, today), null);
  const bars = ageBars([{ dob: '2005-01-01' }, { dob: '2004-06-01' }, { dob: null }] as never, today);
  assert.deepEqual(bars.map((b) => b.count), [0, 0, 2, 0, 0]); // both are 21–22
});

test('sign-ups by week and activity', () => {
  const now = today.getTime();
  const users = [0, 1, 2, 8, 15, 70].map((d) => ({ createdAt: now - d * DAY })) as never;
  assert.deepEqual(signupsByWeek(users, 4, now).map((b) => b.count), [0, 1, 1, 3]);
  assert.equal(countSince([now - 1000, now - 2 * DAY, null], DAY, now), 1);
});

test('csv has no names or ids', () => {
  const csv = usersCsv([{ dob: '2004-03-07', gender: 'Male', isStudent: true, university: 'Leeds, "Uni"', createdAt: today.getTime(), area: 'LS6 · Leeds' }], today);
  assert.equal(csv.split('\n')[0], 'signed_up,age,age_band,gender,student,university,house_area');
  assert.ok(csv.includes('"22","21–23","Male","yes","Leeds, ""Uni""","LS6 · Leeds"'));
});
