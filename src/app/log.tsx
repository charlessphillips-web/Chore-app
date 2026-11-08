import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../context/AppContext';
import { logChore } from '../lib/db';
import { choreKey } from '../lib/chores';
import { takeChorePhoto, type ChorePhoto } from '../lib/photos';
import { ChorePicker } from '../components/ChorePicker';
import { Button, ErrorText, Label, Screen, Subtitle } from '../components/ui';
import { colors, radius } from '../components/theme';

export default function LogChore() {
  const { user, profile, house, openRequests } = useApp();
  // Set when coming from "Done ✓" on a request.
  const params = useLocalSearchParams<{ requestId?: string; chore?: string }>();
  const [chore, setChore] = useState(params.chore ?? '');
  const [photo, setPhoto] = useState<ChorePhoto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'photo' | 'save' | null>(null);

  async function snap() {
    setError(null);
    setBusy('photo');
    try {
      const p = await takeChorePhoto();
      if (p) setPhoto(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!user || !profile || !house || !photo) return;
    setError(null);
    setBusy('save');
    try {
      // If someone had flagged this chore as needing doing, close that request too.
      const key = choreKey(chore);
      const match =
        openRequests.find((r) => r.id === params.requestId) ??
        openRequests.find((r) => r.choreKey === key && r.assignedTo === user.uid) ??
        openRequests.find((r) => r.choreKey === key);
      await logChore({
        houseId: house.id,
        uid: user.uid,
        username: profile.username,
        choreName: chore,
        photo,
        requestId: match?.id ?? null,
      });
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Subtitle>Nice one. Snap a photo so your housemates can check it, then log it.</Subtitle>
      <ChorePicker value={chore} onChange={setChore} />

      <Label>Photo proof</Label>
      {photo ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: photo.previewUri }} style={styles.preview} resizeMode="cover" />
        </View>
      ) : (
        <View style={[styles.previewWrap, styles.empty]}>
          <Text style={{ fontSize: 40 }}>📷</Text>
          <Text style={{ color: colors.muted }}>Required — all housemates will see it</Text>
        </View>
      )}
      <Button
        title={photo ? 'Retake photo' : 'Take photo'}
        variant="secondary"
        onPress={snap}
        loading={busy === 'photo'}
        disabled={busy === 'save'}
      />

      <ErrorText>{error}</ErrorText>
      <Button title="Log chore" onPress={save} loading={busy === 'save'} disabled={!choreKey(chore) || !photo || busy === 'photo'} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  previewWrap: { borderRadius: radius, overflow: 'hidden', aspectRatio: 4 / 3, backgroundColor: colors.card },
  preview: { width: '100%', height: '100%' },
  empty: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, gap: 4 },
});
