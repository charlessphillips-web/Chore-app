import { Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { jpegUri } from '../../lib/photos';
import { Button, Card, Empty, Icon, Label, Loading, Screen, Title, timeAgo } from '../../components/ui';
import { StatusBadge } from '../../components/StatusBadge';
import { colors, space, type } from '../../components/theme';

export default function HouseTab() {
  const { user, house, members, logs } = useApp();
  if (!user || !house) return <Loading />;

  const share = () =>
    Share.share({ message: `Join our house "${house.name}" on Choreboard with code: ${house.code}` });
  const sorted = [...members].sort((a, b) => a.joinedAt - b.joinedAt);

  return (
    <Screen>
      <Title>{house.name}</Title>

      <Card style={{ alignItems: 'center' }}>
        <Text style={type.label}>House code</Text>
        <Text style={styles.code} selectable>{house.code}</Text>
        <Button title="Share code" icon="share-outline" variant="secondary" onPress={share} style={{ alignSelf: 'stretch' }} />
      </Card>

      <Label>Housemates ({members.length})</Label>
      <Card style={{ paddingVertical: space.sm }}>
        {sorted.map((m, i) => (
          <View key={m.uid} style={[styles.row, i < sorted.length - 1 && styles.divider]}>
            <Text style={[type.body, { flex: 1 }]}>
              {m.username}{m.uid === user.uid ? ' (you)' : ''}
            </Text>
            {m.uid === house.adminUid && <Text style={styles.admin}>ADMIN</Text>}
            <Icon
              name={m.pushToken ? 'notifications' : 'notifications-off-outline'}
              size={16}
              color={m.pushToken ? colors.text : colors.muted}
            />
          </View>
        ))}
      </Card>

      <Label>Recent activity</Label>
      <Card style={{ paddingVertical: space.sm }}>
        {logs.length === 0 ? (
          <Empty icon="time-outline">No chores logged yet.</Empty>
        ) : (
          logs.slice(0, 20).map((l, i) => (
            <Pressable
              key={l.id}
              onPress={() => router.push({ pathname: '/photo/[logId]', params: { logId: l.id } })}
              style={[styles.row, i < Math.min(logs.length, 20) - 1 && styles.divider]}
            >
              {l.photoThumb ? (
                <Image source={{ uri: jpegUri(l.photoThumb) }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, { backgroundColor: colors.cardRaised }]} />
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={type.body}>
                  <Text style={{ fontWeight: '700' }}>{l.userId === user.uid ? 'You' : l.username}</Text> · {l.choreName}
                </Text>
                <Text style={type.small}>{timeAgo(l.at)}</Text>
                <StatusBadge log={l} />
              </View>
            </Pressable>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: { fontSize: 38, fontWeight: '700', letterSpacing: 8, color: colors.text, marginVertical: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  admin: { fontSize: 11, fontWeight: '700', color: colors.primaryBright, letterSpacing: 1 },
  thumb: { width: 52, height: 52, borderRadius: 8 },
});
