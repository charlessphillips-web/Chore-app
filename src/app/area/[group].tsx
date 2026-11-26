import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ChoreIcon } from '../../components/ChoreIcon';
import { useApp } from '../../context/AppContext';
import { choreSize, taskName } from '../../lib/chores';
import { haptics } from '../../lib/haptics';
import { Icon, Loading, Screen, Subtitle, Title } from '../../components/ui';
import { colors } from '../../components/theme';


/** A bathroom: pick which bit you did (or the whole thing), or say it needs doing. */
export default function AreaScreen() {
  const { group } = useLocalSearchParams<{ group: string }>();
  const { user, house, members, openRequests } = useApp();
  if (!user || !house) return <Loading />;
  const tasks = house.chores.filter((c) => c.active && c.group === group);
  if (tasks.length === 0) return <Screen edges={['left', 'right']}><Title>Not found</Title></Screen>;

  const users = tasks[0].users ?? [];
  const names = users.map((u) => members.find((m) => m.uid === u)?.username).filter(Boolean) as string[];
  const who = users.length === 0 ? 'Everyone uses it' : `Used by ${names.join(', ')}`;

  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: '' }} />
      <Title>{group}</Title>
      <Subtitle>{who}. Tap what you cleaned, or what needs doing. Only people who use it get asked.</Subtitle>
      <View style={styles.card}>
        {tasks.map((c, i) => {
          const pts = choreSize(c);
          const waiting = openRequests.find((r) => r.choreKey === c.key);
          return (
            <Pressable
              key={c.key}
              accessibilityRole="button"
              accessibilityLabel={taskName(c)}
              onPress={() => { haptics.tap(); router.push({ pathname: '/chore/[key]', params: { key: c.key } }); }}
              style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && { backgroundColor: colors.cardRaised }]}
            >
              <ChoreIcon choreKey={c.key} size={34} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{taskName(c)}</Text>
                <Text style={styles.sub}>
                  {waiting ? `Waiting on ${waiting.assignedToName}` : c.key.endsWith(' whole') ? 'Toilet, shower and sink in one go' : `${pts} point${pts > 1 ? 's' : ''}`}
                </Text>
              </View>
              <Text style={[styles.pts, { color: colors.you }]}>+{pts}</Text>
              <Icon name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 18, borderCurve: 'continuous' as const, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  name: { fontSize: 17, fontWeight: '600', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  pts: { fontSize: 15, fontWeight: '700' },
});
