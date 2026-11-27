/**
 * "Your house, today" with everything it needs worked out from the app's
 * data, so it can sit on any screen (it lives at the top of the House tab).
 */
import { useApp } from '../context/AppContext';
import { todayItems } from '../lib/today';
import { effectiveStatus, needsCheckBy } from '../lib/review';
import { choreSize } from '../lib/chores';
import { periodEnd } from '../lib/period';
import { pointsToFairShare, standing } from '../lib/standing';
import { awayDaysBetween, tillLabel } from '../lib/away';
import { currentStreak, doneThisWeek, seedStreak } from '../lib/streak';
import { TodayCard } from './TodayCard';
import { SkeletonCard } from './Skeleton';

export function YourHouseToday() {
  const { user, house, members, openRequests, offers, logs, houseLoaded } = useApp();
  if (!user || !house) return null;
  if (!houseLoaded) return <SkeletonCard />;

  const now = new Date();
  const nowMs = now.getTime();
  const me = members.find((m) => m.uid === user.uid);
  const s = standing(members, user.uid);
  const checkedLog = (id: string | null) => {
    const l = logs.find((x) => x.id === id);
    const st = l ? effectiveStatus(l) : null;
    return st === 'verified' || st === 'auto_verified';
  };
  const quickest = [...house.chores].filter((c) => c.active && !c.group).sort((a, b) => choreSize(a) - choreSize(b))[0];
  const houseTotal = members.reduce((n, m) => n + (m.points ?? m.totalCompleted), 0);
  const myStreak = seedStreak(me?.streak, me?.lastCompletedAt);

  const items = todayItems({
    now,
    me: user.uid,
    bins: house.bins,
    members: members.map((m) => ({ uid: m.uid, username: m.username, points: m.points ?? m.totalCompleted, away: !!m.away, awayTill: m.away ? tillLabel(m.aways, nowMs) : undefined })),
    // Chores you've offered money for live in Pay, not here.
    requests: openRequests.filter((r) => !offers.some((o) => o.id === r.id)),
    logs,
    toCheck: logs.filter((l) => needsCheckBy(l, user.uid)).map((l) => l.id),
    offers: offers.map((o) => ({ ...o, checked: checkedLog(o.logId) })),
    streak: {
      weeks: currentStreak(myStreak, nowMs, (a, b) => awayDaysBetween(me?.aways, a, b)),
      doneThisWeek: doneThisWeek(myStreak, nowMs),
    },
    toFair: s.active ? pointsToFairShare(me?.points ?? me?.totalCompleted ?? 0, houseTotal, s.fairPct / 100) : 0,
    suggestion: quickest?.name ?? null,
    periodEnd: periodEnd(now, house.reset),
  });
  return <TodayCard items={items} now={now} />;
}
