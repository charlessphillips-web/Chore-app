import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { NotificationCard } from '../../components/NotificationCard';
import { GettingStarted } from '../../components/GettingStarted';
import { BinBanner } from '../../components/BinBanner';
import { VerifyEmailBanner } from '../../components/VerifyEmailBanner';
import { Avatar } from '../../components/Avatar';
import { choreIcon } from '../../lib/chores';
import { formatPrice } from '../../lib/money';
import { periodLabel, periodStart, previousPeriodKey } from '../../lib/period';
import { lastResult } from '../../lib/stakes';
import { standing } from '../../lib/standing';
import { Icon, Label, Loading, Logo, RowButton, Screen, timeAgo } from '../../components/ui';
import { Tip } from '../../components/Tip';
import { haptics } from '../../lib/haptics';
import { colors, fonts, type } from '../../components/theme';

type IconName = React.ComponentProps<typeof Icon>['name'];

export default function Home() {
  const { user, profile, house, members, openRequests, offers, wallpaper, isAdmin, stakes, membersIn } = useApp();
  if (!user || !house) return <Loading />;

  const mine = openRequests.filter((r) => r.assignedTo === user.uid);
  const others = openRequests.filter((r) => r.assignedTo !== user.uid);
  const chores = house.chores.filter((c) => c.active);
  const me = members.find((m) => m.uid === user.uid);
  const s = standing(members, user.uid);
  const openChore = (key: string, requestId?: string) =>
    router.push({ pathname: '/chore/[key]', params: requestId ? { key, requestId } : { key } });
  const openOffer = (id: string) => router.push({ pathname: '/offer/[id]', params: { id } });
  // Chores you agreed to do for someone (the rest is in the Pay tab).
  const toDo = offers.filter((o) => o.status === 'agreed' && o.doerUid === user.uid);
  const total = me?.totalCompleted ?? 0;
  const now = new Date();
  // First week of a new period: show how last period's house stakes ended.
  const prev = previousPeriodKey(now, house.reset);
  const stakesNews = house.stakes && now.getTime() - periodStart(now, house.reset).getTime() < 7 * 24 * 3_600_000
    ? lastResult(stakes, prev, membersIn(prev).map((m) => ({ username: m.username, points: m.points ?? m.totalCompleted })))
    : null;

  return (
    <Screen background={wallpaper}>
      <View style={styles.top}>
        <Logo size={26} />
        <Text style={styles.house} numberOfLines={1}>{house.name}</Text>
        <Text style={styles.period}>{periodLabel(new Date(), house.reset)}</Text>
      </View>

      <View style={styles.hero}>
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
      </View>

      {stakesNews && (
        <RowButton icon="trophy-outline" title="Last period's stakes" subtitle={stakesNews} onPress={() => router.push('/leaderboard')} />
      )}
      <VerifyEmailBanner />
      <BinBanner bins={house.bins} now={now} isAdmin={isAdmin} />
      <GettingStarted />
      <NotificationCard />

      {mine.length + toDo.length > 0 && (
        <>
          <Label>Needs doing now</Label>
          {mine.map((r) => {
            const o = offers.find((x) => x.id === r.id);
            if (o) {
              const counters = Object.keys(o.counters).filter((u) => !o.declined.includes(u)).length;
              return (
                <RowButton
                  key={r.id}
                  icon="cash-outline"
                  title={r.needs}
                  highlight={counters > 0}
                  subtitle={
                    o.status === 'open'
                      ? `You offered ${formatPrice(o.price)} · ${counters ? `${counters} counter offer${counters > 1 ? 's' : ''}` : 'waiting for a taker'}`
                      : `${o.doerName} is doing it for ${formatPrice(o.agreedPrice ?? o.price)}`
                  }
                  onPress={() => openOffer(o.id)}
                />
              );
            }
            return (
              <RowButton
                key={r.id}
                icon={r.kind === 'redo' ? 'arrow-undo' : 'alert-circle-outline'}
                title={r.needs}
                highlight
                subtitle={
                  r.kind === 'redo'
                    ? `${r.requestedByName} sent it back: ${r.reason ?? ''}`
                    : `Someone flagged this · ${timeAgo(r.createdAt)} · it's your turn`
                }
                onPress={() => openChore(r.choreKey, r.id)}
              />
            );
          })}
          {toDo.map((o) => (
            <RowButton
              key={o.id}
              icon="cash-outline"
              highlight
              title={`${o.choreName} for ${o.fromName}`}
              subtitle={`You agreed to do it for ${formatPrice(o.agreedPrice ?? o.price)}`}
              onPress={() => openChore(o.choreKey, o.requestId)}
            />
          ))}
        </>
      )}

      <Label>Chores</Label>
      <Tip id="home">Tap a chore to log it with a photo, or to say it needs doing. Whoever is furthest below their fair share gets asked.</Tip>
      {chores.length > 0 || isAdmin ? (
        <View style={styles.grid}>
          {chores.map((c) => {
            const waiting = others.find((r) => r.choreKey === c.key);
            return (
              <Pressable
                key={c.key}
                accessibilityRole="button"
                accessibilityLabel={c.name}
                onPress={() => {
                  haptics.tap();
                  openChore(c.key);
                }}
                style={({ pressed }) => [styles.tile, pressed && { backgroundColor: colors.cardRaised, transform: [{ scale: 0.98 }] }]}
              >
                <Icon name={choreIcon(c.key) as IconName} size={22} color={colors.text} />
                <View>
                  <Text style={styles.tileText} numberOfLines={2}>{c.name}</Text>
                  {waiting && (
                    <Text style={styles.tileSub} numberOfLines={1}>
                      {waiting.kind === 'redo' ? 'Being redone by' : 'Waiting on'} {waiting.assignedToName}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}
          {isAdmin && (
            <Pressable
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
            </Pressable>
          )}
        </View>
      ) : (
        <Text style={type.small}>No chores switched on. The house admin can add some in Settings.</Text>
      )}
    </Screen>
  );
}

/** Your share, with a tick mark where a fair share is. Scaled so small shares are still visible. */
function FairBar({ share, fair }: { share: number; fair: number }) {
  const max = Math.min(100, Math.max(fair * 2, share + 10));
  return (
    <View style={styles.fairWrap} accessibilityLabel={`Your share ${share}%, fair share ${fair}%`}>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${(share / max) * 100}%`, backgroundColor: share >= fair ? colors.text : colors.muted }]} />
      </View>
      <View style={[styles.fairMark, { left: `${(fair / max) * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  house: { flex: 1, fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.2, color: colors.text, textTransform: 'uppercase' },
  period: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.2, color: colors.muted, textTransform: 'uppercase' },
  hero: { backgroundColor: colors.card, borderRadius: 20, padding: 18, gap: 10 },
  helloRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hello: { fontSize: 18, fontWeight: '600', color: colors.text, flex: 1 },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  score: { fontSize: 56, fontWeight: '700', color: colors.text, letterSpacing: -2, lineHeight: 62 },
  scoreText: { fontSize: 16, color: colors.muted },
  place: { color: colors.text, fontWeight: '600' },
  bar: { height: 6, backgroundColor: colors.line, borderRadius: 3, overflow: 'hidden' },
  fairWrap: { justifyContent: 'center', marginVertical: 4 },
  fairMark: { position: 'absolute', width: 2, height: 14, marginLeft: -1, backgroundColor: colors.you, borderRadius: 1 },
  fairLine: { fontSize: 12, color: colors.muted },
  barFill: { height: '100%', backgroundColor: colors.text, borderRadius: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  tile: {
    width: '49%', minHeight: 108, borderRadius: 16, padding: 14, justifyContent: 'space-between',
    backgroundColor: colors.card, gap: 8,
  },
  tileText: { fontSize: 15, fontWeight: '600', color: colors.text, letterSpacing: -0.2 },
  tileSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  addTile: { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line },
});
