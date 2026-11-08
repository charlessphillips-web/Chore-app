import { Text, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { Button, Card, Loading, Screen, Subtitle, Title, timeAgo } from '../../components/ui';
import { colors, space } from '../../components/theme';
import type { ChoreRequest } from '../../lib/types';

export default function Home() {
  const { user, profile, house, members, openRequests, logs } = useApp();
  if (!user || !profile || !house) return <Loading />;

  const mine = openRequests.filter((r) => r.assignedTo === user.uid);
  const others = openRequests.filter((r) => r.assignedTo !== user.uid);
  const toCheck = logs.filter(
    (l) => l.userId !== user.uid && l.status === 'pending' && !l.okVoters.includes(user.uid) && !l.notOkVoters.includes(user.uid),
  ).length;
  const leaderboard = [...members].sort((a, b) => b.totalCompleted - a.totalCompleted);

  // Doing a requested chore still needs a photo, so go via the log screen.
  const markDone = (r: ChoreRequest) =>
    router.push({ pathname: '/log', params: { requestId: r.id, chore: r.choreName } });

  const RequestRow = ({ r, highlight }: { r: ChoreRequest; highlight?: boolean }) => (
    <View style={[styles.row, highlight && styles.highlight]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{r.choreName}</Text>
        <Text style={styles.rowMeta}>
          {highlight ? `${r.requestedByName} flagged this` : `Asked ${r.assignedToName}`} · {timeAgo(r.createdAt)}
        </Text>
      </View>
      <Button title="Done ✓" onPress={() => markDone(r)} style={styles.doneBtn} />
    </View>
  );

  return (
    <Screen>
      <Title>{house.name}</Title>
      <Subtitle>Hey {profile.username} — what&apos;s happening?</Subtitle>

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button title="✅ I did a chore" onPress={() => router.push('/log')} style={{ flex: 1 }} />
        <Button title="🔔 Needs doing" variant="secondary" onPress={() => router.push('/request')} style={{ flex: 1 }} />
      </View>

      {toCheck > 0 && (
        <Button
          title={`📷 ${toCheck} chore photo${toCheck === 1 ? '' : 's'} to check`}
          variant="secondary"
          onPress={() => router.push('/activity')}
        />
      )}

      {mine.length > 0 && (
        <Card>
          <Text style={styles.cardTitle}>Your turn ({mine.length})</Text>
          {mine.map((r) => <RequestRow key={r.id} r={r} highlight />)}
        </Card>
      )}

      <Card>
        <Text style={styles.cardTitle}>Needs doing in the house</Text>
        {others.length === 0 ? (
          <Text style={styles.rowMeta}>Nothing waiting on anyone else. 🎉</Text>
        ) : (
          others.map((r) => <RequestRow key={r.id} r={r} />)
        )}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Leaderboard</Text>
        {leaderboard.map((m, i) => (
          <View key={m.uid} style={styles.row}>
            <Text style={styles.rank}>{i + 1}</Text>
            <Text style={[styles.rowTitle, { flex: 1 }]}>
              {m.username}{m.uid === user.uid ? ' (you)' : ''}
            </Text>
            <Text style={styles.count}>{m.totalCompleted}</Text>
          </View>
        ))}
        {members.length < 2 && (
          <Text style={styles.rowMeta}>Share your code ({house.code}) from the House tab to add housemates.</Text>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6 },
  highlight: { backgroundColor: '#FEF3C7', borderRadius: 10, paddingHorizontal: space.sm },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowMeta: { fontSize: 13, color: colors.muted },
  doneBtn: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.success },
  rank: { width: 24, fontSize: 16, fontWeight: '800', color: colors.muted },
  count: { fontSize: 18, fontWeight: '800', color: colors.primary },
});
