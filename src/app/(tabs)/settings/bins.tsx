import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useApp } from '../../../context/AppContext';
import { updateHouse } from '../../../lib/db';
import { BIN_NAMES, MAX_BINS, nextCollections, scheduleLabel, type BinSchedule } from '../../../lib/bins';
import { toDobString } from '../../../lib/dob';
import { haptics } from '../../../lib/haptics';
import { DateField } from '../../../components/DobPicker';
import { Button, Card, Chip, ChipRow, confirm, ErrorText, Icon, Input, Label, ListGroup, ListRow, Loading, Screen, Subtitle } from '../../../components/ui';
import { colors, space, type } from '../../../components/theme';

/** Admin: when each bin goes out. Everyone gets a reminder at 8pm the night before. */
export default function BinDays() {
  const { house, isAdmin } = useApp();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState(BIN_NAMES[0]);
  const [custom, setCustom] = useState('');
  const [every, setEvery] = useState<1 | 2>(1);
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!house) return <Loading />;
  const today = toDobString(new Date());
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  async function save(bins: BinSchedule[]) {
    setBusy(true);
    setError(null);
    try {
      await updateHouse(house!.id, { bins });
      haptics.success();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    const n = name === 'Other' ? custom.trim() : name;
    if (n.length < 2) return setError('Give the bin a name.');
    if (!next) return setError('Pick the date of the next collection.');
    const bin: BinSchedule = { id: `${Date.now()}`, name: n, every, anchor: next };
    if (await save([...house!.bins, bin])) {
      setAdding(false);
      setNext('');
      setCustom('');
    }
  }

  return (
    <Screen edges={['left', 'right']}>
      <Subtitle>
        Add your bins and everyone in the house gets a reminder at 8pm the night before they go out. Check your
        council&apos;s website for your collection days.
      </Subtitle>

      {house.bins.length > 0 ? (
        <ListGroup>
          {house.bins.map((b) => {
            const [n] = nextCollections(b, new Date(), 1);
            return (
              <ListRow
                key={b.id}
                icon="trash-outline"
                title={b.name}
                subtitle={`${scheduleLabel(b)} · next: ${n ? fmt(n) : '–'}`}
                right={isAdmin ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${b.name}`} hitSlop={8}
                    onPress={async () => {
                      if (await confirm(`Remove ${b.name}?`, 'Reminders for it will stop.', 'Remove')) save(house.bins.filter((x) => x.id !== b.id));
                    }}>
                    <Icon name="close-circle-outline" size={20} color={colors.muted} />
                  </Pressable>
                ) : undefined}
              />
            );
          })}
        </ListGroup>
      ) : (
        <Card><Text style={type.small}>No bins added yet.</Text></Card>
      )}

      {!isAdmin && <Text style={type.small}>Only the house admin can change bin days.</Text>}

      {isAdmin && !adding && house.bins.length < MAX_BINS && (
        <Button title="Add a bin" icon="add" variant="secondary" onPress={() => setAdding(true)} />
      )}

      {isAdmin && adding && (
        <Card>
          <Label>Which bin?</Label>
          <ChipRow>
            {[...BIN_NAMES, 'Other'].map((b) => <Chip key={b} label={b} selected={name === b} onPress={() => setName(b)} />)}
          </ChipRow>
          {name === 'Other' && <Input value={custom} onChangeText={setCustom} placeholder="e.g. Cardboard" maxLength={30} accessibilityLabel="Bin name" />}
          <Label>How often?</Label>
          <ChipRow>
            <Chip label="Every week" selected={every === 1} onPress={() => setEvery(1)} />
            <Chip label="Every 2 weeks" selected={every === 2} onPress={() => setEvery(2)} />
          </ChipRow>
          <Label>Next collection</Label>
          <DateField value={next} onChange={setNext} label="Next collection" placeholder="Pick the date" min={today} />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title="Cancel" variant="ghost" onPress={() => setAdding(false)} style={{ flex: 1 }} />
            <Button title="Add" onPress={add} loading={busy} style={{ flex: 1 }} />
          </View>
        </Card>
      )}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
