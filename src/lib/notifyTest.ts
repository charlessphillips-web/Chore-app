/**
 * "Send me a test notification": checks every link in the chain and says
 * which one is broken.
 *   1. Phone allows Rotawise notifications
 *   2. This phone has a push address (Expo token)
 *   3. That address is saved (privately, for the Rotawise server)
 *   4. The phone can show a notification at all (a local one)
 *   5. Expo → Apple delivers a real push (with Expo's error if not)
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getNotificationStatus, registerForPushNotifications } from './notifications';
import { setPushToken } from './db';

export interface TestStep { label: string; ok: boolean; detail?: string }

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runNotificationTest(opts: { houseId: string; uid: string }): Promise<TestStep[]> {
  const steps: TestStep[] = [];
  if (Platform.OS === 'web') {
    return [{ label: 'Notifications only work in the iPhone/Android app', ok: false, detail: 'The website can’t receive them. Open Rotawise from TestFlight.' }];
  }

  const status = await getNotificationStatus();
  const allowed = status === 'granted' || (status === 'ask' && !!(await registerForPushNotifications({ ask: true })));
  steps.push({
    label: 'Your phone allows Rotawise notifications',
    ok: allowed,
    detail: allowed ? undefined : 'iPhone Settings → Notifications → Rotawise → turn on Allow Notifications.',
  });
  if (!allowed) return steps;

  const token = await registerForPushNotifications({ ask: false });
  steps.push({ label: 'This phone has a push address', ok: !!token, detail: token ? undefined : 'Couldn’t get one from Expo. Check you have internet and try again.' });
  if (!token) return steps;

  let saved = false;
  await setPushToken(opts.houseId, opts.uid, token, true).then(() => { saved = true; }).catch(() => {});
  steps.push({
    label: 'Rotawise can reach this phone',
    ok: saved,
    detail: saved ? undefined : 'Couldn’t save your push address. Try again.',
  });

  try {
    await Notifications.scheduleNotificationAsync({ content: { title: 'Test 1 of 2 ✅', body: 'Your phone can show Rotawise notifications.' }, trigger: null });
    steps.push({ label: 'Your phone can show notifications', ok: true });
  } catch (e) {
    steps.push({ label: 'Your phone can show notifications', ok: false, detail: (e as Error).message });
  }

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify([{ to: token, sound: 'default', title: 'Test 2 of 2 ✅', body: 'Push notifications work. You’re all set.' }]),
    });
    const json = await res.json();
    const ticket = json?.data?.[0];
    if (ticket?.status !== 'ok') {
      steps.push({ label: 'Expo accepted the test push', ok: false, detail: `${ticket?.details?.error ?? ''} ${ticket?.message ?? JSON.stringify(json?.errors ?? json)}`.trim() });
      return steps;
    }
    steps.push({ label: 'Expo accepted the test push', ok: true });
    // Ask Expo whether Apple actually took it (catches a missing/wrong Apple push key).
    await wait(5000);
    const r = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [ticket.id] }),
    });
    const receipt = (await r.json())?.data?.[ticket.id];
    if (!receipt) steps.push({ label: 'Apple delivered it', ok: true, detail: 'Still on its way. If nothing arrives in a minute, tell Charles.' });
    else steps.push({
      label: 'Apple delivered it',
      ok: receipt.status === 'ok',
      detail: receipt.status === 'ok' ? undefined : `${receipt.details?.error ?? ''} ${receipt.message ?? ''}`.trim(),
    });
  } catch (e) {
    steps.push({ label: 'Expo accepted the test push', ok: false, detail: `No connection to Expo: ${(e as Error).message}` });
  }
  return steps;
}
