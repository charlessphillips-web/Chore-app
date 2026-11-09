/**
 * Gentle haptic feedback. Phones only: the web version (Safari) can't
 * vibrate, so these do nothing there. Can be turned off in Settings.
 */
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'choreboard.haptics';
let enabled = true;
AsyncStorage.getItem(KEY).then((v) => { if (v === 'off') enabled = false; }).catch(() => {});

const on = () => enabled && Platform.OS !== 'web';
const safe = (p: Promise<void>) => { p.catch(() => {}); };

export const haptics = {
  /** Any button press. */
  tap: () => on() && safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Tabs, chips, switches. */
  select: () => on() && safe(Haptics.selectionAsync()),
  /** Chore logged, verified, offer accepted. */
  success: () => on() && safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Sent back, something went wrong. */
  warning: () => on() && safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** A firmer bump (e.g. "hold to start" completing). */
  heavy: () => on() && safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  isEnabled: () => enabled,
  setEnabled(v: boolean) {
    enabled = v;
    AsyncStorage.setItem(KEY, v ? 'on' : 'off').catch(() => {});
  },
};
