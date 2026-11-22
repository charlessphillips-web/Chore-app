/**
 * "Notice when I'm away" (iPhone/Android app only). While you're at home you
 * switch it on; the phone remembers that spot (only on the phone, never
 * uploaded) and watches a 500 m circle around it. If you leave the circle,
 * a "Not home tonight?" notification is booked for 9:30pm; coming back home
 * before then cancels it. It never marks you away by itself: tapping the
 * notification opens the Away picker.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { awayAskTime } from './away';

const TASK = 'rotawise-home-geofence';
const ON_KEY = 'rotawise.homeAway';
const ASK_ID_KEY = 'rotawise.homeAway.askId';
/** Set by the app whenever it loads: the end of your current trip (ms), so we don't ask while you're already away. */
export const AWAY_UNTIL_KEY = 'rotawise.awayUntil';
const RADIUS_M = 500;

export const homeAwaySupported = true;

TaskManager.defineTask(TASK, async ({ data, error }) => {
  if (error || !data) return;
  const { eventType } = data as { eventType: Location.GeofencingEventType };
  const old = await AsyncStorage.getItem(ASK_ID_KEY).catch(() => null);
  if (old) await Notifications.cancelScheduledNotificationAsync(old).catch(() => {});
  await AsyncStorage.removeItem(ASK_ID_KEY).catch(() => {});
  if (eventType !== Location.GeofencingEventType.Exit) return;
  const until = Number((await AsyncStorage.getItem(AWAY_UNTIL_KEY).catch(() => null)) ?? 0);
  if (until > Date.now()) return; // already marked away
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Not home tonight? ✈️',
      body: 'Tap to pause your chores while you’re away.',
      data: { url: '/away-quick' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(awayAskTime(Date.now())) },
  });
  await AsyncStorage.setItem(ASK_ID_KEY, id).catch(() => {});
});

export async function isHomeAwayOn(): Promise<boolean> {
  return (await AsyncStorage.getItem(ON_KEY).catch(() => null)) === 'on';
}

/** Switch on, using where you are right now as home. Returns an error message, or null if it worked. */
export async function turnOnHomeAway(): Promise<string | null> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'Location access is needed. You can allow it in your phone’s Settings → Rotawise → Location.';
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') {
    return 'This needs location set to "Always" so it can notice when you leave. Phone Settings → Rotawise → Location → Always.';
  }
  const here = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  await Location.startGeofencingAsync(TASK, [{
    identifier: 'home', latitude: here.coords.latitude, longitude: here.coords.longitude, radius: RADIUS_M,
    notifyOnEnter: true, notifyOnExit: true,
  }]);
  await AsyncStorage.setItem(ON_KEY, 'on');
  return null;
}

export async function turnOffHomeAway(): Promise<void> {
  if (await TaskManager.isTaskRegisteredAsync(TASK)) await Location.stopGeofencingAsync(TASK).catch(() => {});
  const old = await AsyncStorage.getItem(ASK_ID_KEY).catch(() => null);
  if (old) await Notifications.cancelScheduledNotificationAsync(old).catch(() => {});
  await AsyncStorage.multiRemove([ON_KEY, ASK_ID_KEY]).catch(() => {});
}
