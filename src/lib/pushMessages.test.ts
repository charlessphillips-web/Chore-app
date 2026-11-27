import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from './pushMessages.ts';
import * as E from './pushEvents.ts';

const house = { bins: [{ id: '1', name: 'Recycling', every: 1 as const, anchor: '2026-11-26' }] };
const tue8pm = new Date(2026, 10, 25, 20, 0);
const members = ['a', 'b', 'c'].map((uid) => ({ uid, username: uid.toUpperCase() + 'name', away: false }));

test('bin night: big for everyone when nobody has been given it', () => {
  const s = E.binRound({ round: 'first', now: tue8pm, house, members, binLogs: [], request: null });
  assert.equal(s.length, 1);
  assert.deepEqual(s[0].to, ['a', 'b', 'c']);
  assert.equal(s[0].msg.size, 'big');
  assert.equal(s[0].msg.title, 'Bin night! 🗑');
  assert.equal(s[0].msg.body, 'Recycling goes out tonight. Anyone can do it.');
});

test('bin night: once flagged, big for whose turn, quiet for others', () => {
  const s = E.binRound({ round: 'again', now: new Date(2026, 10, 25, 22), house, members, binLogs: [], request: { assignedTo: 'b', assignedToName: 'Charlie' } });
  assert.equal(s[0].msg.title, 'Charlie, bins still not out! 🗑');
  assert.deepEqual(s[0].to, ['b']);
  assert.equal(s[0].msg.size, 'big');
  assert.deepEqual(s[1].to, ['a', 'c']);
  assert.equal(s[1].msg.size, 'quiet');
});

test('bin night: stops once someone has logged the bins', () => {
  const done = new Date(2026, 10, 25, 21, 34).getTime();
  assert.deepEqual(E.binRound({ round: 'again', now: new Date(2026, 10, 25, 22), house, members, binLogs: [done], request: null }), []);
  assert.deepEqual(E.binRound({ round: 'last', now: new Date(2026, 10, 26, 7), house, members, binLogs: [done], request: null }), []);
  // ...but last week's bins don't count
  const s = E.binRound({ round: 'last', now: new Date(2026, 10, 26, 7), house, members, binLogs: [done - 7 * 86400000], request: null });
  assert.equal(s[0].msg.title, 'Last call! Bins out now 🗑');
});

test('bin night: nothing on a non-bin night, and away people are skipped', () => {
  assert.deepEqual(E.binRound({ round: 'first', now: new Date(2026, 10, 23, 20), house, members, binLogs: [], request: null }), []);
  const s = E.binRound({ round: 'first', now: tue8pm, house, members: members.map((m) => ({ ...m, away: m.uid === 'c' })), binLogs: [], request: null });
  assert.deepEqual(s[0].to, ['a', 'b']);
});

test('logging the bins on bin night tells everyone', () => {
  const s = E.logCreated({ userId: 'a', username: 'Fabio', choreKey: M.BIG_BINS_KEY, choreName: 'Taking big bins out on bin days' }, 'L1', house, ['a', 'b'], new Date(2026, 10, 25, 21, 34));
  assert.equal(s.length, 1);
  assert.equal(s[0].msg.title, 'Fabio took the bins out ✅');
  assert.deepEqual(s[0].to, ['b']);
  assert.equal(s[0].msg.size, 'quiet');
  assert.equal(s[0].msg.url, '/photo/L1');
  assert.equal(s[0].msg.category, 'check');
  // Any other time it's a normal photo check, with a short name.
  const t = E.logCreated({ userId: 'a', username: 'Fabio', choreKey: M.BIG_BINS_KEY, choreName: 'Taking big bins out on bin days' }, 'L1', house, ['a', 'b'], new Date(2026, 10, 27, 15));
  assert.equal(t[0].msg.title, '📸 Fabio: the big bins');
});

test('your turn, nudge, check: wording and sizes', () => {
  assert.equal(M.yourTurn({ name: 'Charlie', needs: 'Bins are full', choreKey: 'bins' }).title, 'Charlie, your turn: bins are full');
  assert.equal(M.yourTurn({ name: 'Charlie', needs: 'Big bins need taking out', choreKey: M.BIG_BINS_KEY }).title, 'Charlie, your turn for the bins! 🗑');
  const n = M.nudge({ from: 'Fabio', needs: 'Bins are full', choreKey: 'bins' });
  assert.equal(n.title, '👋 Fabio nudged you: bins are full');
  assert.equal(n.size, 'normal');
  assert.equal(M.toCheck({ who: 'Fabio', chore: 'Cleaning oven', logId: 'x' }).size, 'quiet');
});

test('Expo message: sizes map to sound and interruption level', () => {
  const big = M.toExpo(M.payReminder({ who: 'Fabio', chore: 'Oven', price: 400, offerId: 'o' }), 'tok', 2);
  assert.equal(big.interruptionLevel, 'time-sensitive');
  assert.equal(big.sound, 'default');
  assert.equal(big.badge, 2);
  assert.equal(big.title, '💷 Pay Fabio £4 for oven');
  const quiet = M.toExpo(M.reacted({ who: 'Fabio', emoji: '👏', chore: 'Oven' }), 'tok');
  assert.equal(quiet.sound, null);
  assert.equal(quiet.interruptionLevel, 'passive');
  assert.equal(quiet.title, 'Fabio 👏 your oven');
});

test('log updates: send back, duplicate, reactions, check reminder', () => {
  const before = { userId: 'a', username: 'Fabio', choreName: 'Oven', status: 'pending', reactions: { b: '👏' }, checks: [] };
  const r = E.logUpdated(before, { ...before, status: 'rejected', rejectReason: 'Still dirty', reviewedByName: 'Charlie' }, 'L', ['a', 'b', 'c'], {});
  assert.equal(r[0].msg.title, '↩️ Redo: oven');
  assert.equal(r[0].msg.size, 'big');
  const d = E.logUpdated(before, { ...before, status: 'rejected', rejectReason: 'Logged twice', reviewedByName: 'Charlie' }, 'L', ['a'], {});
  assert.equal(d[0].msg.size, 'quiet');
  const re = E.logUpdated(before, { ...before, reactions: { b: '👏', c: '🔥' } }, 'L', ['a', 'b', 'c'], { c: 'Sam' });
  assert.equal(re.length, 1);
  assert.equal(re[0].msg.title, 'Sam 🔥 your oven');
  const cr = E.logUpdated(before, { ...before, checkReminderSent: true, checks: ['b'] }, 'L', ['a', 'b', 'c'], {});
  assert.deepEqual(cr[0].to, ['c']);
});

test('nudges: only real ones, at most once an hour', () => {
  const t = (h: number) => ({ toMillis: () => h * 3600000 });
  const base = { status: 'open', assignedTo: 'b', needs: 'Bins are full', choreKey: 'bins', lastNudgedBy: 'a' };
  assert.equal(E.requestUpdated({ ...base }, { ...base, lastNudgedAt: t(10) }, { a: 'Fabio' }).length, 1);
  assert.equal(E.requestUpdated({ ...base, lastNudgedAt: t(10) }, { ...base, lastNudgedAt: t(10.5) }, { a: 'Fabio' }).length, 0);
  assert.equal(E.requestUpdated({ ...base, lastNudgedAt: t(10) }, { ...base, lastNudgedAt: t(11) }, { a: 'Fabio' }).length, 1);
  assert.equal(E.requestCreated({ kind: 'redo', status: 'open', assignedTo: 'b' }).length, 0);
});

test('offers: taken, counter, accepted, declined, reminder, paid', () => {
  const o = { fromUid: 'a', fromName: 'Charlie', choreName: 'Oven', price: 300, status: 'open', counters: {}, declined: [], paid: false };
  assert.equal(E.offerUpdated(o, { ...o, status: 'agreed', doerUid: 'b', doerName: 'Fabio', agreedPrice: 300 }, 'o')[0].msg.title, "🤝 Fabio's doing your oven for £3");
  const c = { ...o, counters: { b: { name: 'Fabio', price: 400 } } };
  assert.equal(E.offerUpdated(o, c, 'o')[0].msg.title, 'Fabio wants £4 for oven');
  const acc = E.offerUpdated(c, { ...c, status: 'agreed', doerUid: 'b', doerName: 'Fabio', agreedPrice: 400 }, 'o');
  assert.equal(acc[0].msg.title, '✅ Deal: oven for £4');
  assert.deepEqual(acc[0].to, ['b']);
  assert.equal(E.offerUpdated(c, { ...c, declined: ['b'] }, 'o')[0].msg.title, 'Charlie said no to £4');
  const agreed = { ...o, status: 'done', doerUid: 'b', doerName: 'Fabio', agreedPrice: 400 };
  assert.equal(E.offerUpdated(agreed, { ...agreed, remindedAt: { toMillis: () => 5 } }, 'o')[0].msg.size, 'big');
  assert.equal(E.offerUpdated(agreed, { ...agreed, paid: true }, 'o')[0].msg.title, '💷 Charlie paid you £4');
});

test('weekly top', () => {
  const top = E.weeklyTop([{ userId: 'a', username: 'Fabio', points: 3 }, { userId: 'b', username: 'Sam', points: 2 }, { userId: 'b', username: 'Sam', points: 1 }]);
  assert.deepEqual(top.names, ['Fabio', 'Sam']);
  assert.equal(M.weekly({ top: ['Fabio'], me: false }).title, '🏆 Fabio topped the house this week');
});

test('phone bin night plan: 8pm, 10pm, 7am; skips done nights; whose turn only for the coming night', async () => {
  const { binNightPlan } = await import('./binNight.ts');
  const base = { bins: house.bins, binLogs: [] as number[], turn: null as { uid: string; name: string } | null, me: 'a', aways: [] as { from: number; until: number }[] };
  const plan = binNightPlan(base, new Date(2026, 10, 25, 12), 2);
  assert.deepEqual(plan.slice(0, 3).map((p) => [p.at.getDate(), p.at.getHours(), p.msg.size]), [[25, 20, 'big'], [25, 22, 'big'], [26, 7, 'big']]);
  assert.equal(plan.length, 6);
  const done = binNightPlan({ ...base, binLogs: [new Date(2026, 10, 25, 21).getTime()] }, new Date(2026, 10, 25, 21, 30), 2);
  assert.equal(done[0].at.getDate(), 2); // next week's bin night (Wed 2 Dec)
  const mine = binNightPlan({ ...base, turn: { uid: 'a', name: 'Charlie' } }, new Date(2026, 10, 25, 12), 2);
  assert.equal(mine[0].msg.title, 'Charlie, your turn for the bins! 🗑');
  assert.equal(mine[3].msg.title, 'Bin night! 🗑'); // next week: nobody's turn yet
  const theirs = binNightPlan({ ...base, turn: { uid: 'b', name: 'Fabio' } }, new Date(2026, 10, 25, 12), 2);
  assert.equal(theirs[0].msg.size, 'quiet');
  const away = binNightPlan({ ...base, aways: [{ from: new Date(2026, 10, 24).getTime(), until: new Date(2026, 10, 28).getTime() }] }, new Date(2026, 10, 25, 12), 2);
  assert.equal(away[0].at.getDate(), 2);
});

test('bins-done wake-up is recognised in every payload shape', async () => {
  const { isBinsDone: check } = await import('./binNight.ts');
  assert.equal(check({ data: { binsDone: true } }), true);
  assert.equal(check({ data: { dataString: '{"binsDone":true}' } }), true);
  assert.equal(check({ notification: { request: { content: { data: { binsDone: true } } } } }), true);
  assert.equal(check({ data: { url: '/home' } }), false);
  assert.equal(check(null), false);
});
