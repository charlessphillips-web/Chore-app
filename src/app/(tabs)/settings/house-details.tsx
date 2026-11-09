import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../../../context/AppContext';
import { setResetRule, setWallpaper, updateHouse } from '../../../lib/db';
import { pickFromLibrary } from '../../../lib/photos';
import { customError, DEFAULT_RESET_MONTHS, periodEnd, RESET_OPTIONS, resetLabel, type ResetRule } from '../../../lib/period';
import { toDobString } from '../../../lib/dob';
import { DateField } from '../../../components/DobPicker';
import { Button, Card, Chip, ChipRow, confirm, Empty, ErrorText, Input, Label, Loading, notify, Screen, Subtitle } from '../../../components/ui';
import { colors, radius, type } from '../../../components/theme';

/** Admin: house name, leaderboard reset and wallpaper. */
export default function HouseDetails() {
  const { user, house, isAdmin, wallpaper } = useApp();
  const [name, setName] = useState(house?.name ?? '');
  const [busy, setBusy] = useState<'name' | 'wall' | 'reset' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reset = house?.reset;
  const [customOpen, setCustomOpen] = useState(false);
  const [start, setStart] = useState(typeof reset === 'object' ? reset.start : '');
  const [end, setEnd] = useState(typeof reset === 'object' ? reset.end : '');
  if (!house || !user) return <Loading />;
  const isCustom = typeof house.reset === 'object';
  const today = toDobString(new Date());
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

  async function changeReset(rule: ResetRule) {
    const next = periodEnd(new Date(), rule).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
    const ok = await confirm(
      typeof rule === 'object' ? 'Use these dates?' : `Reset ${resetLabel(rule)}?`,
      `This starts a fresh leaderboard for everyone straight away. Scores so far this period won't carry over. The next reset is ${next}.`,
      'Change',
    );
    if (!ok) return;
    setError(null);
    setBusy('reset');
    try {
      await setResetRule(house!.id, rule);
      if (typeof rule !== 'object') setCustomOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function saveCustom() {
    const err = customError(start, end);
    if (err) return setError(err);
    changeReset({ start, end });
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
            selected={!customOpen && house.reset === m}
            onPress={() => !busy && house.reset !== m && changeReset(m)}
          />
        ))}
        <Chip label="Custom dates" selected={customOpen || isCustom} onPress={() => setCustomOpen(true)} />
      </ChipRow>
      {(customOpen || isCustom) && (
        <Card>
          <Text style={type.small}>
            Pick when this leaderboard starts and ends, e.g. your uni term. When it ends, a new one starts with the same
            length, until you change it.
          </Text>
          <Text style={styles.fieldLabel}>Start date</Text>
          <DateField value={start} onChange={setStart} label="Start date" placeholder="Choose start date" max={today} />
          <Text style={styles.fieldLabel}>End date (last day)</Text>
          <DateField value={end} onChange={setEnd} label="End date" placeholder="Choose end date" min={today} />
          <Button
            title={isCustom ? 'Save new dates' : 'Use these dates'}
            onPress={saveCustom}
            loading={busy === 'reset'}
            disabled={!!busy || !start || !end || (typeof house.reset === 'object' && start === house.reset.start && end === house.reset.end)}
          />
        </Card>
      )}

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

const styles = StyleSheet.create({
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 4 },
});
