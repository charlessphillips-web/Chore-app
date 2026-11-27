import { test } from 'node:test';
import assert from 'node:assert/strict';
import { turnReminder, turnReminderPlan, turnTimes, wakeData } from './turnReminders.ts';

const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime();
const turn = { id: 'r1', kind: 'needs' as const, needs: 'Bins are full', choreKey: 'bins', choreName: 'Bins', createdAt: at(27, 13) };

test('reminders: +2h, +5h, then 9am and 6pm, never at night, for 3 days', () => {
  const times = turnTimes(turn, at(27, 13)).map((d) => `${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`);
  assert.deepEqual(times, ['27 15:00', '27 18:00', '28 9:00', '28 18:00', '29 9:00', '29 18:00', '30 9:00']);
  // Asked at 9pm: no 11pm or 2am reminders
  const late = turnTimes({ ...turn, createdAt: at(27, 21) }, at(27, 21)).map((d) => d.getHours());
  assert.ok(late.every((h) => h >= 8 && h < 22));
  // Past ones are dropped
  assert.equal(turnTimes(turn, at(28, 10))[0].getHours(), 18);
});

test('reminder wording gets louder after a day', () => {
  assert.equal(turnReminder(turn, 2 * 3600000).title, '⏰ Still to do: bins are full');
  assert.equal(turnReminder(turn, 2 * 3600000).size, 'normal');
  const day = turnReminder(turn, 26 * 3600000);
  assert.equal(day.title, '⏰ Still waiting: bins are full');
  assert.equal(day.size, 'big');
  assert.equal(turnReminder({ ...turn, kind: 'redo', choreName: 'Cleaning oven' }, 3600000).title, '⏰ Still to do: redo cleaning oven');
});

test('plan skips bin night chores and names each reminder by chore', () => {
  const plan = turnReminderPlan([turn, { ...turn, id: 'b', choreKey: 'taking big bins out on bin days' }], at(27, 13));
  assert.ok(plan.every((p) => p.id.startsWith('rw-turn-r1-')));
});

test('wake data in every shape', () => {
  assert.equal(wakeData({ data: { dataString: '{"turnDone":"r1"}' } }).turnDone, 'r1');
  assert.equal(wakeData({ data: { turnDone: 'r2' } }).turnDone, 'r2');
  assert.deepEqual(wakeData(null), {});
});
