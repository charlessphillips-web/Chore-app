import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useApp } from '../../../context/AppContext';
import { updateHouse } from '../../../lib/db';
import { addChore, choreSize, DEFAULT_CHORES, SIZE_NAMES, type ChoreSize, type HouseChore } from '../../../lib/chores';
import { Button, Card, Chip, ChipRow, confirm, ErrorText, Icon, Input, Label, Loading, notify, Screen, Subtitle } from '../../../components/ui';
import { colors, space, type } from '../../../components/theme';

/** Admin: switch chores on/off and add new ones. */
export default function ChoresSettings() {
  const { house, isAdmin } = useApp();
  const [name, setName] = useState('');
  const [needs, setNeeds] = useState('');
  const [size, setSize] = useState<ChoreSize>(2);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (!house) return <Loading />;
  if (!isAdmin) return <Screen edges={['left', 'right']}><Subtitle>Only the house admin can change chores.</Subtitle></Screen>;

  const save = async (chores: HouseChore[]) => {
    try {
      await updateHouse(house.id, { chores });
    } catch (e) {
      notify('Could not save', (e as Error).message);
    }
  };
  const resize = (key: string, s: ChoreSize) =>
    save(house.chores.map((c) => (c.key === key ? { ...c, size: s } : c)));
  const toggle = (key: string, active: boolean) =>
    save(house.chores.map((c) => (c.key === key ? { ...c, active } : c)));
  const isDefault = (key: string) => DEFAULT_CHORES.some((c) => c.key === key);
  const remove = async (c: HouseChore) => {
    if (await confirm(`Delete "${c.name}"?`, 'It will be removed from the chore list.', 'Delete')) {
      await save(house.chores.filter((x) => x.key !== c.key));
    }
  };

  async function add() {
    const result = addChore(house!.chores, name, needs, size);
    if (typeof result === 'string') return setError(result);
    setError(null);
    setSaving(true);
    await save(result);
    setName('');
    setNeeds('');
    setSaving(false);
  }

  return (
    <Screen edges={['left', 'right']}>
      <Subtitle>
        Switch off chores your house doesn&apos;t need, and set how big each job is: Quick = 1 point, Medium = 2, Big = 3.
        Changes count from now on.
      </Subtitle>
      <Card style={{ paddingVertical: space.xs }}>
        {house.chores.map((c, i) => (
          <View key={c.key} style={[styles.row, i < house.chores.length - 1 && styles.divider]}>
            <View style={{ flex: 1 }}>
              <Text style={[type.body, !c.active && { color: colors.muted }]}>{c.name}</Text>
              <Text style={type.small}>&quot;{c.needs}&quot; · {SIZE_NAMES[choreSize(c)]} ({choreSize(c)} pt{choreSize(c) > 1 ? 's' : ''})</Text>
              {c.active && (
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                  {([1, 2, 3] as ChoreSize[]).map((z) => (
                    <Chip key={z} label={SIZE_NAMES[z]} selected={choreSize(c) === z} onPress={() => resize(c.key, z)} />
                  ))}
                </View>
              )}
            </View>
            {!isDefault(c.key) && (
              <Text accessibilityRole="button" accessibilityLabel={`Delete ${c.name}`} onPress={() => remove(c)} style={{ padding: 6 }}>
                <Icon name="trash-outline" size={18} color={colors.muted} />
              </Text>
            )}
            <Switch
              accessibilityLabel={`${c.name} on or off`}
              value={c.active}
              onValueChange={(v) => toggle(c.key, v)}
              trackColor={{ true: colors.text, false: colors.line }}
              thumbColor={c.active ? colors.inverse : colors.muted}
              {...({ activeThumbColor: colors.inverse, activeTrackColor: colors.text } as object)}
            />
          </View>
        ))}
      </Card>

      <Label>Add a new chore</Label>
      <Input value={name} onChangeText={setName} placeholder="Chore, e.g. Recycling" maxLength={40} />
      <Input value={needs} onChangeText={setNeeds} placeholder='When it needs doing, e.g. "Recycling is full"' maxLength={60} />
      <ChipRow>
        {([1, 2, 3] as ChoreSize[]).map((z) => <Chip key={z} label={`${SIZE_NAMES[z]} · ${z} pt${z > 1 ? 's' : ''}`} selected={size === z} onPress={() => setSize(z)} />)}
      </ChipRow>
      <ErrorText>{error}</ErrorText>
      <Button title="Add chore" icon="add" onPress={add} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
});
