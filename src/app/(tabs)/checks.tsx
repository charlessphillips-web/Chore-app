import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { sendBackChore, verifyChore } from '../../lib/db';
import { jpegUri } from '../../lib/photos';
import { effectiveStatus, needsCheckBy, redoReason, REDO_REASONS, timeLeft } from '../../lib/review';
import type { ChoreLog } from '../../lib/types';
import { Button, Card, Chip, ChipRow, Empty, Input, Label, Loading, notify, Screen, Subtitle, Title, timeAgo } from '../../components/ui';
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
        toCheck.map((l) => <CheckCard key={l.id} log={l} reviewer={{ uid: user.uid, username: profile.username }} />)
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

function CheckCard({ log, reviewer }: { log: ChoreLog; reviewer: { uid: string; username: string } }) {
  const { house, members } = useApp();
  const [busy, setBusy] = useState<'verify' | 'back' | null>(null);
  const [sendingBack, setSendingBack] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');

  async function verify() {
    setBusy('verify');
    try {
      await verifyChore(house!.id, log.id, reviewer);
    } catch (e) {
      notify('Could not save', (e as Error).message);
      setBusy(null);
    }
  }
  async function sendBack() {
    if (!reason) return;
    setBusy('back');
    try {
      await sendBackChore(house!, log.id, reviewer, redoReason(reason, note), members);
    } catch (e) {
      notify('Could not send back', (e as Error).message);
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

        {!sendingBack ? (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title="Send back" icon="arrow-undo" variant="danger" style={{ flex: 1 }} onPress={() => setSendingBack(true)} disabled={!!busy} />
            <Button title="Verify" icon="checkmark" style={{ flex: 1 }} onPress={verify} loading={busy === 'verify'} disabled={!!busy} />
          </View>
        ) : (
          <View style={{ gap: space.sm }}>
            <Text style={type.body}>Why does it need redoing?</Text>
            <ChipRow>
              {REDO_REASONS.map((r) => (
                <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
              ))}
            </ChipRow>
            <Input value={note} onChangeText={setNote} placeholder="Add a note (optional)" maxLength={100} />
            <Text style={type.small}>
              It won&apos;t count, and goes back to {log.username} to redo.
            </Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button title="Cancel" variant="ghost" style={{ flex: 1 }} onPress={() => setSendingBack(false)} disabled={!!busy} />
              <Button title="Send back" variant="danger" style={{ flex: 1 }} onPress={sendBack} loading={busy === 'back'} disabled={!reason || !!busy} />
            </View>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 4 / 3, borderTopLeftRadius: radius, borderTopRightRadius: radius },
  mineRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
});
