import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allClear, partOfDay, todayItems, type TodayInput } from './today.ts';

const BIG = 'taking big bins out on bin days';
// Wed 25 Nov 2026; recycling collected Thu 26 Nov.
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m);
const base = (now: Date, over: Partial<TodayInput> = {}): TodayInput => ({
  now,
  me: 'me',
  bins: [{ id: '1', name: 'Recycling', every: 1, anchor: '2026-11-26' }],
  members: [
    { uid: 'me', username: 'Charlie', points: 4, away: false },
    { uid: 'f', username: 'Fabio', points: 6, away: false },
    { uid: 's', username: 'Sam', points: 9, away: false },
  ],
  requests: [], logs: [], toCheck: [], offers: [],
  streak: { weeks: 3, doneThisWeek: true },
  toFair: 0,
  periodEnd: at(30, 0),
  ...over,
});
const ids = (o: TodayInput) => todayItems(o).map((i) => i.id);

test('bin night comes first, for everyone, until someone logs it', () => {
  const items = todayItems(base(at(25, 20)));
  assert.equal(items[0].id, 'bins');
  assert.equal(items[0].title, 'Bin night 🗑 Recycling goes out');
  assert.equal(items[0].sub, "Nobody's on it yet. Anyone can do it.");
  // Not bin night on Monday
  assert.ok(!ids(base(at(23, 20))).includes('bins'));
  // Logged → becomes quiet news
  const done = todayItems(base(at(25, 21), { logs: [{ id: 'l', userId: 's', username: 'Sam', choreKey: BIG, choreName: 'x', status: 'pending', checks: [], at: at(25, 20, 30).getTime() }] }));
  assert.equal(done.find((i) => i.id === 'bins')?.title, 'Sam took the bins out ✅');
  assert.equal(done.find((i) => i.id === 'bins')?.kind, 'news');
});

test('bin night given to someone else drops below your own jobs', () => {
  const o = base(at(25, 20), {
    requests: [
      { id: 'r1', kind: 'needs', assignedTo: 'f', assignedToName: 'Fabio', needs: 'Big bins need taking out', choreKey: BIG, choreName: 'Bins', requestedByName: 'Sam', createdAt: at(25, 19).getTime() },
      { id: 'r2', kind: 'needs', assignedTo: 'me', assignedToName: 'Charlie', needs: 'Bins are full', choreKey: 'bins', choreName: 'Bins', requestedByName: 'Sam', createdAt: at(25, 18).getTime() },
    ],
  });
  const items = todayItems(o);
  assert.equal(items[0].title, 'Your turn: bins are full');
  assert.equal(items.find((i) => i.id === 'bins')?.sub, "Fabio's turn");
});

test('streak only shows Thursday–Sunday, loudest on Sunday', () => {
  const s = { streak: { weeks: 4, doneThisWeek: false } };
  assert.ok(!ids(base(at(24, 12), s)).includes('streak')); // Tuesday
  const thu = todayItems(base(at(26, 13), s)).find((i) => i.id === 'streak')!;
  const sun = todayItems(base(at(29, 13), s)).find((i) => i.id === 'streak')!;
  assert.ok(sun.score > thu.score);
  assert.equal(sun.title, 'Last day for your 4-week streak 🔥');
});

test('fair share and table get louder near the reset', () => {
  const early = todayItems(base(at(10, 13), { toFair: 2, periodEnd: at(30, 0) })).find((i) => i.id === 'fair')!;
  const late = todayItems(base(at(28, 13), { toFair: 2, periodEnd: at(30, 0) })).find((i) => i.id === 'fair')!;
  assert.ok(late.score > early.score);
  const t = todayItems(base(at(28, 13))).find((i) => i.id === 'table')!;
  assert.equal(t.title, "You're 3rd · Sam leads by 5");
  assert.equal(t.sub, 'Table resets in 2 days');
  // Not close and not near the end → no table item
  assert.ok(!ids(base(at(10, 13))).includes('table'));
});

test('photos to check, money owed, offers and all clear', () => {
  const logs = [
    { id: 'a', userId: 'f', username: 'Fabio', choreKey: 'oven', choreName: 'Cleaning oven', status: 'pending', checks: [], at: at(25, 9).getTime() },
    { id: 'b', userId: 's', username: 'Sam', choreKey: 'hoover', choreName: 'Hoovering', status: 'pending', checks: [], at: at(25, 10).getTime() },
  ];
  const one = todayItems(base(at(25, 14), { logs, toCheck: ['a'] })).find((i) => i.id === 'check')!;
  assert.equal(one.title, 'Fabio: cleaning oven');
  const two = todayItems(base(at(25, 14), { logs, toCheck: ['a', 'b'] })).find((i) => i.id === 'check')!;
  assert.equal(two.title, '2 photos to check');
  const offers = [
    { id: 'o1', status: 'done', fromUid: 'me', fromName: 'Charlie', doerUid: 'f', doerName: 'Fabio', choreName: 'Hoovering', price: 300, agreedPrice: 400, counters: {}, checked: true },
    { id: 'o2', status: 'open', fromUid: 's', fromName: 'Sam', doerUid: null, doerName: null, choreName: 'Oven', price: 500, agreedPrice: null, counters: {}, checked: false },
  ];
  const items = todayItems(base(at(25, 14), { offers }));
  assert.equal(items[0].title, 'Pay Fabio £4');
  assert.equal(items.find((i) => i.kind === 'offer')?.title, '£5 to do oven');
  assert.equal(allClear(items, at(25, 14)), null);
  assert.equal(allClear(todayItems(base(at(25, 20, 0), { bins: [] })), at(25, 20)), 'All clear tonight ✅');
  assert.equal(partOfDay(at(25, 9)), 'This morning');
});

test('who is away and house news fill the gaps', () => {
  const o = base(at(24, 15), {
    members: [
      { uid: 'me', username: 'Charlie', points: 4, away: false },
      { uid: 'f', username: 'Fabio', points: 3, away: true, awayTill: 'Sun 29 Nov' },
    ],
    logs: [{ id: 'x', userId: 'f', username: 'Fabio', choreKey: 'oven', choreName: 'Cleaning oven', status: 'verified', checks: [], at: at(24, 9).getTime() }],
  });
  const items = todayItems(o);
  assert.deepEqual(items.map((i) => i.id), ['table', 'news', 'away']);
  assert.equal(items[2].title, "Fabio's away till Sun 29 Nov ✈️");
});

test('table: ties and an empty table', () => {
  const tie = base(at(28, 13), { members: [
    { uid: 'me', username: 'Charlie', points: 5, away: false },
    { uid: 's', username: 'Sam', points: 5, away: false },
  ] });
  assert.equal(todayItems(tie).find((i) => i.id === 'table')?.title, "You're joint top 🏆");
  const zero = base(at(28, 13), { members: [
    { uid: 'me', username: 'Charlie', points: 0, away: false },
    { uid: 's', username: 'Sam', points: 0, away: false },
  ] });
  assert.ok(!todayItems(zero).some((i) => i.id === 'table'));
});
