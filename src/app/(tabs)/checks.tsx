import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { reviewChore } from '../../lib/db';
import { jpegUri } from '../../lib/photos';
import { effectiveStatus, needsCheckBy, timeLeft } from '../../lib/review';
import type { ChoreLog } from '../../lib/types';
import { Button, Card, Empty, Label, Loading, notify, Screen, Subtitle, Title, timeAgo } from '../../components/ui';
import { colors, radius, space, type } from '../../components/theme';

/** Photos waiting for a check. One housemate's decision is enough; then it disappears. */
export default function Checks() {
  const { user, profile, house, logs } = useApp();
  if (!user || !profile || !house) return <Loading />;

  const toCheck = logs.filter((l) => needsCheckBy(l, user.uid));
  const minePending = logs.filter((l) => l.userId === user.uid && effectiveStatus(l) === 'pending');

  return (
    <Screen>
      <Title>Checks</Title>
      <Subtitle>
        Only one person needs to check each photo. Anything not checked within 24 hours is verified automatically.
      </Subtitle>

      {toCheck.length === 0 ? (
        <Card>
          <Empty icon="checkmark-done-outline">Nothing to check right now.</Empty>
        </Card>
      ) : (
        toCheck.map((l) => <CheckCard key={l.id} log={l} houseId={house.id} reviewer={{ uid: user.uid, username: profile.username }} />)
      )}

      {minePending.length > 0 && (
        <>
          <Label>Your chores waiting for a check</Label>
          <Card>
            {minePending.map((l) => (
              <View key={l.id} style={styles.mineRow}>
                <Text style={type.body}>{l.choreName}</Text>
                <Text style={type.small}>{timeLeft(l.at)}</Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

function CheckCard({ log, houseId, reviewer }: { log: ChoreLog; houseId: string; reviewer: { uid: string; username: string } }) {
  const [busy, setBusy] = useState<'verified' | 'rejected' | null>(null);
  async function decide(d: 'verified' | 'rejected') {
    setBusy(d);
    try {
      await reviewChore(houseId, log.id, reviewer, d);
    } catch (e) {
      notify('Could not save', (e as Error).message);
      setBusy(null);
    }
  }
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <Pressable
        onPress={() => router.push({ pathname: '/photo/[logId]', params: { logId: log.id } })}
        accessibilityRole="imagebutton"
        accessibilityLabel={`Photo of ${log.choreName}`}
      >
        {log.photoThumb ? (
          <Image source={{ uri: jpegUri(log.photoThumb) }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={[styles.photo, { backgroundColor: colors.cardRaised }]} />
        )}
      </Pressable>
      <View style={{ padding: space.md, gap: space.sm }}>
        <Text style={type.heading}>{log.choreName}</Text>
        <Text style={type.small}>
          {log.username} · {timeAgo(log.at)} · {timeLeft(log.at)} to check · tap photo to enlarge
        </Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button title="Reject" icon="close" variant="danger" style={{ flex: 1 }} onPress={() => decide('rejected')} loading={busy === 'rejected'} disabled={!!busy} />
          <Button title="Verify" icon="checkmark" style={{ flex: 1 }} onPress={() => decide('verified')} loading={busy === 'verified'} disabled={!!busy} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 4 / 3, borderTopLeftRadius: radius, borderTopRightRadius: radius },
  mineRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
});
