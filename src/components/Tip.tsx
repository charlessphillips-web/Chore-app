import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { haptics } from '../lib/haptics';
import { Icon } from './ui';
import { colors, fonts, space } from './theme';

const KEY = 'choreboard.tipsSeen';
let seen: Set<string> | null = null;
const listeners = new Set<() => void>();

async function load(): Promise<Set<string>> {
  if (seen) return seen;
  try {
    seen = new Set(JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]') as string[]);
  } catch {
    seen = new Set();
  }
  return seen;
}
function save() {
  AsyncStorage.setItem(KEY, JSON.stringify([...(seen ?? [])])).catch(() => {});
  listeners.forEach((l) => l());
}

/** Shows every tip again (Settings → Show tips again). */
export async function resetTips() {
  seen = new Set();
  save();
}

/**
 * A one-off tip shown the first time someone opens a screen. "Got it"
 * hides it for good (on this phone).
 */
export function Tip({ id, children }: { id: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let live = true;
    const check = () => load().then((s) => live && setShow(!s.has(id)));
    check();
    listeners.add(check);
    return () => {
      live = false;
      listeners.delete(check);
    };
  }, [id]);
  if (!show) return null;

  return (
    <View style={styles.tip} accessibilityRole="summary">
      <View style={styles.head}>
        <Icon name="bulb-outline" size={16} color={colors.text} />
        <Text style={styles.label}>TIP</Text>
      </View>
      <Text style={styles.text}>{children}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Got it"
        onPress={() => {
          haptics.tap();
          seen?.add(id);
          setShow(false);
          save();
        }}
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.btnText}>Got it</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tip: {
    borderRadius: 18, padding: space.md, gap: 8,
    backgroundColor: colors.cardRaised, borderWidth: 1, borderColor: colors.line,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.2, color: colors.muted },
  text: { fontSize: 15, lineHeight: 21, color: colors.text },
  btn: { alignSelf: 'flex-start', backgroundColor: colors.text, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, marginTop: 2 },
  btnText: { color: colors.inverse, fontSize: 14, fontWeight: '600' },
});
