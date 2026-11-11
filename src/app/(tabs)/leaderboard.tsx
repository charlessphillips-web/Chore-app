import { StyleSheet, Text, View } from 'react-native';
import { useApp } from '../../context/AppContext';
import { pickAssignee } from '../../lib/assign';
import { DEFAULT_RESET_MONTHS, periodEnd, periodLabel, periodStart, resetLabel } from '../../lib/period';
import { BigNumber, Loading, Screen, Title } from '../../components/ui';
import { Tip } from '../../components/Tip';
import { Avatar } from '../../components/Avatar';
import { colors, fonts, radius, space, type } from '../../components/theme';

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

  const pts = (m: (typeof members)[number]) => m.points ?? m.totalCompleted;
  const ranked = [...members].sort((a, b) => pts(b) - pts(a) || a.username.localeCompare(b.username));
  const houseTotal = ranked.reduce((n, m) => n + pts(m), 0);
  const fairPct = members.length ? 100 / members.length : 100;
  const share = (m: (typeof members)[number]) => (houseTotal ? (pts(m) / houseTotal) * 100 : 0);
  // Bars are scaled so a fair share sits in the middle-ish and nobody's bar is tiny.
  const scale = Math.min(100, Math.max(fairPct * 2, ...ranked.map(share)));
  // Who'd get the next "needs doing" (if someone other than them reported it).
  const nextUp = members.length > 1 ? pickAssignee(members, '', 'overall', '') : null;
  // Same score = same position.
  const position = (i: number) => ranked.findIndex((m) => pts(m) === pts(ranked[i])) + 1;

  return (
    <Screen>
      <Title>Leaderboard</Title>
      <Tip id="ranks">Everyone&apos;s fair share is an equal split of the chores. Bigger jobs are worth more points (Quick 1 · Medium 2 · Big 3). Whoever is furthest below their fair share gets the next &quot;needs doing&quot;.</Tip>

      <View style={styles.period}>
        <View style={styles.periodTop}>
          <View style={{ gap: 2 }}>
            <Text style={type.label}>Period</Text>
            <Text style={styles.periodName}>{periodLabel(now, rule)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <BigNumber value={daysLeft} size={36} />
            <Text style={type.label}>{daysLeft === 1 ? 'Day left' : 'Days left'}</Text>
          </View>
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
          <Text style={[styles.headText, { flex: 1, marginLeft: 46 }]}>Housemate</Text>
          <Text style={[styles.headText, styles.score]}>Share</Text>
        </View>
        {ranked.map((m, i) => {
          const me = m.uid === user.uid;
          return (
            <View key={m.uid} style={[styles.row, i > 0 && styles.divider, me && styles.meRow]}>
              <Text style={[styles.posText, styles.pos]}>{position(i)}</Text>
              <Avatar avatar={m.avatar} name={m.username} size={34} />
              <View style={{ flex: 1, gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.name} numberOfLines={1}>{m.username}</Text>
                  {me && <View style={styles.youDot} accessibilityLabel="You" />}
                </View>
                <View style={{ justifyContent: 'center' }}>
                  <View style={styles.bar}>
                    <View style={[styles.barFill, { width: `${(share(m) / scale) * 100}%` }, (me || share(m) >= fairPct) && { backgroundColor: colors.text }]} />
                  </View>
                  <View style={[styles.fairMark, { left: `${(fairPct / scale) * 100}%` }]} />
                </View>
                <Text style={styles.next}>
                  {pts(m)} point{pts(m) === 1 ? '' : 's'} · {m.totalCompleted} chore{m.totalCompleted === 1 ? '' : 's'}
                  {nextUp?.uid === m.uid ? ' · next up for chores' : ''}
                </Text>
              </View>
              <Text style={[styles.scoreText, styles.score]}>{houseTotal ? `${Math.round(share(m))}%` : '–'}</Text>
            </View>
          );
        })}
      </View>

      <Text style={type.small}>
        The purple line on each bar is a fair share ({Math.round(fairPct)}% each). Bigger jobs are worth more points, and
        whoever is furthest below their fair share gets the next &quot;needs doing&quot; request. Sent-back chores don&apos;t
        count until they&apos;re redone.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  period: { gap: space.sm, paddingBottom: space.xs },
  periodTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  periodName: { fontSize: 17, fontWeight: '600', color: colors.text },
  track: { height: 2, borderRadius: 1, backgroundColor: colors.line, overflow: 'hidden' },
  trackFill: { height: '100%', backgroundColor: colors.text },
  table: { borderRadius: radius, backgroundColor: colors.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, gap: 12 },
  head: { paddingVertical: 10 },
  headText: { fontSize: 10, fontFamily: fonts.mono, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1.2 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  meRow: { backgroundColor: colors.cardRaised },
  youDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.you },
  pos: { width: 24 },
  posText: { fontSize: 13, fontFamily: fonts.mono, color: colors.muted },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  bar: { height: 5, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden' },
  fairMark: { position: 'absolute', width: 2, height: 12, marginLeft: -1, backgroundColor: colors.you, borderRadius: 1 },
  barFill: { height: '100%', backgroundColor: colors.muted },
  next: { fontSize: 12, color: colors.muted },
  score: { width: 56, textAlign: 'right' },
  scoreText: { fontSize: 24, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
});
