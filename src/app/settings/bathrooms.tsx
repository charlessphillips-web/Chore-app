import { useState } from 'react';
import { Text, View } from 'react-native';
import { useApp } from '../../context/AppContext';
import { updateHouse } from '../../lib/db';
import { addBathroom, BATHROOM_TASKS, bathroomGroups, bathroomName, QUICK_BATHROOMS, removeBathroom, setBathroomUsers, type HouseChore } from '../../lib/chores';
import { track } from '../../lib/analytics';
import { haptics } from '../../lib/haptics';
import { Button, Card, Chip, ChipRow, confirm, ErrorText, Input, Label, Loading, notify, Screen, Subtitle } from '../../components/ui';
import { colors, type } from '../../components/theme';

/**
 * Admin: one entry per bathroom (e.g. per floor), and who uses it. Only
 * those people get asked to clean it. Each bathroom has small tasks (toilet,
 * shower, sink) and a "whole bathroom" clean worth all three.
 */
export default function BathroomsSettings() {
  const { house, members, isAdmin } = useApp();
  const [name, setName] = useState('');
  const [users, setUsers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (!house) return <Loading />;
  if (!isAdmin) return <Screen edges={['left', 'right']}><Subtitle>Only the house admin can set up bathrooms.</Subtitle></Screen>;

  const groups = bathroomGroups(house.chores);
  const usersOf = (g: string) => house.chores.find((c) => c.group === g)?.users ?? [];
  const save = async (chores: HouseChore[]) => {
    try {
      await updateHouse(house.id, { chores });
      haptics.success();
    } catch (e) {
      notify('Could not save', (e as Error).message);
    }
  };
  const toggle = (list: string[], uid: string) => (list.includes(uid) ? list.filter((u) => u !== uid) : [...list, uid]);

  async function add() {
    const result = addBathroom(house!.chores, name, users);
    if (typeof result === 'string') return setError(result);
    setError(null);
    setSaving(true);
    await save(result);
    track('bathroom_added');
    setName('');
    setUsers([]);
    setSaving(false);
  }

  return (
    <Screen edges={['left', 'right']}>
      <Subtitle>
        Add each shared bathroom and pick who uses it. Only they get asked to clean it. Private en-suites don&apos;t need
        adding.
      </Subtitle>
      <Card style={{ gap: 6 }}>
        <Text style={type.small}>Each bathroom gets these, so people can do a quick bit or the lot:</Text>
        {BATHROOM_TASKS.map((t) => (
          <Text key={t.key} style={type.body}>
            {t.name} <Text style={type.small}>· {t.size} pt{t.size > 1 ? 's' : ''}{t.key === 'whole' ? ' (all three)' : ''}</Text>
          </Text>
        ))}
      </Card>

      {groups.map((g) => (
        <View key={g} style={{ gap: 8 }}>
          <Label>{g}</Label>
          <Card style={{ gap: 10 }}>
            <Text style={type.small}>Who uses it? (nobody picked = everyone)</Text>
            <ChipRow>
              {members.map((m) => (
                <Chip key={m.uid} label={m.username} selected={usersOf(g).includes(m.uid)}
                  onPress={() => save(setBathroomUsers(house.chores, g, toggle(usersOf(g), m.uid)))} />
              ))}
            </ChipRow>
            <Button title="Remove this bathroom" variant="ghost" style={{ paddingVertical: 8 }}
              onPress={async () => {
                if (await confirm(`Remove ${g}?`, 'Its chores come off the list. Points already earned stay.', 'Remove')) {
                  await save(removeBathroom(house.chores, g));
                }
              }} />
          </Card>
        </View>
      ))}

      <Label>Add a bathroom</Label>
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {QUICK_BATHROOMS.filter((n) => !groups.includes(bathroomName(n))).map((n) => (
            <Chip key={n} label={n} selected={name === n} onPress={() => setName(n)} />
          ))}
        </View>
        <Input value={name} onChangeText={setName} placeholder='e.g. "Top floor" or "Downstairs loo"' maxLength={30} accessibilityLabel="Bathroom name" />
        <Text style={type.small}>Who uses it? (skip = everyone)</Text>
        <ChipRow>
          {members.map((m) => (
            <Chip key={m.uid} label={m.username} selected={users.includes(m.uid)} onPress={() => setUsers(toggle(users, m.uid))} />
          ))}
        </ChipRow>
        <ErrorText>{error}</ErrorText>
        <Button title="Add bathroom" icon="add" onPress={add} loading={saving} disabled={!name.trim()} />
      </Card>
      <Text style={[type.small, { color: colors.faint }]}>Tip: one per floor works well, e.g. &quot;Top floor&quot; and &quot;Ground floor&quot;.</Text>
    </Screen>
  );
}
