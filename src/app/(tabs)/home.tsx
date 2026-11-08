import { useState } from 'react';
import { Alert, Text, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { logChore } from '../../lib/db';
import { Button, Card, Loading, Screen, Subtitle, Title, timeAgo } from '../../components/ui';
import { colors, space } from '../../components/theme';
import type { ChoreRequest } from '../../lib/types';

export default function Home() {
  const { user, profile, house, members, openRequests } = useApp();
  const [busyId, setBusyId] = useState<string | null>(null);
  if (!user || !profile || !house) return <Loading />;

  const mine = openRequests.filter((r) => r.assignedTo === user.uid);
  const others = openRequests.filter((r) => r.assignedTo !== user.uid);
  const leaderboard = [...members].sort((a, b) => b.totalCompleted - a.totalCompleted);

  async function markDone(r: ChoreRequest) {
    setBusyId(r.id);
    try {
      await logChore(house!.id, user!.uid, profile!.username, r.choreName, r.id);
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const RequestRow = ({ r, highlight }: { r: ChoreRequest; highlight?: boolean }) => (
    <View style={[styles.row, highlight && styles.highlight]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{r.choreName}</Text>
        <Text style={styles.rowMeta}>
          {highlight ? `${r.requestedByName} flagged this` : `Asked ${r.assignedToName}`} · {timeAgo(r.createdAt)}
        </Text>
      </View>
      <Button title="Done ✓" onPress={() => markDone(r)} loading={busyId === r.id} style={styles.doneBtn} />
    </View>
  );

  return (
    <Screen>
      <Title>{house.name}</Title>
      <Subtitle>Hey {profile.username} — what's happening?</Subtitle>

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button title="✅ I did a chore" onPress={() => router.push('/log')} style={{ flex: 1 }} />
        <Button title="🔔 Needs doing" variant="secondary" onPress={() => router.push('/request')} style={{ flex: 1 }} />
      </View>

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
