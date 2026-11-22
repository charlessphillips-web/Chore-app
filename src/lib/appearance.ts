/**
 * Dark / Light / Match my phone. Read once, synchronously, when the app
 * starts (all screens pick their colours then), so changing it restarts
 * the app for a moment. Phone version: a tiny on-device key-value store.
 */
import { reloadAppAsync } from 'expo';
import Storage from 'expo-sqlite/kv-store';

export type AppearancePref = 'dark' | 'light' | 'system';
const KEY = 'rotawise.appearance';

export function readAppearance(): AppearancePref {
  try {
    const v = Storage.getItemSync(KEY);
    return v === 'light' || v === 'system' ? v : 'dark';
  } catch {
    return 'dark';
  }
}

export async function saveAppearanceAndReload(pref: AppearancePref): Promise<void> {
  Storage.setItemSync(KEY, pref);
  await reloadAppAsync('Appearance changed');
}
