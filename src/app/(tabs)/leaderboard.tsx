import { StyleSheet, Text, View } from 'react-native';
import { useApp } from '../../context/AppContext';
import { pickAssignee } from '../../lib/assign';
import { periodEnd, periodLabel } from '../../lib/period';
import { Card, Loading, Screen, Subtitle, Title } from '../../components/ui';
import { colors, space, type } from '../../components/theme';

export default function Leaderboard() {
  const { user, members } = useApp();
  if (!user) return <Loading />;

  const ranked = [...members].sort((a, b) => b.totalCompleted - a.totalCompleted || a.username.localeCompare(b.username));
  // Who'd get the next "needs doing" (if someone other than them reported it).
  const nextUp = pickAssignee(members, '', 'overall', '');
  const resets = periodEnd().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });

  return (
    <Screen>
      <Title>Leaderboard</Title>
      <Subtitle>{periodLabel()} · resets {resets}</Subtitle>
      <Card style={{ paddingVertical: space.sm }}>
        {ranked.map((m, i) => (
          <View key={m.uid} style={[styles.row, i < ranked.length - 1 && styles.divider]}>
            <Text style={[styles.rank, i === 0 && m.totalCompleted > 0 && { color: colors.primaryBright }]}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={type.body}>{m.username}{m.uid === user.uid ? ' (you)' : ''}</Text>
              {nextUp?.uid === m.uid && members.length > 1 && <Text style={type.small}>Next up for chores</Text>}
            </View>
            <Text style={styles.count}>{m.totalCompleted}</Text>
          </View>
        ))}
      </Card>
      <Text style={type.small}>
        Sent-back chores don&apos;t count until they&apos;re redone. Whoever has the fewest gets the next &quot;needs doing&quot; request.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rank: { width: 22, fontSize: 18, fontWeight: '700', color: colors.muted },
  count: { fontSize: 22, fontWeight: '700', color: colors.text },
});
