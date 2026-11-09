import { StyleSheet, Text, View } from 'react-native';
import { useApp } from '../../context/AppContext';
import { pickAssignee } from '../../lib/assign';
import { DEFAULT_RESET_MONTHS, periodEnd, periodLabel, periodStart, resetLabel } from '../../lib/period';
import { Loading, Screen, Title } from '../../components/ui';
import { colors, radius, space, type } from '../../components/theme';

const DAY = 24 * 60 * 60 * 1000;

/** A league table: position, name, chores this period. */
export default function Leaderboard() {
  const { user, house, members } = useApp();
  if (!user || !house) return <Loading />;

  const rule = house.reset;
  const now = new Date();
  const end = periodEnd(now, rule);
  const start = periodStart(now, rule);
  const totalDays = Math.round((end.getTime() - start.getTime()) / DAY);
  const daysLeft = Math.max(1, Math.ceil((end.getTime() - now.getTime()) / DAY));
  const elapsed = (now.getTime() - start.getTime()) / (end.getTime() - start.getTime());
  const resets = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });

  const ranked = [...members].sort((a, b) => b.totalCompleted - a.totalCompleted || a.username.localeCompare(b.username));
  const top = Math.max(1, ...ranked.map((m) => m.totalCompleted));
  // Who'd get the next "needs doing" (if someone other than them reported it).
  const nextUp = members.length > 1 ? pickAssignee(members, '', 'overall', '') : null;
  // Same score = same position.
  const position = (i: number) => ranked.findIndex((m) => m.totalCompleted === ranked[i].totalCompleted) + 1;

  return (
    <Screen>
      <Title>Leaderboard</Title>

      <View style={styles.period}>
        <View style={styles.periodTop}>
          <Text style={styles.periodName}>{periodLabel(now, rule)}</Text>
          <Text style={type.small}>{daysLeft} {daysLeft === 1 ? 'day' : 'days'} left</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${Math.min(100, Math.round(elapsed * 100))}%` }]} />
        </View>
        <Text style={type.small}>
          {typeof rule === 'object'
            ? `Custom dates set by the house admin · ends ${new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}, then a new ${totalDays}-day leaderboard starts`
            : `Resets ${resetLabel(rule)}${rule === DEFAULT_RESET_MONTHS ? ' (the default)' : ', set by the house admin'} · next reset ${resets}`}
        </Text>
      </View>

      <View style={styles.table}>
        <View style={[styles.row, styles.head]}>
          <Text style={[styles.headText, styles.pos]}>#</Text>
          <Text style={[styles.headText, { flex: 1 }]}>Housemate</Text>
          <Text style={[styles.headText, styles.score]}>Chores</Text>
        </View>
        {ranked.map((m, i) => {
          const me = m.uid === user.uid;
          return (
            <View key={m.uid} style={[styles.row, i > 0 && styles.divider, me && styles.meRow]}>
              {me && <View style={styles.meMark} />}
              <Text style={[styles.posText, styles.pos]}>{position(i)}</Text>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {m.username}
                  {me ? <Text style={type.small}>  You</Text> : null}
                </Text>
                <View style={styles.bar}>
                  <View style={[styles.barFill, { width: `${(m.totalCompleted / top) * 100}%` }, me && { backgroundColor: colors.primaryBright }]} />
                </View>
                {nextUp?.uid === m.uid && <Text style={styles.next}>Next up for chores</Text>}
              </View>
              <Text style={[styles.scoreText, styles.score]}>{m.totalCompleted}</Text>
            </View>
          );
        })}
      </View>

      <Text style={type.small}>
        Only checked chores count. Sent-back chores count again once they&apos;re redone. Whoever has the fewest gets the
        next &quot;needs doing&quot; request.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  period: { gap: space.sm, paddingBottom: space.xs },
  periodTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  periodName: { fontSize: 17, fontWeight: '600', color: colors.text },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  trackFill: { height: '100%', backgroundColor: colors.muted },
  table: { borderRadius: radius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, gap: 12 },
  head: { paddingVertical: 10, backgroundColor: colors.cardRaised },
  headText: { fontSize: 11, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  meRow: { backgroundColor: 'rgba(147,129,242,0.06)' },
  meMark: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, backgroundColor: colors.primaryBright },
  pos: { width: 20 },
  posText: { fontSize: 15, fontWeight: '600', color: colors.muted, fontVariant: ['tabular-nums'] },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  bar: { height: 3, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.muted },
  next: { fontSize: 12, color: colors.muted },
  score: { width: 56, textAlign: 'right' },
  scoreText: { fontSize: 20, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
});
