import { StyleSheet, Text, View } from 'react-native';
import { useApp } from '../../../context/AppContext';
import { makeAdmin, removeMember } from '../../../lib/db';
import { Button, Card, confirm, Loading, notify, Screen, Subtitle } from '../../../components/ui';
import { space, type } from '../../../components/theme';

/** Admin: remove housemates or hand over the admin role. */
export default function Housemates() {
  const { user, house, members, isAdmin } = useApp();
  if (!user || !house) return <Loading />;
  if (!isAdmin) return <Screen edges={['left', 'right']}><Subtitle>Only the house admin can manage housemates.</Subtitle></Screen>;

  const others = members.filter((m) => m.uid !== user.uid).sort((a, b) => a.username.localeCompare(b.username));

  async function remove(uid: string, name: string) {
    if (!(await confirm(`Remove ${name}?`, `${name} will be taken out of the house and off the leaderboard.`, 'Remove'))) return;
    try {
      await removeMember(house!.id, uid);
    } catch (e) {
      notify('Could not remove', (e as Error).message);
    }
  }
  async function handOver(uid: string, name: string) {
    if (!(await confirm(`Make ${name} admin?`, "You'll no longer be able to manage chores or housemates.", 'Make admin'))) return;
    try {
      await makeAdmin(house!.id, uid);
    } catch (e) {
      notify('Could not change admin', (e as Error).message);
    }
  }

  return (
    <Screen edges={['left', 'right']}>
      {others.length === 0 ? (
        <Subtitle>Nobody else has joined yet. Share your house code from the House tab.</Subtitle>
      ) : (
        others.map((m) => (
          <Card key={m.uid}>
            <Text style={type.heading}>{m.username}</Text>
            <Text style={type.small}>{m.totalCompleted} chores this period</Text>
            <View style={styles.actions}>
              <Button title="Make admin" variant="secondary" style={{ flex: 1 }} onPress={() => handOver(m.uid, m.username)} />
              <Button title="Remove" variant="danger" style={{ flex: 1 }} onPress={() => remove(m.uid, m.username)} />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
});
