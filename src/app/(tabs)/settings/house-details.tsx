import { useState } from 'react';
import { Image, View } from 'react-native';
import { useApp } from '../../../context/AppContext';
import { setWallpaper, updateHouse } from '../../../lib/db';
import { pickFromLibrary } from '../../../lib/photos';
import { DEFAULT_RESET_MONTHS, periodEnd, RESET_OPTIONS, resetLabel, type ResetMonths } from '../../../lib/period';
import { Button, Chip, ChipRow, confirm, Empty, ErrorText, Input, Label, Loading, notify, Screen, Subtitle } from '../../../components/ui';
import { colors, radius } from '../../../components/theme';

/** Admin: house name, leaderboard reset and wallpaper. */
export default function HouseDetails() {
  const { user, house, isAdmin, wallpaper } = useApp();
  const [name, setName] = useState(house?.name ?? '');
  const [busy, setBusy] = useState<'name' | 'wall' | 'reset' | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!house || !user) return <Loading />;
  if (!isAdmin) return <Screen edges={['left', 'right']}><Subtitle>Only the house admin can change these.</Subtitle></Screen>;

  async function saveName() {
    if (name.trim().length < 1) return setError('Enter a house name or number.');
    setError(null);
    setBusy('name');
    try {
      await updateHouse(house!.id, { name: name.trim() });
      notify('Saved', 'House name updated.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function changeReset(months: ResetMonths) {
    if (months === house!.resetMonths) return;
    const next = periodEnd(new Date(), months).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
    const ok = await confirm(
      `Reset ${resetLabel(months)}?`,
      `This starts a fresh leaderboard for everyone straight away. Scores so far this period won't carry over. The next reset after that is ${next}.`,
      'Change',
    );
    if (!ok) return;
    setError(null);
    setBusy('reset');
    try {
      await updateHouse(house!.id, { resetMonths: months });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function changeWallpaper(remove = false) {
    setError(null);
    setBusy('wall');
    try {
      const data = remove ? null : await pickFromLibrary();
      if (remove || data) await setWallpaper(house!.id, user!.uid, data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen edges={['left', 'right']}>
      <Label>House name or number</Label>
      <Input value={name} onChangeText={setName} maxLength={40} />
      <Button title="Save name" onPress={saveName} loading={busy === 'name'} disabled={!!busy || name.trim() === house.name} />

      <Label>Leaderboard resets</Label>
      <Subtitle>
        By default the leaderboard resets every 2 months. Changing it starts a fresh leaderboard for everyone.
      </Subtitle>
      <ChipRow>
        {RESET_OPTIONS.map((m) => (
          <Chip
            key={m}
            label={`${m === 1 ? 'Every month' : `Every ${m} months`}${m === DEFAULT_RESET_MONTHS ? ' (default)' : ''}`}
            selected={house.resetMonths === m}
            onPress={() => !busy && changeReset(m)}
          />
        ))}
      </ChipRow>

      <Label>Wallpaper</Label>
      <Subtitle>Shown faintly behind everyone&apos;s Home screen.</Subtitle>
      <View style={{ borderRadius: radius, overflow: 'hidden', aspectRatio: 9 / 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' }}>
        {wallpaper ? (
          <Image source={{ uri: wallpaper }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <Empty icon="image-outline">No wallpaper yet</Empty>
        )}
      </View>
      <Button title={wallpaper ? 'Change wallpaper' : 'Choose wallpaper'} icon="image-outline" variant="secondary" onPress={() => changeWallpaper()} loading={busy === 'wall'} disabled={!!busy} />
      {wallpaper && <Button title="Remove wallpaper" variant="ghost" onPress={() => changeWallpaper(true)} disabled={!!busy} />}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
