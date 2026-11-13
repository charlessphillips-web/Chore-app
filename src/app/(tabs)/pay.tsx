import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { watchPaidOffers } from '../../lib/db';
import { formatPrice, PAY_LABELS, wallet } from '../../lib/money';
import { periodStart } from '../../lib/period';
import { effectiveStatus } from '../../lib/review';
import { choreIcon } from '../../lib/chores';
import { haptics } from '../../lib/haptics';
import type { ChoreOffer } from '../../lib/types';
import { Avatar } from '../../components/Avatar';
import { Icon, Label, Loading, Screen, timeAgo, Title } from '../../components/ui';
import { colors, fonts } from '../../components/theme';

type IconName = React.ComponentProps<typeof Icon>['name'];

/**
 * Paying housemates to do chores. A wallet (earned / spent this period) up
 * top, then anything that needs you, then offers "up for grabs" as bounty
 * cards with the price big.
 */
export default function Pay() {
  const { user, house, members, openRequests, offers, logs } = useApp();
  const [paid, setPaid] = useState<ChoreOffer[]>([]);
  const houseId = house?.id;
  useEffect(() => (houseId ? watchPaidOffers(houseId, setPaid, () => {}) : undefined), [houseId]);
  if (!user || !house) return <Loading />;

  const uid = user.uid;
  const open = (id: string) => { haptics.tap(); router.push({ pathname: '/offer/[id]', params: { id } }); };
  const avatarOf = (id: string | null) => members.find((m) => m.uid === id)?.avatar;
  const checked = (o: ChoreOffer) => {
    const l = logs.find((x) => x.id === o.logId);
    const s = l ? effectiveStatus(l) : null;
    return s === 'verified' || s === 'auto_verified';
  };
  const price = (o: ChoreOffer) => formatPrice(o.agreedPrice ?? o.price);
  const pendingCounters = (o: ChoreOffer) => Object.keys(o.counters).filter((u) => !o.declined.includes(u));
  const { earned, spent } = wallet(paid, uid, periodStart(new Date(), house.reset).getTime());

  const answer = offers.filter((o) => o.fromUid === uid && o.status === 'open' && pendingCounters(o).length > 0);
  const toPay = offers.filter((o) => o.fromUid === uid && o.status === 'done' && checked(o));
  const toDo = offers.filter((o) => o.doerUid === uid && o.status === 'agreed');
  const canOffer = openRequests.filter(
    (r) => r.assignedTo === uid && r.kind === 'needs' && !offers.some((o) => o.id === r.id),
  );
  const grabs = offers.filter((o) => o.status === 'open' && o.fromUid !== uid);
  const waiting = offers.filter(
    (o) =>
      (o.fromUid === uid && ((o.status === 'open' && pendingCounters(o).length === 0) || o.status === 'agreed' || (o.status === 'done' && !checked(o))))
      || (o.doerUid === uid && o.status === 'done'),
  );
  const nothing = answer.length + toPay.length + toDo.length + canOffer.length + grabs.length + waiting.length === 0;

  return (
    <Screen>
      <Title>Pay</Title>

      <View style={[styles.card, styles.wallet]} accessibilityLabel={`Earned ${formatPrice(earned)} this period, spent ${formatPrice(spent)}`}>
        <View>
          <Text style={styles.label}>Earned this period</Text>
          <Text style={[styles.money, { color: colors.you }]}>{formatPrice(earned)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.label}>Spent</Text>
          <Text style={styles.money}>{formatPrice(spent)}</Text>
        </View>
      </View>

      {answer.length + toPay.length + toDo.length > 0 && (
        <>
          <Label>Needs you</Label>
          {toPay.map((o) => (
            <ActionCard key={o.id} highlight avatar={{ data: avatarOf(o.doerUid), name: o.doerName ?? '?' }}
              title={`Pay ${o.doerName} ${price(o)}`}
              subtitle={`${o.choreName} · checked ✓ · ${o.doerPay ? PAY_LABELS[o.doerPay.method] : 'cash'}`}
              button="Pay" onPress={() => open(o.id)} />
          ))}
          {answer.map((o) => {
            const n = pendingCounters(o).length;
            return (
              <ActionCard key={o.id} highlight icon="swap-horizontal" title={`${o.choreName}: ${n} counter offer${n > 1 ? 's' : ''}`}
                subtitle="Someone wants a different price" button="See" onPress={() => open(o.id)} />
            );
          })}
          {toDo.map((o) => (
            <ActionCard key={o.id} highlight avatar={{ data: avatarOf(o.fromUid), name: o.fromName }}
              title={`${o.choreName} for ${o.fromName}`} subtitle={`You get ${price(o)} once it's checked`}
              button="Do it" onPress={() => open(o.id)} />
          ))}
        </>
      )}

      {canOffer.map((r) => (
        <ActionCard key={r.id} icon={choreIcon(r.choreKey) as IconName} title={r.needs}
          subtitle="It's your turn · pay someone else?" button="Set price" onPress={() => open(r.id)} />
      ))}

      {grabs.length > 0 && (
        <>
          <Label>Up for grabs 💰</Label>
          {grabs.map((o) => {
            const c = o.counters[uid];
            const status = c
              ? o.declined.includes(uid) ? `${o.fromName} declined your ${formatPrice(c.price)}` : `You offered ${formatPrice(c.price)} · waiting for ${o.fromName}`
              : null;
            return (
              <View key={o.id} style={styles.card}>
                <View style={styles.row}>
                  <Icon name={choreIcon(o.choreKey) as IconName} size={22} color={colors.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title} numberOfLines={1}>{o.choreName}</Text>
                    <Text style={styles.sub}>{status ?? `${o.fromName} will pay · ${timeAgo(o.createdAt)}`}</Text>
                  </View>
                  <Text style={styles.money}>{formatPrice(o.price)}</Text>
                </View>
                <View style={[styles.row, { marginTop: 12 }]}>
                  {status ? (
                    <Btn title="See offer" ghost onPress={() => open(o.id)} />
                  ) : (
                    <>
                      <Btn title="Counter" ghost onPress={() => open(o.id)} />
                      <Btn title="I'll do it" onPress={() => open(o.id)} />
                    </>
                  )}
                </View>
              </View>
            );
          })}
        </>
      )}

      {waiting.length > 0 && (
        <>
          <Label>In progress</Label>
          <View style={styles.card}>
            {waiting.map((o, i) => (
              <Pressable key={o.id} onPress={() => open(o.id)} accessibilityRole="button"
                style={({ pressed }) => [styles.row, styles.waitRow, i > 0 && styles.divider, pressed && { opacity: 0.6 }]}>
                <Icon name="time-outline" size={18} color={colors.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.waitTitle} numberOfLines={1}>{o.choreName}</Text>
                  <Text style={styles.sub}>
                    {o.doerUid === uid
                      ? checked(o) ? `Waiting for ${o.fromName} to pay you` : 'Waiting for your photo to be checked'
                      : o.status === 'open' ? 'Waiting for someone to take it'
                        : o.status === 'agreed' ? `${o.doerName} is doing it` : `${o.doerName} did it · waiting for the check`}
                  </Text>
                </View>
                <Text style={styles.waitPrice}>{price(o)}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {nothing && (
        <View style={[styles.card, styles.empty]}>
          <Text style={{ fontSize: 40 }}>💸</Text>
          <Text style={styles.emptyTitle}>Hate a chore? Pay someone.</Text>
          <Text style={[styles.sub, { textAlign: 'center', lineHeight: 18 }]}>
            When it&apos;s your turn, set a price. A housemate does it, you pay them, and you get the point.
          </Text>
          <View style={styles.steps}>
            {['Set price', 'They do it', 'You pay'].map((s, i) => (
              <View key={s} style={styles.stepWrap}>
                {i > 0 && <Icon name="arrow-forward" size={12} color={colors.faint} />}
                <Text style={styles.step}>{s}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Screen>
  );
}

function ActionCard(p: {
  title: string; subtitle: string; button: string; onPress: () => void; highlight?: boolean;
  avatar?: { data: React.ComponentProps<typeof Avatar>['avatar']; name: string }; icon?: IconName;
}) {
  return (
    <Pressable onPress={p.onPress} accessibilityRole="button" accessibilityLabel={`${p.title}. ${p.button}`}
      style={({ pressed }) => [styles.card, styles.row, p.highlight && styles.highlight, pressed && { opacity: 0.7 }]}>
      {p.avatar ? <Avatar avatar={p.avatar.data} name={p.avatar.name} size={32} />
        : p.icon ? <Icon name={p.icon} size={22} color={colors.text} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={2}>{p.title}</Text>
        <Text style={styles.sub} numberOfLines={2}>{p.subtitle}</Text>
      </View>
      <View style={styles.pill}><Text style={styles.pillText}>{p.button}</Text></View>
    </Pressable>
  );
}

function Btn({ title, onPress, ghost }: { title: string; onPress: () => void; ghost?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => [styles.btn, ghost ? styles.btnGhost : styles.btnFill, pressed && { opacity: 0.7 }]}>
      <Text style={[styles.btnText, !ghost && { color: colors.primaryText }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 18, padding: 16 },
  wallet: { flexDirection: 'row', justifyContent: 'space-between' },
  highlight: { borderWidth: 1.5, borderColor: colors.you },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.2, color: colors.muted, textTransform: 'uppercase' },
  money: { fontSize: 30, fontWeight: '700', letterSpacing: -1, color: colors.text },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  pill: { backgroundColor: colors.primary, borderRadius: 11, paddingVertical: 9, paddingHorizontal: 14 },
  pillText: { color: colors.primaryText, fontWeight: '600', fontSize: 14 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  btnFill: { backgroundColor: colors.primary },
  btnGhost: { borderWidth: 1, borderColor: colors.line },
  btnText: { fontWeight: '600', fontSize: 15, color: colors.text },
  waitRow: { paddingVertical: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  waitTitle: { fontSize: 15, fontWeight: '500', color: colors.text },
  waitPrice: { fontSize: 15, fontWeight: '600', color: colors.text },
  empty: { alignItems: 'center', paddingVertical: 28, gap: 6 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginTop: 4 },
  steps: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' },
  stepWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  step: { backgroundColor: colors.cardRaised, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 9, fontSize: 12, color: colors.text, overflow: 'hidden' },
});
