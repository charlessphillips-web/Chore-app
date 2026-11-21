import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { useApp } from '../context/AppContext';
import { setAways } from '../lib/db';
import { addAway, makeAway } from '../lib/away';
import { toDobString } from '../lib/dob';
import { haptics } from '../lib/haptics';
import { ErrorText, Loading, Screen, Subtitle, Title } from '../components/ui';
import { colors } from '../components/theme';

/** The Away toggle on Home: "When are you back?" in one tap. */
export default function AwayQuick() {
  const { user, house, members } = useApp();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user || !house) return <Loading />;

  const today = new Date();
  const plus = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return d; };
  const sunday = plus((7 - today.getDay()) % 7);
  const day = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const options = [
    { label: 'Just today', sub: day(today), last: today },
    ...(today.getDay() === 0 ? [] : [{ label: 'The weekend', sub: `Till ${day(sunday)}`, last: sunday }]),
    { label: 'A week', sub: `Till ${day(plus(6))}`, last: plus(6) },
    { label: 'Two weeks', sub: `Till ${day(plus(13))}`, last: plus(13) },
  ];

  async function pick(last: Date) {
    const a = makeAway(toDobString(today), toDobString(last), new Date().getTime());
    if (typeof a === 'string') return setError(a);
    setBusy(true);
    try {
      const me = members.find((m) => m.uid === user!.uid);
      await setAways(house!.id, user!.uid, addAway(me?.aways, a));
      haptics.success();
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: '' }} />
      <Title>Going away? ✈️</Title>
      <Subtitle>You won&apos;t be asked to do chores, and your fair share shrinks for the days you&apos;re gone. Your housemates see you&apos;re away.</Subtitle>
      <View style={styles.card}>
        {options.map((o, i) => (
          <Pressable key={o.label} disabled={busy} onPress={() => pick(o.last)} accessibilityRole="button" accessibilityLabel={o.label}
            style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && { opacity: 0.6 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{o.label}</Text>
              <Text style={styles.sub}>{o.sub}</Text>
            </View>
            <Text style={styles.go}>›</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => router.replace('/settings/away')} accessibilityRole="button" accessibilityLabel="Pick dates"
          style={({ pressed }) => [styles.row, styles.divider, pressed && { opacity: 0.6 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Pick dates</Text>
            <Text style={styles.sub}>Going later, or for longer</Text>
          </View>
          <Text style={styles.go}>›</Text>
        </Pressable>
      </View>
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 18, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  label: { fontSize: 17, fontWeight: '600', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  go: { fontSize: 24, color: colors.muted },
});
