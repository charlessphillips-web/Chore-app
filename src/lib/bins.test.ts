import { test } from 'node:test';
import assert from 'node:assert/strict';
import { binsOn, listNames, nextCollections, reminderTimes, scheduleLabel } from './bins.ts';

const general = { id: 'a', name: 'General waste', every: 1 as const, anchor: '2026-11-10' }; // a Tuesday
const recycling = { id: 'b', name: 'Recycling', every: 2 as const, anchor: '2026-11-17' };

test('next collections repeat weekly or fortnightly', () => {
  const from = new Date(2026, 10, 11); // Wed 11 Nov
  assert.deepEqual(nextCollections(general, from, 2), [new Date(2026, 10, 17), new Date(2026, 10, 24)]);
  assert.deepEqual(nextCollections(recycling, from, 2), [new Date(2026, 10, 17), new Date(2026, 11, 1)]);
  // On the day itself it counts as "next"; an old anchor still works.
  assert.deepEqual(nextCollections({ ...recycling, anchor: '2026-10-06' }, new Date(2026, 10, 17), 1), [new Date(2026, 10, 17)]);
  assert.equal(scheduleLabel(general), 'every Tuesday');
  assert.equal(scheduleLabel(recycling), 'every other Tuesday');
});

test('which bins on a day, and reminders the night before', () => {
  assert.deepEqual(binsOn([general, recycling], new Date(2026, 10, 17)), ['General waste', 'Recycling']);
  assert.deepEqual(binsOn([general, recycling], new Date(2026, 10, 24)), ['General waste']);
  assert.deepEqual(binsOn([general, recycling], new Date(2026, 10, 23)), []);
  const r = reminderTimes([general, recycling], new Date(2026, 10, 16, 21), 3); // after 8pm Monday: that one's gone
  assert.deepEqual(r.map((x) => [x.at.getDate(), x.at.getHours(), x.names]), [[23, 20, ['General waste']], [30, 20, ['General waste', 'Recycling']]]);
  assert.equal(listNames(['A', 'B', 'C']), 'A, B and C');
});
