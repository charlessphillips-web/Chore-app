import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { NotificationCard } from '../../components/NotificationCard';
import { choreIcon } from '../../lib/chores';
import { formatPrice } from '../../lib/money';
import { effectiveStatus } from '../../lib/review';
import { periodLabel } from '../../lib/period';
import { standing } from '../../lib/standing';
import { Card, Icon, Label, Loading, Logo, RowButton, Screen, timeAgo } from '../../components/ui';
import { colors, radius, space, type } from '../../components/theme';

type IconName = React.ComponentProps<typeof Icon>['name'];
const LILAC = '#D9CCF5';

export default function Home() {
  const { user, profile, house, members, openRequests, offers, logs, wallpaper } = useApp();
  if (!user || !house) return <Loading />;

  const mine = openRequests.filter((r) => r.assignedTo === user.uid);
  const others = openRequests.filter((r) => r.assignedTo !== user.uid);
  const chores = house.chores.filter((c) => c.active);
  const me = standing(members, user.uid);
  const openChore = (key: string, requestId?: string) =>
    router.push({ pathname: '/chore/[key]', params: requestId ? { key, requestId } : { key } });
  const openOffer = (id: string) => router.push({ pathname: '/offer/[id]', params: { id } });
  const offerFor = (requestId: string) => offers.find((o) => o.id === requestId);

  // Offers: ones you agreed to do, ones you need to pay for, and ones up for grabs.
  const toDo = offers.filter((o) => o.status === 'agreed' && o.doerUid === user.uid);
  const toPay = offers.filter((o) => o.status === 'done' && o.fromUid === user.uid);
  const upForGrabs = offers.filter((o) => o.status === 'open' && o.fromUid !== user.uid);
  const logState = (logId: string | null) => {
    const l = logs.find((x) => x.id === logId);
    return l ? effectiveStatus(l) : null;
  };
  const checked = (logId: string | null) => ['verified', 'auto_verified'].includes(logState(logId) ?? '');
  const needsDoing = mine.length + toDo.length + toPay.length > 0;

  return (
    <Screen background={wallpaper}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Logo size={32} />
          <Text style={styles.houseName} numberOfLines={2}>{house.name}</Text>
          <Text style={styles.period}>{periodLabel(new Date(), house.reset)}</Text>
        </View>
        <Text style={styles.hello} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          Hey {profile?.username ?? ''}
        </Text>
        <Text style={styles.headline}>{me.headline}</Text>
        {me.progress !== null && (
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${Math.round(me.progress * 100)}%` }]} />
          </View>
        )}
        <Text style={styles.hint}>{me.hint}</Text>
      </View>

      <NotificationCard />

      {needsDoing && (
        <>
          <Label>Needs doing now</Label>
          {mine.map((r) => {
            const o = offerFor(r.id);
            if (o) {
              const counters = Object.keys(o.counters).filter((u) => !o.declined.includes(u)).length;
              return (
                <RowButton
                  key={r.id}
                  icon="cash-outline"
                  title={r.needs}
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
                icon={r.kind === 'redo' ? 'arrow-undo' : 'alert-circle'}
                title={r.needs}
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
              title={`${o.choreName} for ${o.fromName}`}
              subtitle={`You agreed to do it for ${formatPrice(o.agreedPrice ?? o.price)}`}
              onPress={() => openChore(o.choreKey, o.requestId)}
            />
          ))}
          {toPay.map((o) => (
            <RowButton
              key={o.id}
              icon="card-outline"
              title={checked(o.logId) ? `Pay ${o.doerName} ${formatPrice(o.agreedPrice ?? o.price)}` : `${o.doerName} did ${o.choreName} for you`}
              subtitle={
                checked(o.logId)
                  ? `for ${o.choreName} · you get the point once paid`
                  : logState(o.logId) === 'rejected'
                    ? `Sent back · ${o.doerName} is redoing it`
                    : 'Waiting for the photo to be checked'
              }
              onPress={() => openOffer(o.id)}
            />
          ))}
        </>
      )}

      {upForGrabs.length > 0 && (
        <>
          <Label>Up for grabs</Label>
          {upForGrabs.map((o) => {
            const c = o.counters[user.uid];
            return (
              <RowButton
                key={o.id}
                icon="cash-outline"
                title={`${o.choreName} · ${formatPrice(o.price)}`}
                subtitle={
                  c
                    ? o.declined.includes(user.uid)
                      ? `${o.fromName} declined your ${formatPrice(c.price)}`
                      : `You offered ${formatPrice(c.price)} · waiting for ${o.fromName}`
                    : `${o.fromName} will pay · tap to accept or counter`
                }
                onPress={() => openOffer(o.id)}
              />
            );
          })}
        </>
      )}

      <Label>Chores</Label>
      <View style={styles.grid}>
        {chores.map((c) => {
          const waiting = others.find((r) => r.choreKey === c.key);
          return (
            <Pressable
              key={c.key}
              accessibilityRole="button"
              accessibilityLabel={c.name}
              onPress={() => openChore(c.key)}
              style={({ pressed }) => [styles.tile, pressed && { backgroundColor: colors.cardRaised }]}
            >
              <View style={styles.tileTop}>
                <Icon name={choreIcon(c.key) as IconName} size={24} color={colors.primaryBright} />
                <Icon name="chevron-forward" size={16} color={colors.muted} />
              </View>
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
      {chores.length === 0 && (
        <Card>
          <Text style={type.small}>No chores switched on. The house admin can add some in Settings.</Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.primary, borderRadius: 16, padding: 20, gap: 4 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  houseName: { flex: 1, color: LILAC, fontSize: 14, fontWeight: '600' },
  period: { color: LILAC, fontSize: 12 },
  hello: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  headline: { fontSize: 16, color: LILAC },
  bar: { height: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, marginVertical: space.sm, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.text, borderRadius: 4 },
  hint: { fontSize: 13, color: LILAC },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 7 },
  tile: {
    width: '49%', minHeight: 116, borderWidth: 1, borderColor: colors.outline, borderRadius: radius,
    padding: space.md, justifyContent: 'space-between', backgroundColor: colors.card, gap: space.sm,
  },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between' },
  tileText: { fontSize: 15, fontWeight: '600', color: colors.text, letterSpacing: -0.2 },
  tileSub: { ...type.small, fontSize: 12, marginTop: 2 },
});
