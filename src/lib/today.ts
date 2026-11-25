/**
 * "Your house, today": the 3 things that matter most to you right now, like
 * a news app's daily recap. Every possible item gets a score; what scores
 * highest depends on the day (bin night, Sunday, the end of the month) and
 * on you (your turn, money you owe, how close you are to your fair share).
 */
import { binsOn, listNames, type BinSchedule } from './bins.ts';
import { formatPrice } from './money.ts';
import { BIG_BINS_KEY, lower } from './pushMessages.ts';

export type TodayKind =
  | 'bins' | 'turn' | 'redo' | 'owe' | 'check' | 'offer' | 'streak' | 'fair' | 'table' | 'news' | 'away';

export interface TodayItem {
  id: string;
  kind: TodayKind;
  title: string;
  sub?: string;
  /** Screen to open when tapped. */
  url: string;
  /** Short label for a big button, e.g. "📸 Do the bins". */
  action?: string;
  score: number;
}

export interface TodayInput {
  now: Date;
  me: string;
  bins: BinSchedule[];
  members: { uid: string; username: string; points: number; away: boolean; awayTill?: string }[];
  requests: { id: string; kind: 'needs' | 'redo'; assignedTo: string; assignedToName: string; needs: string; choreKey: string; choreName: string; reason?: string | null; requestedByName: string; createdAt: number }[];
  logs: { id: string; userId: string; username: string; choreKey: string; choreName: string; status: string; checks: string[]; at: number }[];
  /** Logs you can check (not yours, not checked by you, still pending). */
  toCheck: string[];
  offers: { id: string; status: string; fromUid: string; fromName: string; doerUid: string | null; doerName: string | null; choreName: string; price: number; agreedPrice: number | null; counters: Record<string, unknown>; checked: boolean }[];
  streak: { weeks: number; doneThisWeek: boolean };
  /** Points you need to reach your fair share (0 = you're there). */
  toFair: number;
  /** A quick chore that would help, e.g. "Hoovering". */
  suggestion?: string | null;
  /** When the leaderboard resets. */
  periodEnd: Date;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Morning / afternoon / tonight, for the little label on the card. */
export function partOfDay(now: Date): 'This morning' | 'This afternoon' | 'Tonight' {
  const h = now.getHours();
  return h < 12 ? 'This morning' : h < 17 ? 'This afternoon' : 'Tonight';
}

/** Is it bin night (6pm the night before → noon on bin day)? Which bins, and is it the morning itself? */
function binWindow(bins: BinSchedule[], now: Date): { names: string[]; morning: boolean } | null {
  const h = now.getHours();
  if (h >= 18) {
    const names = binsOn(bins, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    return names.length ? { names, morning: false } : null;
  }
  if (h < 12) {
    const names = binsOn(bins, now);
    return names.length ? { names, morning: true } : null;
  }
  return null;
}

export function todayItems(o: TodayInput): TodayItem[] {
  const { now, me } = o;
  const t = now.getTime();
  const out: TodayItem[] = [];

  // 1. Bin night (until someone's logged the big bins since 6pm the night before).
  const bw = binWindow(o.bins, now);
  if (bw) {
    const eve = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (bw.morning ? 1 : 0), 18).getTime();
    const done = o.logs.find((l) => l.choreKey === BIG_BINS_KEY && l.at >= eve && l.status !== 'rejected');
    const what = listNames(bw.names);
    const go = bw.names.length > 1 ? 'go' : 'goes';
    if (done) {
      out.push({ id: 'bins', kind: 'news', title: `${done.userId === me ? 'You' : done.username} took the bins out ✅`, sub: `${what} ${bw.morning ? 'today' : 'tomorrow'}`, url: '/house', score: 30 });
    } else {
      const req = o.requests.find((r) => r.kind === 'needs' && r.choreKey === BIG_BINS_KEY);
      const mine = req?.assignedTo === me;
      out.push({
        id: 'bins',
        kind: 'bins',
        title: mine ? 'Your turn: bin night 🗑' : `Bin night 🗑 ${what} ${go} out`,
        sub: req ? (mine ? `${what} ${go} out ${bw.morning ? 'this morning' : 'tonight'}` : `${req.assignedToName}'s turn`) : `Nobody's on it yet. Anyone can do it.`,
        url: `/chore/${encodeURIComponent(BIG_BINS_KEY)}`,
        action: '📸 Do the bins',
        // Loudest when it's yours or nobody's; the morning of is the last chance.
        score: (req && !mine ? 55 : 100) + (bw.morning ? 5 : 0),
      });
    }
  }

  // 2. Your turn (oldest first) and 3. redos.
  for (const r of o.requests.filter((x) => x.assignedTo === me && !(x.kind === 'needs' && x.choreKey === BIG_BINS_KEY && bw))) {
    const age = t - r.createdAt;
    if (r.kind === 'redo') {
      out.push({ id: `redo-${r.id}`, kind: 'redo', title: `Redo: ${lower(r.choreName)}`, sub: `“${r.reason ?? 'Sent back'}” (${r.requestedByName})`, url: `/chore/${encodeURIComponent(r.choreKey)}?requestId=${r.id}`, action: '📸 Redo it', score: 90 + Math.min(5, age / (6 * HOUR)) });
    } else {
      out.push({ id: `turn-${r.id}`, kind: 'turn', title: `Your turn: ${lower(r.needs)}`, sub: `${r.requestedByName} asked ${ago(age)}`, url: `/chore/${encodeURIComponent(r.choreKey)}?requestId=${r.id}`, action: '📸 Do it', score: 92 + Math.min(6, age / (4 * HOUR)) });
    }
  }

  // 4. Money you owe (chore done and checked, not paid yet).
  for (const of of o.offers.filter((x) => x.fromUid === me && x.status === 'done' && x.checked)) {
    out.push({ id: `owe-${of.id}`, kind: 'owe', title: `Pay ${of.doerName ?? 'them'} ${formatPrice(of.agreedPrice ?? of.price)}`, sub: `for ${lower(of.choreName)}`, url: `/offer/${of.id}`, action: '💷 Pay', score: 85 });
  }
  // Chores you agreed to do for someone count as your turn.
  for (const of of o.offers.filter((x) => x.doerUid === me && x.status === 'agreed')) {
    out.push({ id: `deal-${of.id}`, kind: 'turn', title: `${of.choreName} for ${of.fromName}`, sub: `You get ${formatPrice(of.agreedPrice ?? of.price)} once it's checked`, url: `/offer/${of.id}`, action: '📸 Do it', score: 88 });
  }

  // 5. Photos to check: one line. More urgent the older they are (they auto-pass after 24h).
  const checks = o.logs.filter((l) => o.toCheck.includes(l.id));
  if (checks.length) {
    const oldest = Math.max(...checks.map((l) => t - l.at));
    const first = checks[0];
    out.push({
      id: 'check',
      kind: 'check',
      title: checks.length === 1 ? `${first.username}: ${lower(first.choreName)}` : `${checks.length} photos to check`,
      sub: checks.length === 1 ? 'Needs your check' : `${names(checks.map((l) => l.username))} · quick swipe through`,
      url: checks.length === 1 ? `/photo/${first.id}` : '/checks',
      action: checks.length === 1 ? 'Check it' : 'Check them',
      score: 65 + Math.min(15, oldest / (2 * HOUR)),
    });
  }

  // 6. Money on offer from housemates.
  const grabs = o.offers.filter((x) => x.status === 'open' && x.fromUid !== me && !x.counters[me]);
  if (grabs.length) {
    const best = [...grabs].sort((a, b) => b.price - a.price)[0];
    out.push({ id: `offer-${best.id}`, kind: 'offer', title: `${formatPrice(best.price)} to do ${lower(best.choreName)}`, sub: `from ${best.fromName}${grabs.length > 1 ? ` · ${grabs.length - 1} more on offer` : ''}`, url: `/offer/${best.id}`, action: '💰 See offer', score: 58 + Math.min(10, best.price / 100) });
  }

  // 7. Streak at risk: from Thursday, more urgent each day, loudest on Sunday.
  const dow = now.getDay(); // 0 Sun … 6 Sat
  if (o.streak.weeks >= 1 && !o.streak.doneThisWeek && (dow === 0 || dow >= 4)) {
    const sunday = dow === 0;
    out.push({
      id: 'streak',
      kind: 'streak',
      title: sunday ? `Last day for your ${o.streak.weeks}-week streak 🔥` : `Keep your ${o.streak.weeks}-week streak 🔥`,
      sub: sunday ? 'Do one chore today' : 'Do one chore by Sunday',
      url: '/home',
      score: sunday ? 80 : 40 + (dow - 4) * 8,
    });
  }

  // 8. Your fair share: matters more the further behind you are and the nearer the reset.
  const daysToReset = (o.periodEnd.getTime() - t) / DAY;
  if (o.toFair > 0) {
    out.push({
      id: 'fair',
      kind: 'fair',
      title: `You're ${o.toFair} point${o.toFair === 1 ? '' : 's'} off your fair share`,
      sub: o.suggestion ? `${o.suggestion} would help` : 'Any chore helps',
      url: '/home',
      score: 42 + Math.min(18, o.toFair * 4) + (daysToReset < 4 ? 15 : 0),
    });
  }

  // 9. The table: only when it's close, or in the last few days.
  const ranked = [...o.members].sort((a, b) => b.points - a.points);
  if (ranked.length > 1 && ranked[0].points > 0) {
    const mine = ranked.find((m) => m.uid === me)?.points ?? 0;
    // Ties share a place: 1 + how many have more points than you.
    const place = 1 + ranked.filter((m) => m.points > mine).length;
    const lead = ranked.find((m) => m.uid !== me && m.points === ranked[0].points) ?? ranked[0];
    const second = ranked.find((m) => m.uid !== me)?.points ?? 0;
    const gap = place === 1 ? mine - second : lead.points - mine;
    const close = gap <= 3;
    if (close || daysToReset < 4) {
      out.push({
        id: 'table',
        kind: 'table',
        title: place === 1 ? (gap === 0 ? `You're joint top 🏆` : `You're top by ${gap} 🏆`) : `You're ${ordinal(place)} · ${lead.username} leads by ${gap}`,
        sub: daysToReset < 4 ? `Table resets in ${Math.max(1, Math.ceil(daysToReset))} day${Math.ceil(daysToReset) === 1 ? '' : 's'}` : 'It’s close',
        url: '/leaderboard',
        score: 30 + (close ? 10 : 0) + (daysToReset < 4 ? 25 : 0),
      });
    }
  }

  // 10. House news: chores done today by others.
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todays = o.logs.filter((l) => l.at >= startOfDay && l.userId !== me && l.status !== 'rejected' && l.choreKey !== BIG_BINS_KEY);
  if (todays.length) {
    out.push({
      id: 'news',
      kind: 'news',
      title: todays.length === 1 ? `${todays[0].username} did ${lower(todays[0].choreName)} today` : `${todays.length} chores done today`,
      sub: todays.length === 1 ? undefined : names(todays.map((l) => l.username)),
      url: '/house',
      score: 22,
    });
  }

  // 11. Who's away.
  const away = o.members.filter((m) => m.away && m.uid !== me);
  if (away.length) {
    out.push({
      id: 'away',
      kind: 'away',
      title: away.length === 1 ? `${away[0].username}'s away${away[0].awayTill ? ` till ${away[0].awayTill}` : ''} ✈️` : `${names(away.map((m) => m.username))} are away ✈️`,
      sub: 'They’re not in the rota while they’re gone',
      url: '/house',
      score: 18,
    });
  }

  return out.sort((a, b) => b.score - a.score);
}

/** The headline when there's nothing that needs you. */
export function allClear(items: TodayItem[], now: Date): string | null {
  const urgent = items.some((i) => ['bins', 'turn', 'redo', 'owe', 'check', 'offer', 'streak', 'fair'].includes(i.kind));
  if (urgent) return null;
  return now.getHours() >= 17 ? 'All clear tonight ✅' : 'All clear today ✅';
}

function ago(ms: number): string {
  if (ms < HOUR) return 'just now';
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h ago`;
  return `${Math.floor(ms / DAY)}d ago`;
}

function names(list: string[]): string {
  const u = [...new Set(list)];
  return u.length <= 2 ? u.join(' and ') : `${u.slice(0, 2).join(', ')} and ${u.length - 2} more`;
}

function ordinal(n: number): string {
  const s = n % 100;
  if (s >= 11 && s <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}
