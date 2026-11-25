/**
 * Everything to do with notifications while the app is running:
 *  - the big purple banner that drops in when one arrives with the app open
 *  - the buttons on notifications ("👍 Looks good", "📸 I've done it")
 *  - tapping a notification opens the right screen
 *  - the red number on the app icon (chores given to you + photos to check)
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { verifyChore } from '../lib/db';
import { needsCheckBy } from '../lib/review';
import { haptics } from '../lib/haptics';
import { toast } from './Celebration';

interface Banner { id: string; title: string; body: string; url: string | null; size: string }

const urlOf = (n: Notifications.Notification) => {
  const u = n.request.content.data?.url;
  return typeof u === 'string' && u.startsWith('/') ? u : null;
};

/** The buttons iPhone/Android show on our notifications (ids match pushMessages' categories). */
async function registerButtons() {
  await Notifications.setNotificationCategoryAsync('check', [
    { identifier: 'verify', buttonTitle: '👍 Looks good', options: { opensAppToForeground: true } },
    { identifier: 'open', buttonTitle: 'Open photo', options: { opensAppToForeground: true } },
  ]);
  await Notifications.setNotificationCategoryAsync('bins', [
    { identifier: 'open', buttonTitle: '📸 I’ve done it', options: { opensAppToForeground: true } },
  ]);
}

export function NotificationCentre() {
  const { user, profile, house, logs, openRequests } = useApp();
  const insets = useSafeAreaInsets();
  const [banner, setBanner] = useState<Banner | null>(null);
  const [y] = useState(() => new Animated.Value(-200));
  const pending = useRef<Notifications.NotificationResponse | null>(null);
  const handled = useRef<string | null>(null);
  const ready = !!(user && profile && house);
  const me = ready ? { uid: user!.uid, username: profile!.username, houseId: house!.id } : null;
  const meRef = useRef(me);
  useEffect(() => { meRef.current = me; });

  // A tapped notification or button. Waits until the house has loaded.
  const respond = (r: Notifications.NotificationResponse) => {
    const who = meRef.current;
    if (!who) { pending.current = r; return; }
    const key = `${r.notification.request.identifier}:${r.actionIdentifier}`;
    if (handled.current === key) return;
    handled.current = key;
    const data = r.notification.request.content.data ?? {};
    const url = urlOf(r.notification);
    if (r.actionIdentifier === 'verify' && typeof data.logId === 'string') {
      verifyChore(who.houseId, data.logId, { uid: who.uid, username: who.username })
        .then(() => { haptics.success(); toast('Checked ✅ Thanks!'); })
        .catch((e) => { toast((e as Error).message); if (url) router.push(url as never); });
      return;
    }
    if (url) setTimeout(() => router.push(url as never), 300);
  };
  const respondRef = useRef(respond);
  useEffect(() => { respondRef.current = respond; });

  useEffect(() => {
    if (Platform.OS === 'web') return;
    registerButtons().catch(() => {});
    Notifications.getLastNotificationResponseAsync().then((r) => r && respondRef.current(r)).catch(() => {});
    const tap = Notifications.addNotificationResponseReceivedListener((r) => respondRef.current(r));
    // With the app open: our own banner instead of the small system one.
    const got = Notifications.addNotificationReceivedListener((n) => {
      const c = n.request.content;
      const size = typeof c.data?.size === 'string' ? c.data.size : 'normal';
      if (size === 'big') haptics.warning(); else if (size === 'normal') haptics.tap();
      setBanner({ id: n.request.identifier, title: c.title ?? 'Rotawise', body: c.body ?? '', url: urlOf(n), size });
    });
    return () => { tap.remove(); got.remove(); };
  }, []);

  // Deal with a notification tapped before the app had loaded.
  useEffect(() => {
    if (ready && pending.current) {
      const r = pending.current;
      pending.current = null;
      respondRef.current(r);
    }
  }, [ready]);

  // Slide in, wait, slide out.
  useEffect(() => {
    if (!banner) return;
    Animated.spring(y, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 6 }).start();
    const t = setTimeout(() => {
      Animated.timing(y, { toValue: -200, duration: 250, useNativeDriver: true }).start(() => setBanner((b) => (b?.id === banner.id ? null : b)));
    }, banner.size === 'big' ? 7000 : 5000);
    return () => clearTimeout(t);
  }, [banner, y]);

  // Red number on the icon.
  const uid = user?.uid;
  const badge = uid
    ? openRequests.filter((r) => r.assignedTo === uid).length + logs.filter((l) => needsCheckBy(l, uid)).length
    : 0;
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Notifications.setBadgeCountAsync(badge).catch(() => {});
  }, [badge]);

  if (!banner) return null;
  const close = () => Animated.timing(y, { toValue: -200, duration: 200, useNativeDriver: true }).start(() => setBanner(null));
  return (
    <Animated.View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 6, transform: [{ translateY: y }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${banner.title}. ${banner.body}`}
        onPress={() => { close(); if (banner.url) router.push(banner.url as never); }}
        style={({ pressed }) => [styles.banner, { backgroundColor: BANNER[banner.size] ?? BANNER.normal }, pressed && { opacity: 0.85 }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={2}>{banner.title}</Text>
          {!!banner.body && <Text style={styles.body} numberOfLines={2}>{banner.body}</Text>}
        </View>
        {banner.url && <View style={styles.go}><Text style={[styles.goText, { color: BANNER[banner.size] ?? BANNER.normal }]}>Open</Text></View>}
      </Pressable>
    </Animated.View>
  );
}

/** Amber = big (your turn, bins, pay up), yellow = normal (nudges, offers), white = quiet (checks, reactions). */
const BANNER: Record<string, string> = { big: '#FF9F0A', normal: '#FFD60A', quiet: '#F2F2F4' };
const INK = '#141414';

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 10, right: 10, zIndex: 100 },
  banner: {
    borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  title: { color: INK, fontSize: 16, fontWeight: '700' },
  body: { color: 'rgba(20,20,20,0.75)', fontSize: 14, marginTop: 2 },
  go: { backgroundColor: INK, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12 },
  goText: { fontWeight: '700', fontSize: 14 },
});
