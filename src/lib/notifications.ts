import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// With the app open, NotificationCentre shows its own big purple banner
// instead of the small system one. Quiet ones make no sound.
Notifications.setNotificationHandler({
  handleNotification: async (n) => ({
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: n.request.content.data?.size !== 'quiet',
    shouldSetBadge: true,
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
        name: 'Your turn, bins and payments',
        importance: AndroidImportance.HIGH,
      });
      await Notifications.setNotificationChannelAsync('quiet', {
        name: 'Photos to check, reactions and summaries',
        importance: AndroidImportance.LOW,
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

