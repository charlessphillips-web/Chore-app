import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { periodLabel } from '../../lib/period';
import { Card, Label, Loading, Logo, RowButton, Screen, timeAgo } from '../../components/ui';
import { space, type } from '../../components/theme';

export default function Home() {
  const { user, house, openRequests, wallpaper } = useApp();
  if (!user || !house) return <Loading />;

  const mine = openRequests.filter((r) => r.assignedTo === user.uid);
  const others = openRequests.filter((r) => r.assignedTo !== user.uid);
  const chores = house.chores.filter((c) => c.active);
  const openChore = (key: string, requestId?: string) =>
    router.push({ pathname: '/chore/[key]', params: requestId ? { key, requestId } : { key } });

  return (
    <Screen background={wallpaper}>
      <View style={styles.header}>
        <Logo size={44} />
        <View style={{ flex: 1 }}>
          <Text style={type.title} numberOfLines={1}>{house.name}</Text>
          <Text style={type.small}>{periodLabel()}</Text>
        </View>
      </View>

      {mine.length > 0 && (
        <>
          <Label>Your turn</Label>
          {mine.map((r) => (
            <RowButton
              key={r.id}
              icon="alert-circle"
              title={r.needs}
              subtitle={`${r.requestedByName} flagged this · ${timeAgo(r.createdAt)}`}
              onPress={() => openChore(r.choreKey, r.id)}
            />
          ))}
        </>
      )}

      <Label>Chores</Label>
      {chores.map((c) => {
        const waiting = others.find((r) => r.choreKey === c.key);
        return (
          <RowButton
            key={c.key}
            title={c.name}
            subtitle={waiting ? `Waiting on ${waiting.assignedToName}` : undefined}
            onPress={() => openChore(c.key)}
          />
        );
      })}
      {chores.length === 0 && (
        <Card>
          <Text style={type.small}>No chores switched on. The house admin can add some in Settings.</Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm },
});
