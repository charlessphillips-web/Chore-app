import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApp } from '../../../context/AppContext';
import { setAways } from '../../../lib/db';
import { addAway, awayLabel, currentOrNextAway, endAway, makeAway, type Away } from '../../../lib/away';
import { toDobString } from '../../../lib/dob';
import { haptics } from '../../../lib/haptics';
import { Button, Card, ErrorText, Label, Loading, notify, Screen, Subtitle } from '../../../components/ui';
import { DateField } from '../../../components/DobPicker';
import { colors, type } from '../../../components/theme';

const fmt = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * "I'm away": pick the days you're not in the house. You aren't asked to do
 * chores then, and your fair share shrinks to match. Housemates can see it.
 */
export default function AwayScreen() {
  const { user, house, members } = useApp();
  const today = toDobString(new Date());
  const [from, setFrom] = useState(today);
  const [until, setUntil] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user || !house) return <Loading />;

  const me = members.find((m) => m.uid === user.uid);
  const aways = me?.aways ?? [];
  const now = new Date().getTime();
  const upcoming = aways.filter((a) => a.until > now).sort((a, b) => a.from - b.from);
  const current = currentOrNextAway(aways, now);
  const awayNow = !!current && current.from <= now;

  async function save(next: Away[], done: string) {
    setBusy(true);
    setError(null);
    try {
      await setAways(house!.id, user!.uid, next);
      haptics.success();
      notify('Saved', done);
      setUntil('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function add() {
    const a = makeAway(from, until, new Date().getTime());
    if (typeof a === 'string') return setError(a);
    save(addAway(aways, a), `You're away ${fmt(a.from)} to ${awayLabel(a)}. You won't be asked to do chores then.`);
  }

  return (
    <Screen edges={['left', 'right']}>
      <Subtitle>Going home, visiting a friend, on holiday? You won&apos;t be asked to do chores, and your fair share shrinks to match the days you&apos;re away. Your housemates can see it.</Subtitle>

      {awayNow && current && (
        <Card style={{ borderColor: colors.you, borderWidth: 1.5, gap: 10 }}>
          <Text style={type.heading}>✈️ You&apos;re away till {awayLabel(current)}</Text>
          <Text style={type.small}>Back early? Tap below and you&apos;ll be in the rota again straight away.</Text>
          <Button title="I'm back" onPress={() => save(endAway(aways, current, new Date().getTime()), 'Welcome back! You’re in the rota again.')} loading={busy} />
        </Card>
      )}

      <Label>Add a trip</Label>
      <Card style={{ gap: 12 }}>
        <View style={{ gap: 6 }}>
          <Text style={type.small}>First day away</Text>
          <DateField value={from} onChange={setFrom} label="First day away" min={today} />
        </View>
        <View style={{ gap: 6 }}>
          <Text style={type.small}>Last day away</Text>
          <DateField value={until} onChange={setUntil} label="Last day away" placeholder="Pick the last day" min={from || today} />
        </View>
        <ErrorText>{error}</ErrorText>
        <Button title="I'll be away" onPress={add} loading={busy} disabled={!from || !until} />
      </Card>

      {upcoming.filter((a) => a.from > now).length > 0 && (
        <>
          <Label>Coming up</Label>
          <Card style={{ gap: 4 }}>
            {upcoming.filter((a) => a.from > now).map((a) => (
              <View key={a.from} style={styles.row}>
                <Text style={[type.body, { flex: 1 }]}>{fmt(a.from)} → {awayLabel(a)}</Text>
                <Button title="Cancel" variant="ghost" style={{ paddingVertical: 8, paddingHorizontal: 12 }}
                  onPress={() => save(endAway(aways, a, new Date().getTime()), 'Trip cancelled.')} disabled={busy} />
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
