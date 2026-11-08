import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Show notifications as banners even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Where this phone stands on notifications:
 *  - 'granted':      on
 *  - 'ask':          not asked yet, we can show the iPhone/Android pop-up
 *  - 'denied':       they said no; only their phone's Settings can change it
 *  - 'unavailable':  web browser or simulator
 */
export type NotificationStatus = 'granted' | 'ask' | 'denied' | 'unavailable';

export async function getNotificationStatus(): Promise<NotificationStatus> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unavailable';
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.granted) return 'granted';
    return p.canAskAgain ? 'ask' : 'denied';
  } catch {
    return 'unavailable';
  }
}

/**
 * Returns this device's Expo push token, or null if unavailable. Only shows
 * the permission pop-up when `ask` is true (we explain why first, because
 * an iPhone only lets an app ask once).
 */
export async function registerForPushNotifications({ ask }: { ask: boolean }): Promise<string | null> {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Chore requests',
        importance: AndroidImportance.HIGH,
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && ask) ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn('No EAS projectId — run `npx eas-cli@latest init` to enable push notifications.');
      return null;
    }
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (e) {
    console.warn('Push registration failed', e);
    return null;
  }
}

/** Sends a push via Expo's push service. Returns true if Expo accepted it. */
export async function sendPush(
  to: string[],
  msg: { title: string; body: string; data?: Record<string, unknown> },
): Promise<boolean> {
  if (to.length === 0) return false;
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(to.map((t) => ({ to: t, sound: 'default', ...msg }))),
    });
    const json = await res.json();
    return res.ok && Array.isArray(json?.data) && json.data.some((r: { status?: string }) => r.status === 'ok');
  } catch {
    return false;
  }
}
