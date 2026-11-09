import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { NotificationCard } from '../../components/NotificationCard';
import { Avatar } from '../../components/Avatar';
import { choreIcon } from '../../lib/chores';
import { formatPrice } from '../../lib/money';
import { periodLabel } from '../../lib/period';
import { standing } from '../../lib/standing';
import { Icon, Label, Loading, Logo, RowButton, Screen, timeAgo } from '../../components/ui';
import { haptics } from '../../lib/haptics';
import { colors, fonts, type } from '../../components/theme';

type IconName = React.ComponentProps<typeof Icon>['name'];

export default function Home() {
  const { user, profile, house, members, openRequests, offers, wallpaper } = useApp();
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
        <View style={styles.scoreRow}>
          <Text style={styles.score}>{total}</Text>
          <Text style={styles.scoreText}>
            {total === 1 ? 'chore' : 'chores'}
            {s.place ? <Text style={styles.place}>{` · ${s.place}`}</Text> : ' this period'}
          </Text>
        </View>
        {s.progress !== null && (
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${Math.round(s.progress * 100)}%` }]} />
          </View>
        )}
        <Text style={type.small}>{s.hint}</Text>
      </View>

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
                    : `${r.requestedByName} flagged this · ${timeAgo(r.createdAt)}`
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
      {chores.length > 0 ? (
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
        </View>
      ) : (
        <Text style={type.small}>No chores switched on. The house admin can add some in Settings.</Text>
      )}
    </Screen>
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
  bar: { height: 3, backgroundColor: colors.line, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.text, borderRadius: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  tile: {
    width: '49%', minHeight: 108, borderRadius: 16, padding: 14, justifyContent: 'space-between',
    backgroundColor: colors.card, gap: 8,
  },
  tileText: { fontSize: 15, fontWeight: '600', color: colors.text, letterSpacing: -0.2 },
  tileSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
