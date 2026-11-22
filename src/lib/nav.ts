import { router } from 'expo-router';

/** Back to where you came from, or Home if the screen was opened straight from a link. */
export function goBackOrHome() {
  if (router.canGoBack()) router.back();
  else router.replace('/home');
}
