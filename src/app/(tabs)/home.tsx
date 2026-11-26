import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ChoreIcon } from '../../components/ChoreIcon';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../../context/AppContext';
import { NotificationCard } from '../../components/NotificationCard';
import { GettingStarted } from '../../components/GettingStarted';
import { BinBanner } from '../../components/BinBanner';
import { TodayCard } from '../../components/TodayCard';
import { setIntroTarget } from '../../components/IntroSplash';
import { todayItems } from '../../lib/today';
import { effectiveStatus, needsCheckBy } from '../../lib/review';
import { choreSize } from '../../lib/chores';
import { VerifyEmailBanner } from '../../components/VerifyEmailBanner';
import { Avatar } from '../../components/Avatar';

import { periodEnd, periodStart, previousPeriodKey } from '../../lib/period';
import { lastResult } from '../../lib/stakes';
import { needsStakeVote } from '../../components/StakesCard';
import { pointsToFairShare, standing } from '../../lib/standing';
import { awayDaysBetween, awayLabel, currentOrNextAway, endAway, tillLabel } from '../../lib/away';
import { setAways } from '../../lib/db';
import { currentStreak, daysLeftThisWeek, doneThisWeek, seedStreak } from '../../lib/streak';
import { Button, confirm, Icon, Label, Loading, Logo, notify, RowButton, Screen } from '../../components/ui';
import { Tip } from '../../components/Tip';
import { haptics } from '../../lib/haptics';
import { track } from '../../lib/analytics';
import { colors, fonts, isLight, shade, soft, streakColor, tint, type } from '../../components/theme';
import { Tap } from '../../components/Tap';
import { SkeletonCard } from '../../components/Skeleton';


/** Show last period's Wrapped once, in the first 2 weeks of a new period. */
function useWrappedOnce(houseId: string | undefined, prevKey: string, show: boolean) {
  useEffect(() => {
    if (!houseId || !show) return;
    const k = `rotawise.wrapped.${houseId}.${prevKey}`;
    let live = true;
    AsyncStorage.getItem(k).then((v) => {
      if (!live || v) return;
      AsyncStorage.setItem(k, 'seen').catch(() => {});
      track('wrapped_open');
      router.push({ pathname: '/wrapped', params: { p: 'last' } });
    }).catch(() => {});
    return () => { live = false; };
  }, [houseId, prevKey, show]);
}

export default function Home() {
  const { user, profile, house, members, openRequests, offers, logs, wallpaper, isAdmin, stakes, membersIn, houseLoaded } = useApp();
  const [peek, setPeek] = useState(false);
  const logoRef = useRef<React.ComponentRef<typeof View>>(null);
  const today = new Date();
  const prevKey = house ? previousPeriodKey(today, house.reset) : '';
  const freshPeriod = !!house && today.getTime() - periodStart(today, house.reset).getTime() < 14 * 24 * 3_600_000;
  const prevHadChores = freshPeriod && membersIn(prevKey).some((m) => (m.points ?? m.totalCompleted) > 0);
  useWrappedOnce(house?.id, prevKey, prevHadChores);
  if (!user || !house) return <Loading />;

  const others = openRequests.filter((r) => r.assignedTo !== user.uid);
  const chores = house.chores.filter((c) => c.active);
  // Bathrooms show as one tile each (tap to pick toilet / shower / sink / whole).
  const tiles: { key: string; name: string; group?: string; sub?: string }[] = [];
  for (const c of chores) {
    if (!c.group) tiles.push({ key: c.key, name: c.name });
    else if (!tiles.some((t) => t.group === c.group)) {
      const users = c.users ?? [];
      tiles.push({
        key: `group:${c.group}`, name: c.group, group: c.group,
        sub: users.length === 0 ? 'Everyone' : users.includes(user.uid) ? 'Yours' : 'Not one you use',
      });
    }
  }
  const me = members.find((m) => m.uid === user.uid);
  const s = standing(members, user.uid);
  const myTrip = currentOrNextAway(me?.aways, new Date().getTime());
  const awayNow = !!me?.away;
  async function toggleAway() {
    haptics.tap();
    if (!awayNow) return router.push('/away-quick');
    if (!myTrip || !(await confirm('Back already?', 'You’ll be in the rota again straight away.', 'I’m back'))) return;
    try {
      await setAways(house!.id, user!.uid, endAway(me?.aways, myTrip, new Date().getTime()));
      haptics.success();
      setPeek(false);
    } catch (e) {
      notify('Could not save', (e as Error).message);
    }
  }
  const nowMs = new Date().getTime();
  // "Your house, today": what matters most to you right now.
  const checkedLog = (id: string | null) => {
    const l = logs.find((x) => x.id === id);
    const st = l ? effectiveStatus(l) : null;
    return st === 'verified' || st === 'auto_verified';
  };
  const quickest = [...house.chores].filter((c) => c.active && !c.group).sort((a, b) => choreSize(a) - choreSize(b))[0];
  const total0 = members.reduce((n, m) => n + (m.points ?? m.totalCompleted), 0);
  const myStreak = seedStreak(me?.streak, me?.lastCompletedAt);
  const streakWeeks = currentStreak(myStreak, nowMs, (a, b) => awayDaysBetween(me?.aways, a, b));
  const streakDone = doneThisWeek(myStreak, nowMs);
  const needsVote = needsStakeVote(user.uid, house, stakes);
  const openChore = (key: string, requestId?: string) =>
    router.push({ pathname: '/chore/[key]', params: requestId ? { key, requestId } : { key } });
  const total = me?.totalCompleted ?? 0;
  const now = new Date();
  const todayList = todayItems({
    now,
    me: user.uid,
    bins: house.bins,
    members: members.map((m) => ({ uid: m.uid, username: m.username, points: m.points ?? m.totalCompleted, away: !!m.away, awayTill: m.away ? tillLabel(m.aways, nowMs) : undefined })),
    // Chores you've offered money for live in Pay, not here.
    requests: openRequests.filter((r) => !offers.some((o) => o.id === r.id)),
    logs,
    toCheck: logs.filter((l) => needsCheckBy(l, user.uid)).map((l) => l.id),
    offers: offers.map((o) => ({ ...o, checked: checkedLog(o.logId) })),
    streak: { weeks: streakWeeks, doneThisWeek: streakDone },
    toFair: s.active ? pointsToFairShare(me?.points ?? total, total0, s.fairPct / 100) : 0,
    suggestion: quickest?.name ?? null,
    periodEnd: periodEnd(now, house.reset),
  });
  // First week of a new period: show how last period's house stakes ended.
  const prev = previousPeriodKey(now, house.reset);
  const stakesNews = house.stakes && now.getTime() - periodStart(now, house.reset).getTime() < 7 * 24 * 3_600_000
    ? lastResult(stakes, prev, membersIn(prev).map((m) => ({ username: m.username, points: m.points ?? m.totalCompleted })))
    : null;

  return (
    <Screen background={wallpaper}>
      <View style={styles.top}>
        {/* The intro's flying logo lands exactly here. */}
        <View ref={logoRef} onLayout={() => logoRef.current?.measureInWindow((x, y, w) => w && setIntroTarget({ x, y, size: w }))}>
          <Logo size={26} />
        </View>
        <Text style={styles.house} numberOfLines={1}>{house.name}</Text>
        <Tap
          accessibilityRole="switch"
          accessibilityLabel="Away"
          accessibilityState={{ checked: awayNow }}
          onPress={toggleAway}
          style={[styles.awayPill, awayNow && { backgroundColor: colors.you, borderColor: colors.you }]}
        >
          <Icon name="airplane" size={13} color={awayNow ? colors.inverse : colors.text} />
          <Text style={[styles.awayText, awayNow && { color: colors.inverse }]}>{awayNow ? 'Away' : 'Away?'}</Text>
        </Tap>
        <Tap
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={10}
          onPress={() => { haptics.tap(); router.push('/settings'); }}
          style={[styles.cog]}
        >
          <Icon name="settings-outline" size={22} color={colors.text} />
        </Tap>
      </View>

      {awayNow && myTrip && !peek ? (
        <View style={styles.awayCard}>
          <Text style={{ fontSize: 56 }}>✈️</Text>
          <Text style={styles.awayTitle}>You&apos;re away</Text>
          <Text style={styles.awayBack}>Back {awayLabel(myTrip)}</Text>
          <Text style={[type.small, { textAlign: 'center' }]}>
            Enjoy it. You won&apos;t be asked to do any chores, and your fair share is paused while you&apos;re gone.
          </Text>
          <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 8 }}>
            <Button title="I'm back" onPress={toggleAway} />
            <Button title="Change dates" variant="secondary" onPress={() => router.push('/settings/away')} />
            <Button title="Look at the house anyway" variant="ghost" onPress={() => setPeek(true)} />
          </View>
        </View>
      ) : (
      <>

      <LinearGradient
        colors={[isLight ? tint(colors.you, 0.82) : shade(colors.you, 0.6), colors.card]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.55, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.helloRow}>
          <Avatar avatar={me?.avatar} name={profile?.username ?? '?'} size={34} />
          <Text style={styles.hello} numberOfLines={1}>Hey {profile?.username ?? ''}</Text>
        </View>
        {s.active ? (
          <>
            <View style={styles.scoreRow}>
              <Text style={styles.score}>{s.sharePct}%</Text>
              <Text style={styles.scoreText}>of the house&apos;s chores</Text>
            </View>
            <FairBar share={s.sharePct} fair={s.fairPct} />
            <Text style={styles.fairLine}>
              Fair share: {s.fairPct}% · you: {me?.points ?? total} point{(me?.points ?? total) === 1 ? '' : 's'} from {total} chore{total === 1 ? '' : 's'}
            </Text>
          </>
        ) : (
          <Text style={styles.scoreText}>{s.headline}</Text>
        )}
        <Text style={type.small}>{s.hint}</Text>
        {members.length > 1 && <StreakRow weeks={streakWeeks} done={streakDone} />}
      </LinearGradient>

      {stakesNews && (
        <RowButton icon="trophy-outline" title="Last period's stakes" subtitle={stakesNews} onPress={() => router.push('/leaderboard')} />
      )}
      {needsVote && (
        <RowButton icon="trophy-outline" highlight title="Vote on this period's stakes" subtitle="Pick the prize for the top and the forfeit for the bottom" onPress={() => router.push('/stakes')} />
      )}
      {myTrip && (
        <RowButton
          icon="airplane-outline"
          highlight={myTrip.from <= new Date().getTime()}
          title={myTrip.from <= new Date().getTime() ? `You're away till ${awayLabel(myTrip)}` : `Going away ${awayLabel({ from: myTrip.from, until: myTrip.from + 1 })}`}
          subtitle={myTrip.from <= new Date().getTime() ? 'You won’t be asked to do chores. Back early? Tap here' : `Back after ${awayLabel(myTrip)} · you won’t be asked while you’re gone`}
          onPress={() => router.push('/settings/away')}
        />
      )}
      <VerifyEmailBanner />
      {houseLoaded ? <TodayCard items={todayList} now={now} /> : <SkeletonCard />}
      <BinBanner bins={house.bins} now={now} isAdmin={isAdmin} />
      <GettingStarted />
      <NotificationCard />

      <Label>Chores</Label>
      <Tip id="home">Tap a chore to log it with a photo, or to say it needs doing. Whoever is furthest below their fair share gets asked.</Tip>
      {tiles.length > 0 || isAdmin ? (
        <View style={styles.grid}>
          {tiles.map((t) => {
            const waiting = t.group
              ? others.find((r) => chores.some((c) => c.group === t.group && c.key === r.choreKey))
              : others.find((r) => r.choreKey === t.key);
            return (
              <Tap
                key={t.key}
                accessibilityRole="button"
                accessibilityLabel={t.name}
                onPress={() => {
                  haptics.tap();
                  if (t.group) router.push({ pathname: '/area/[group]', params: { group: t.group } });
                  else openChore(t.key);
                }}
                style={({ pressed }) => [styles.tile, pressed && { backgroundColor: colors.cardRaised, transform: [{ scale: 0.98 }] }]}
              >
                <ChoreIcon choreKey={t.group ? 'bathroom' : t.key} />
                <View>
                  <Text style={styles.tileText} numberOfLines={2}>{t.name}</Text>
                  {waiting ? (
                    <Text style={styles.tileSub} numberOfLines={1}>
                      {waiting.kind === 'redo' ? 'Being redone by' : 'Waiting on'} {waiting.assignedToName}
                    </Text>
                  ) : t.group && (
                    <Text style={styles.tileSub} numberOfLines={1}>{t.sub}</Text>
                  )}
                </View>
              </Tap>
            );
          })}
          {isAdmin && !tiles.some((t) => t.group) && (
            <Tap
              accessibilityRole="button"
              accessibilityLabel="Add a bathroom"
              onPress={() => { haptics.tap(); router.push('/settings/bathrooms'); }}
              style={({ pressed }) => [styles.tile, styles.addTile, pressed && { backgroundColor: colors.card }]}
            >
              <Icon name="water-outline" size={24} color={colors.muted} />
              <Text style={[styles.tileText, { color: colors.muted }]}>Add bathrooms</Text>
            </Tap>
          )}
          {isAdmin && (
            <Tap
              accessibilityRole="button"
              accessibilityLabel="Add a chore"
              onPress={() => {
                haptics.tap();
                router.push('/add-chore');
              }}
              style={({ pressed }) => [styles.tile, styles.addTile, pressed && { backgroundColor: colors.card }]}
            >
              <Icon name="add" size={24} color={colors.muted} />
              <Text style={[styles.tileText, { color: colors.muted }]}>Add a chore</Text>
            </Tap>
          )}
        </View>
      ) : (
        <Text style={type.small}>No chores switched on. The house admin can add some in Settings.</Text>
      )}
      </>
      )}
    </Screen>
  );
}

/** 🔥 N-week streak, with dots for recent weeks (the last one is this week). */
function StreakRow({ weeks, done }: { weeks: number; done: boolean }) {
  const left = daysLeftThisWeek(new Date().getTime());
  const title = weeks > 0 ? `${weeks}-week streak` : 'Start a streak';
  const sub = done
    ? 'This week’s done ✓ See you next week'
    : weeks > 0
      ? `One chore in the next ${left} day${left === 1 ? '' : 's'} keeps it going`
      : 'Log a chore every week to build one';
  const past = Math.min(4, done ? weeks - 1 : weeks);
  return (
    <View style={[styles.streak, { backgroundColor: soft(streakColor) }]} accessibilityLabel={`${title}. ${sub}`}>
      <Text style={{ fontSize: 22 }}>🔥</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.streakTitle, { color: streakColor }]}>{title}</Text>
        <Text style={styles.streakSub}>{sub}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {Array.from({ length: past }, (_, i) => <View key={i} style={[styles.sDot, { backgroundColor: streakColor }]} />)}
        <View style={[styles.sDot, { borderWidth: 1.5, borderColor: streakColor }, done && { backgroundColor: streakColor }]} />
      </View>
    </View>
  );
}

/** Your share, with a tick mark where a fair share is. Scaled so small shares are still visible. */
function FairBar({ share, fair }: { share: number; fair: number }) {
  const max = Math.min(100, Math.max(fair * 2, share + 10));
  return (
    <View style={styles.fairWrap} accessibilityLabel={`Your share ${share}%, fair share ${fair}%`}>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${(share / max) * 100}%`, backgroundColor: colors.you }]} />
      </View>
      <View style={[styles.fairMark, { left: `${(fair / max) * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  cog: { width: 34, height: 34, borderRadius: 17, borderCurve: 'continuous' as const, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  house: { flex: 1, fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.2, color: colors.text, textTransform: 'uppercase' },
  period: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.2, color: colors.muted, textTransform: 'uppercase' },
  hero: { backgroundColor: colors.card, borderRadius: 20, borderCurve: 'continuous' as const, padding: 18, gap: 10 },
  helloRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hello: { fontSize: 18, fontWeight: '600', color: colors.text, flex: 1 },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  score: { fontSize: 56, fontWeight: '700', color: colors.text, letterSpacing: -2, lineHeight: 62 },
  scoreText: { fontSize: 16, color: colors.muted },
  place: { color: colors.text, fontWeight: '600' },
  bar: { height: 6, backgroundColor: colors.line, borderRadius: 3, borderCurve: 'continuous' as const, overflow: 'hidden' },
  fairWrap: { justifyContent: 'center', marginVertical: 4 },
  fairMark: { position: 'absolute', width: 2, height: 14, marginLeft: -1, backgroundColor: colors.text, borderRadius: 1, borderCurve: 'continuous' },
  fairLine: { fontSize: 12, color: colors.muted },
  awayPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.line, borderRadius: 999, borderCurve: 'continuous' as const, paddingVertical: 5, paddingHorizontal: 10 },
  awayText: { fontSize: 12, fontWeight: '600', color: colors.text },
  awayCard: { backgroundColor: colors.card, borderRadius: 22, borderCurve: 'continuous' as const, padding: 24, alignItems: 'center', gap: 6, marginTop: 8 },
  awayTitle: { fontSize: 30, fontWeight: '700', letterSpacing: -1, color: colors.text },
  awayBack: { fontSize: 17, color: colors.you, fontWeight: '600', marginBottom: 4 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderCurve: 'continuous' as const, paddingVertical: 10, paddingHorizontal: 12, marginTop: 4 },
  streakTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  streakSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  sDot: { width: 8, height: 8, borderRadius: 4, borderCurve: 'continuous' },
  barFill: { height: '100%', backgroundColor: colors.text, borderRadius: 2, borderCurve: 'continuous' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  tile: {
    width: '49%', minHeight: 108, borderRadius: 16, borderCurve: 'continuous' as const, padding: 14, justifyContent: 'space-between',
    backgroundColor: colors.card, gap: 8,
  },
  tileText: { fontSize: 15, fontWeight: '600', color: colors.text, letterSpacing: -0.2 },
  tileSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  addTile: { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line },
});
