import { useState } from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../../context/AppContext';
import { leaveHouse } from '../../lib/db';
import { Button, Card, Loading, Screen, Subtitle, Title } from '../../components/ui';
import { colors, space } from '../../components/theme';

export default function HouseTab() {
  const { user, house, members } = useApp();
  const [leaving, setLeaving] = useState(false);
  if (!user || !house) return <Loading />;

  const share = () =>
    Share.share({
      message: `Join our house "${house.name}" on Choreboard with code: ${house.code}`,
    });

  const confirmLeave = () =>
    Alert.alert('Leave house?', 'Your chore history in this house will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          setLeaving(true);
          try {
            await leaveHouse(user.uid, house.id);
          } catch (e) {
            Alert.alert('Could not leave', (e as Error).message);
            setLeaving(false);
          }
        },
      },
    ]);

  return (
    <Screen>
      <Title>{house.name}</Title>
      <Card style={{ alignItems: 'center' }}>
        <Subtitle>House code</Subtitle>
        <Text style={styles.code} selectable>{house.code}</Text>
        <Button title="Share code with housemates" onPress={share} style={{ alignSelf: 'stretch' }} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Housemates ({members.length})</Text>
        {members.map((m) => (
          <View key={m.uid} style={styles.row}>
            <Text style={styles.name}>{m.username}{m.uid === user.uid ? ' (you)' : ''}</Text>
            <Text style={styles.meta}>{m.pushToken ? '🔔' : '🔕'}</Text>
          </View>
        ))}
        <Text style={styles.meta}>🔕 = notifications not enabled on their phone yet.</Text>
      </Card>

      <Button title="Leave house" variant="danger" onPress={confirmLeave} loading={leaving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: { fontSize: 40, fontWeight: '900', letterSpacing: 6, color: colors.primary, marginVertical: space.sm },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  name: { fontSize: 16, color: colors.text },
  meta: { fontSize: 13, color: colors.muted },
});
