import { useEffect, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { WEB_URL } from '../lib/legal';
import { haptics } from '../lib/haptics';
import { Icon } from './ui';
import { colors, fonts, type } from './theme';

type Step = { key: string; title: string; desc: string; done: boolean; action?: () => void; actionLabel?: string };

/**
 * A step-by-step tutorial on Home for new users: each step teaches part of
 * the app and ticks itself off when you actually do it. Hides when finished
 * (or when you tap Hide).
 */
export function GettingStarted() {
  const { user, house, members, logs, isAdmin, notifStatus } = useApp();
  const key = `rotawise.gettingStarted.${house?.id}`;
  const [hidden, setHidden] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(key).then((v) => live && setHidden(v === 'hidden')).catch(() => live && setHidden(false));
    return () => { live = false; };
  }, [key]);
  if (!user || !house || hidden !== false) return null;

  const me = members.find((m) => m.uid === user.uid);
  const share = () => Share.share({ message: `Join our house "${house.name}" on Rotawise with code: ${house.code}\n${WEB_URL}` });
  const steps: Step[] = [
    { key: 'pic', title: 'Add a profile picture', desc: 'A photo or a character, so housemates know who did what.', done: !!me?.avatar,
      action: () => router.push('/settings/avatar'), actionLabel: 'Add' },
    { key: 'invite', title: 'Invite your housemates', desc: `Share your house code (${house.code}). Everyone joins with it.`, done: members.length > 1,
      action: share, actionLabel: 'Share' },
    ...(isAdmin ? [{ key: 'bins', title: 'Set your bin days', desc: 'Everyone gets a reminder at 8pm the night before.', done: house.bins.length > 0,
      action: () => router.push('/settings/bins'), actionLabel: 'Set' }] : []),
    { key: 'log', title: 'Log your first chore', desc: 'Tap a chore below → "I’ve done it" → take a photo.',
      done: !!me?.lastCompletedAt || logs.some((l) => l.userId === user.uid) },
    { key: 'check', title: 'Check a housemate’s photo', desc: 'When someone logs a chore, verify it (or send it back) in Checks.',
      done: logs.some((l) => l.reviewedBy === user.uid || l.checks.includes(user.uid)), action: () => router.push('/checks'), actionLabel: 'Checks' },
    ...(Platform.OS !== 'web' ? [{ key: 'notif', title: 'Turn on notifications', desc: 'So you know when it’s your turn and when bins go out.',
      done: notifStatus === 'granted', action: () => router.push('/settings/notifications'), actionLabel: 'Open' }] : []),
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;

  const hide = () => {
    haptics.tap();
    setHidden(true);
    AsyncStorage.setItem(key, 'hidden').catch(() => {});
  };

  return (
    <View style={styles.card} accessibilityLabel="Getting started">
      <View style={styles.head}>
        <Text style={type.label}>Getting started</Text>
        <Text style={styles.count}>{done} of {steps.length}</Text>
      </View>
      <View style={styles.bar}><View style={[styles.fill, { width: `${(done / steps.length) * 100}%` }]} /></View>
      {steps.map((s) => (
        <View key={s.key} style={styles.row}>
          <View style={[styles.tick, s.done && styles.tickOn]}>{s.done && <Icon name="checkmark" size={14} color={colors.inverse} />}</View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.title, s.done && styles.titleDone]}>{s.title}</Text>
            {!s.done && <Text style={type.small}>{s.desc}</Text>}
          </View>
          {!s.done && s.action && (
            <Pressable accessibilityRole="button" accessibilityLabel={`${s.actionLabel}: ${s.title}`} hitSlop={8}
              onPress={() => { haptics.tap(); s.action!(); }} style={styles.btn}>
              <Text style={styles.btnText}>{s.actionLabel}</Text>
            </Pressable>
          )}
        </View>
      ))}
      <Pressable accessibilityRole="button" accessibilityLabel="Hide getting started" onPress={hide} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
        <Text style={type.small}>Hide</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 18, gap: 12 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted },
  bar: { height: 3, backgroundColor: colors.line, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.text },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tick: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  tickOn: { backgroundColor: colors.text, borderColor: colors.text },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  titleDone: { color: colors.muted, textDecorationLine: 'line-through', fontWeight: '400' },
  btn: { backgroundColor: colors.text, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  btnText: { color: colors.inverse, fontSize: 13, fontWeight: '600' },
});
