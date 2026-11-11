import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../context/AppContext';
import { updateHouse } from '../lib/db';
import { addChore, SIZE_NAMES, type ChoreSize } from '../lib/chores';
import { haptics } from '../lib/haptics';
import { Button, Chip, ChipRow, ErrorText, Input, Label, Loading, Screen, Subtitle, Title } from '../components/ui';
import { type } from '../components/theme';

/** Admin: add a chore straight from the "+" tile on Home. */
export default function AddChore() {
  const { house, isAdmin } = useApp();
  const [name, setName] = useState('');
  const [needs, setNeeds] = useState('');
  const [size, setSize] = useState<ChoreSize>(2);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (!house) return <Loading />;
  if (!isAdmin) return <Screen edges={['left', 'right']}><Subtitle>Only the house admin can add chores.</Subtitle></Screen>;

  async function add() {
    const result = addChore(house!.chores, name, needs, size);
    if (typeof result === 'string') return setError(result);
    setError(null);
    setSaving(true);
    try {
      await updateHouse(house!.id, { chores: result });
      haptics.success();
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <Screen edges={['left', 'right']}>
      <Title>Add a chore</Title>
      <Subtitle>It appears as a tile on everyone&apos;s Home screen.</Subtitle>
      <Label>Chore</Label>
      <Input value={name} onChangeText={setName} placeholder="e.g. Recycling" maxLength={40} autoFocus accessibilityLabel="Chore name" />
      <Label>When it needs doing (optional)</Label>
      <Input value={needs} onChangeText={setNeeds} placeholder='e.g. "Recycling is full"' maxLength={60} accessibilityLabel="Needs doing wording" />
      <Text style={type.small}>This is what people tap to ask someone to do it. Leave it blank for &quot;{name.trim() || 'Chore'} needs doing&quot;.</Text>
      <Label>How big a job?</Label>
      <ChipRow>
        {([1, 2, 3] as ChoreSize[]).map((z) => <Chip key={z} label={`${SIZE_NAMES[z]} · ${z} pt${z > 1 ? 's' : ''}`} selected={size === z} onPress={() => setSize(z)} />)}
      </ChipRow>
      <ErrorText>{error}</ErrorText>
      <Button title="Add chore" icon="add" onPress={add} loading={saving} disabled={!name.trim()} />
      <Text style={type.small}>To switch chores off or delete ones you added: Settings → Chores.</Text>
    </Screen>
  );
}
