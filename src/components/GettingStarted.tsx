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
  const firstChore = house.chores.find((c) => c.active)?.key;
  const share = () => Share.share({ message: `Join our house "${house.name}" on Rotawise with code: ${house.code}\n${WEB_URL}` });
  const steps: Step[] = [
    { key: 'pic', title: 'Add a profile picture', desc: 'A photo or a character, so housemates know who did what.', done: !!me?.avatar,
      action: () => router.push('/settings/avatar'), actionLabel: 'Add' },
    { key: 'invite', title: 'Invite your housemates', desc: `Share your house code (${house.code}). Everyone joins with it.`, done: members.length > 1,
      action: share, actionLabel: 'Share' },
    ...(isAdmin ? [{ key: 'bins', title: 'Set your bin days', desc: 'Everyone gets a reminder at 8pm the night before.', done: house.bins.length > 0,
      action: () => router.push('/settings/bins'), actionLabel: 'Set' }] : []),
    { key: 'log', title: 'Log your first chore', desc: 'Tap a chore → "I’ve done it" → take a photo.',
      action: firstChore ? () => router.push({ pathname: '/chore/[key]', params: { key: firstChore } }) : undefined, actionLabel: 'Log',
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
      {steps.map((s, i) => {
        const tappable = !s.done && !!s.action;
        return (
          <Pressable
            key={s.key}
            accessibilityRole={tappable ? 'button' : undefined}
            accessibilityLabel={s.done ? `${s.title}, done` : s.title}
            disabled={!tappable}
            onPress={() => { haptics.tap(); s.action!(); }}
            style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && { opacity: 0.6 }]}
          >
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[styles.title, s.done && styles.titleDone]}>{s.title}</Text>
              {!s.done && <Text style={type.small}>{s.desc}</Text>}
            </View>
            {s.done ? <Icon name="checkmark" size={20} color={colors.you} /> : tappable && <Icon name="chevron-forward" size={18} color={colors.muted} />}
          </Pressable>
        );
      })}
      <Pressable accessibilityRole="button" accessibilityLabel="Hide getting started" onPress={hide} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
        <Text style={type.small}>Hide</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 18, gap: 10 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted },
  bar: { height: 3, backgroundColor: colors.line, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  titleDone: { color: colors.muted, textDecorationLine: 'line-through', fontWeight: '400' },
});
