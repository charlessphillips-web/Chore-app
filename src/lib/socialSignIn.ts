/**
 * Phone version: Sign in with Apple (iPhone). Google on phones needs its own
 * Google client ID, so it's website-only for now.
 */
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { linkWithCredential, OAuthProvider } from 'firebase/auth';
import { auth } from './firebase';
import { signInWithCred, type Provider } from './socialCore';

export { connected, socialError, PROVIDER_NAMES, type Provider } from './socialCore';

/** Which buttons to show on this device. */
export async function availableProviders(): Promise<Provider[]> {
  if (Platform.OS !== 'ios') return [];
  return (await AppleAuthentication.isAvailableAsync().catch(() => false)) ? ['apple'] : [];
}

async function appleCredential() {
  const rawNonce = Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  const r = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL, AppleAuthentication.AppleAuthenticationScope.FULL_NAME],
    nonce: hashed,
  });
  if (!r.identityToken) throw new Error('Apple didn’t send a sign-in token. Try again.');
  return new OAuthProvider('apple.com').credential({ idToken: r.identityToken, rawNonce });
}

export async function continueWith(provider: Provider): Promise<void> {
  if (provider !== 'apple') throw new Error('Not available in the app yet.');
  await signInWithCred(await appleCredential());
}

/** Add Apple to the account you're signed in to (keeps everything). */
export async function connect(provider: Provider): Promise<void> {
  if (provider !== 'apple' || !auth.currentUser) throw new Error('Not available here.');
  await linkWithCredential(auth.currentUser, await appleCredential());
}
