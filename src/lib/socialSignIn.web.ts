/** Website version: Continue with Google (a pop-up). */
import * as fbAuth from 'firebase/auth';
import { GoogleAuthProvider, signInWithCredential, type AuthProvider, type User } from 'firebase/auth';
import { auth } from './firebase';
import type { Provider } from './socialCore';

export { connected, socialError, PROVIDER_NAMES, type Provider } from './socialCore';

export async function availableProviders(): Promise<Provider[]> {
  return ['google'];
}

// The website build of Firebase has pop-up sign-in; TypeScript only sees the phone types, so describe them here.
const { linkWithPopup, signInWithPopup } = fbAuth as unknown as {
  linkWithPopup: (user: User, provider: AuthProvider) => Promise<unknown>;
  signInWithPopup: (a: typeof auth, provider: AuthProvider) => Promise<unknown>;
};

const google = () => {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  return p;
};

export async function continueWith(provider: Provider): Promise<void> {
  if (provider !== 'google') throw new Error('Not available on the website yet.');
  const u = auth.currentUser;
  if (u?.isAnonymous) {
    try {
      await linkWithPopup(u, google());
      return;
    } catch (e) {
      if ((e as { code?: string }).code !== 'auth/credential-already-in-use') throw e;
      const cred = GoogleAuthProvider.credentialFromError(e as never);
      if (!cred) throw e;
      await signInWithCredential(auth, cred);
      return;
    }
  }
  await signInWithPopup(auth, google());
}

export async function connect(provider: Provider): Promise<void> {
  if (provider !== 'google' || !auth.currentUser) throw new Error('Not available here.');
  await linkWithPopup(auth.currentUser, google());
}
