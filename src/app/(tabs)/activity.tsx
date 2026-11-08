import { Text, View, StyleSheet } from 'react-native';
import { useApp } from '../../context/AppContext';
import { Card, Screen, Subtitle, Title, timeAgo } from '../../components/ui';
import { colors, space } from '../../components/theme';

export default function Activity() {
  const { logs, user } = useApp();
  return (
    <Screen>
      <Title>Activity</Title>
      <Subtitle>Latest chores done in the house.</Subtitle>
      <Card>
        {logs.length === 0 ? (
          <Text style={styles.meta}>No chores logged yet — be the first!</Text>
        ) : (
          logs.map((l) => (
            <View key={l.id} style={styles.row}>
              <Text style={{ fontSize: 20 }}>✅</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>
                  <Text style={{ fontWeight: '800' }}>{l.userId === user?.uid ? 'You' : l.username}</Text> · {l.choreName}
                </Text>
                <Text style={styles.meta}>
                  {timeAgo(l.at)}{l.requestId ? ' · was requested' : ''}
                </Text>
              </View>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6 },
  title: { fontSize: 16, color: colors.text },
  meta: { fontSize: 13, color: colors.muted },
});
