/**
 * Rotawise's "post room": every push notification is sent from here, never
 * from a phone. Phones can't read each other's push addresses, and the
 * words come from what actually happened in the database.
 */
process.env.TZ = 'Europe/London';

import * as functions from 'firebase-functions/v1';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { wants } from '../../src/lib/notifyPrefs.ts';
import { isAway } from '../../src/lib/away.ts';
import { toExpo, weekly, BIG_BINS_KEY, type BinRound, type PushMessage } from '../../src/lib/pushMessages.ts';
import * as E from '../../src/lib/pushEvents.ts';

initializeApp();
const db = getFirestore();
const LONDON = 'Europe/London';
const emulated = process.env.FUNCTIONS_EMULATOR === 'true';

interface Mem { uid: string; username: string; prefs: Record<string, boolean>; away: boolean; legacyToken: string | null }

async function membersOf(houseId: string): Promise<Mem[]> {
  const snap = await db.collection('houses').doc(houseId).collection('members').get();
  const now = Date.now();
  return snap.docs.map((d) => {
    const m = d.data();
    return {
      uid: d.id,
      username: m.username ?? 'A housemate',
      prefs: m.notifPrefs ?? {},
      away: isAway(m.aways, now),
      legacyToken: typeof m.pushToken === 'string' ? m.pushToken : null,
    };
  });
}

/** Red number on the app icon: chores given to you + photos waiting for your check. */
async function badgeFor(houseId: string, uids: string[]): Promise<Map<string, number>> {
  const h = db.collection('houses').doc(houseId);
  const [reqs, logs] = await Promise.all([
    h.collection('requests').where('status', '==', 'open').get(),
    h.collection('logs').where('status', '==', 'pending').get(),
  ]);
  const out = new Map<string, number>();
  for (const u of uids) {
    const mine = reqs.docs.filter((d) => d.data().assignedTo === u).length;
    const toCheck = logs.docs.filter((d) => d.data().userId !== u && !(d.data().checks ?? []).includes(u)).length;
    out.set(u, mine + toCheck);
  }
  return out;
}

/** Sends each message to the people who want that kind. */
async function deliver(houseId: string, sends: E.Send[], members?: Mem[]) {
  const live = sends.filter((s) => s.to.length);
  if (!live.length) return;
  const mem = members ?? (await membersOf(houseId));
  const byUid = new Map(mem.map((m) => [m.uid, m]));
  const uids = [...new Set(live.flatMap((s) => s.to))].filter((u) => byUid.has(u));
  if (!uids.length) return;
  const tokenSnaps = await db.getAll(...uids.map((u) => db.collection('pushTokens').doc(u)));
  const tokens = new Map<string, string>();
  tokenSnaps.forEach((s, i) => {
    const t = s.exists ? s.data()?.token : null;
    const legacy = byUid.get(uids[i])?.legacyToken;
    if (typeof t === 'string') tokens.set(uids[i], t);
    else if (legacy) tokens.set(uids[i], legacy); // older app versions
  });
  const badges = await badgeFor(houseId, uids).catch(() => new Map<string, number>());
  const msgs: ReturnType<typeof toExpo>[] = [];
  for (const s of live) {
    for (const u of new Set(s.to)) {
      const m = byUid.get(u);
      const t = tokens.get(u);
      if (!m || !t || !wants(m.prefs, s.msg.kind)) continue;
      msgs.push(toExpo(s.msg, t, s.msg.size === 'quiet' ? undefined : badges.get(u)));
    }
  }
  await push(msgs);
}

async function push(msgs: ReturnType<typeof toExpo>[]) {
  if (!msgs.length) return;
  if (emulated) {
    // Local testing: record instead of sending.
    const b = db.batch();
    msgs.forEach((m) => b.set(db.collection('_pushlog').doc(), { ...m, at: Timestamp.now() }));
    await b.commit();
    return;
  }
  for (let i = 0; i < msgs.length; i += 100) {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(msgs.slice(i, i + 100)),
    });
    if (!res.ok) functions.logger.warn('Expo push failed', res.status, await res.text());
  }
}

const names = (mem: Mem[]) => Object.fromEntries(mem.map((m) => [m.uid, m.username]));
const house = async (id: string) => (await db.collection('houses').doc(id).get()).data() ?? {};

// ---------- Triggers: things that happened ----------

export const onLogCreated = functions.firestore.document('houses/{h}/logs/{id}').onCreate(async (snap, ctx) => {
  const mem = await membersOf(ctx.params.h);
  await deliver(ctx.params.h, E.logCreated(snap.data(), ctx.params.id, await house(ctx.params.h), mem.map((m) => m.uid), new Date()), mem);
});

export const onLogUpdated = functions.firestore.document('houses/{h}/logs/{id}').onUpdate(async (ch, ctx) => {
  const mem = await membersOf(ctx.params.h);
  await deliver(ctx.params.h, E.logUpdated(ch.before.data(), ch.after.data(), ctx.params.id, mem.map((m) => m.uid), names(mem)), mem);
});

export const onRequestCreated = functions.firestore.document('houses/{h}/requests/{id}').onCreate(async (snap, ctx) => {
  await deliver(ctx.params.h, E.requestCreated(snap.data()));
});

export const onRequestUpdated = functions.firestore.document('houses/{h}/requests/{id}').onUpdate(async (ch, ctx) => {
  const mem = await membersOf(ctx.params.h);
  await deliver(ctx.params.h, E.requestUpdated(ch.before.data(), ch.after.data(), names(mem)), mem);
});

export const onOfferCreated = functions.firestore.document('houses/{h}/offers/{id}').onCreate(async (snap, ctx) => {
  const mem = await membersOf(ctx.params.h);
  await deliver(ctx.params.h, E.offerCreated(snap.data(), ctx.params.id, mem.map((m) => m.uid)), mem);
});

export const onOfferUpdated = functions.firestore.document('houses/{h}/offers/{id}').onUpdate(async (ch, ctx) => {
  await deliver(ctx.params.h, E.offerUpdated(ch.before.data(), ch.after.data(), ctx.params.id));
});

// ---------- Scheduled: bin night and the Sunday summary ----------

/** One round of bin night reminders for every house with bins. */
export async function binNightRound(round: BinRound, now = new Date()) {
  const houses = await db.collection('houses').get();
  for (const h of houses.docs) {
    const data = h.data();
    if (!Array.isArray(data.bins) || !data.bins.length) continue;
    try {
      const mem = await membersOf(h.id);
      const since = Timestamp.fromMillis(now.getTime() - 36 * 3_600_000);
      const [logs, reqs] = await Promise.all([
        h.ref.collection('logs').where('at', '>=', since).get(),
        h.ref.collection('requests').where('status', '==', 'open').get(),
      ]);
      const binLogs = logs.docs.filter((d) => d.data().choreKey === BIG_BINS_KEY).map((d) => (d.data().at as Timestamp).toMillis());
      const r = reqs.docs.map((d) => d.data()).find((x) => x.choreKey === BIG_BINS_KEY && x.kind === 'needs');
      const sends = E.binRound({
        round, now, house: data, members: mem, binLogs,
        request: r ? { assignedTo: r.assignedTo, assignedToName: r.assignedToName } : null,
      });
      await deliver(h.id, sends, mem);
    } catch (e) {
      functions.logger.error('bin night failed', h.id, e);
    }
  }
}

const schedule = (cron: string) => functions.pubsub.schedule(cron).timeZone(LONDON);
export const binNight8pm = schedule('0 20 * * *').onRun(() => binNightRound('first'));
export const binNight10pm = schedule('0 22 * * *').onRun(() => binNightRound('again'));
export const binNight7am = schedule('0 7 * * *').onRun(() => binNightRound('last'));

export async function weeklyRound(now = new Date()) {
  const houses = await db.collection('houses').get();
  const since = Timestamp.fromMillis(now.getTime() - 7 * 86_400_000);
  for (const h of houses.docs) {
    try {
      const mem = await membersOf(h.id);
      if (mem.length < 2) continue;
      const logs = await h.ref.collection('logs').where('at', '>=', since).get();
      const top = E.weeklyTop(logs.docs.map((d) => d.data()).filter((l) => l.status !== 'rejected') as never);
      const sends: E.Send[] = mem.map((m) => ({ to: [m.uid], msg: weekly({ top: top.names, me: top.uids.includes(m.uid) }) as PushMessage }));
      await deliver(h.id, sends, mem);
    } catch (e) {
      functions.logger.error('weekly failed', h.id, e);
    }
  }
}
export const weeklySummary = schedule('0 18 * * 0').onRun(() => weeklyRound());
