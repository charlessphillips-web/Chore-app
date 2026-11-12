import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../context/AppContext';
import { periodKey, previousPeriodKey } from '../lib/period';
import { lastResult, topStake, type Stake } from '../lib/stakes';
import type { House } from '../lib/types';
import { Button, Icon } from './ui';
import { colors, radius, type } from './theme';

/** Big, purple-edged card at the top of Ranks: this period's prize and forfeit, and a Vote button. */
export function StakesCard() {
  const { user, house, stakes, membersIn, isAdmin } = useApp();
  if (!user || !house) return null;
  if (!house.stakes) {
    if (!isAdmin) return null;
    return (
      <View style={styles.card}>
        <View style={styles.head}>
          <Icon name="trophy" size={22} color={colors.you} />
          <Text style={styles.title}>Play for stakes?</Text>
        </View>
        <Text style={styles.body}>
          Your house votes on a prize for whoever does the most this period, and a forfeit for whoever does the least.
        </Text>
        <Button title="Switch on house stakes" onPress={() => router.push('/settings/house-details')} />
      </View>
    );
  }
  const now = new Date();
  const p = periodKey(now, house.reset);
  const prev = previousPeriodKey(now, house.reset);
  const prize = topStake(stakes, 'prize', p);
  const forfeit = topStake(stakes, 'forfeit', p);
  const votedAll = !needsStakeVote(user.uid, house, stakes);
  const last = lastResult(stakes, prev, membersIn(prev).map((m) => ({ username: m.username, points: m.points ?? m.totalCompleted })));
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Icon name="trophy" size={22} color={colors.you} />
        <Text style={styles.title}>House stakes</Text>
      </View>
      <View style={styles.line}>
        <Text style={styles.tag}>TOP WINS</Text>
        <Text style={styles.stake}>{prize ? prize.text : 'Nothing voted yet'}</Text>
      </View>
      <View style={styles.line}>
        <Text style={styles.tag}>BOTTOM DOES</Text>
        <Text style={styles.stake}>{forfeit ? forfeit.text : 'Nothing voted yet'}</Text>
      </View>
      {last && <Text style={type.small}>Last period: {last}</Text>}
      <Button title={votedAll ? 'See votes' : 'Vote on prize & forfeit'} variant={votedAll ? 'secondary' : 'primary'} onPress={() => router.push('/stakes')} />
    </View>
  );
}

/** For Home: true while stakes are on and you haven't voted for both. */
export function needsStakeVote(uid: string, house: House, stakes: Stake[]): boolean {
  if (!house.stakes) return false;
  const p = periodKey(new Date(), house.reset);
  return !(['prize', 'forfeit'] as const).every((k) => stakes.some((s) => s.kind === k && s.period === p && s.votes.includes(uid)));
}

const styles = StyleSheet.create({
  card: { borderRadius: radius, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.you, padding: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  body: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  line: { gap: 2 },
  tag: { fontSize: 10, letterSpacing: 1.2, color: colors.you, fontWeight: '700' },
  stake: { fontSize: 17, fontWeight: '600', color: colors.text },
});
