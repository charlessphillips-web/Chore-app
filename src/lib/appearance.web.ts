/** Website version of lib/appearance: the browser's local storage, then a page refresh. */
export type AppearancePref = 'dark' | 'light' | 'system';
const KEY = 'rotawise.appearance';

export function readAppearance(): AppearancePref {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return v === 'light' || v === 'system' ? v : 'dark';
  } catch {
    return 'dark';
  }
}

export async function saveAppearanceAndReload(pref: AppearancePref): Promise<void> {
  try { localStorage.setItem(KEY, pref); } catch { /* private mode: stays as is */ }
  window.location.reload();
}
