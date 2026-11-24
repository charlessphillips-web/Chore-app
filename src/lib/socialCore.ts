/** Shared bits for "Continue with Apple / Google" (see socialSignIn.ts / .web.ts). */
import { linkWithCredential, signInWithCredential, type AuthCredential } from 'firebase/auth';
import { auth } from './firebase';

export type Provider = 'apple' | 'google';
export const PROVIDER_IDS: Record<Provider, string> = { apple: 'apple.com', google: 'google.com' };
export const PROVIDER_NAMES: Record<Provider, string> = { apple: 'Apple', google: 'Google' };

/** Which of Apple / Google are already connected to the signed-in account. */
export function connected(): Provider[] {
  const ids = auth.currentUser?.providerData.map((p) => p.providerId) ?? [];
  return (Object.keys(PROVIDER_IDS) as Provider[]).filter((k) => ids.includes(PROVIDER_IDS[k]));
}

/**
 * Sign in with a credential. A brand-new (anonymous) visitor keeps their
 * session by linking it; if that Apple/Google account already has a
 * Rotawise account, we sign into that one instead.
 */
export async function signInWithCred(cred: AuthCredential): Promise<void> {
  const u = auth.currentUser;
  if (u?.isAnonymous) {
    try {
      await linkWithCredential(u, cred);
      return;
    } catch (e) {
      if ((e as { code?: string }).code !== 'auth/credential-already-in-use') throw e;
    }
  }
  await signInWithCredential(auth, cred);
}

/** Friendly words for Apple/Google sign-in errors; null = the person just cancelled. */
export function socialError(e: unknown, provider: Provider): string | null {
  const code = (e as { code?: string }).code ?? '';
  const name = PROVIDER_NAMES[provider];
  if (['ERR_REQUEST_CANCELED', 'ERR_CANCELED', 'auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'].includes(code)) return null;
  if (code === 'auth/account-exists-with-different-credential') {
    return `You already have a Rotawise account with that email. Sign in with your email and password, then connect ${name} in Settings → Your login.`;
  }
  if (code === 'auth/credential-already-in-use' || code === 'auth/provider-already-linked') {
    return `That ${name} account is already connected to a Rotawise account.`;
  }
  if (code === 'auth/operation-not-allowed') return `${name} sign-in isn't switched on yet (Firebase → Authentication → Sign-in method → ${name}).`;
  if (code === 'auth/unauthorized-domain') return 'This website isn’t allowed to use sign-in yet (Firebase → Authentication → Settings → Authorised domains).';
  if (code === 'auth/popup-blocked') return 'Your browser blocked the sign-in pop-up. Allow pop-ups for this site and try again.';
  return (e as Error)?.message ?? 'Something went wrong. Try again.';
}
