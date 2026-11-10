/**
 * Optional email + password login. Everyone starts with an anonymous
 * account (no login needed). "Save your account" upgrades it in place —
 * same account, same house and scores — so you can sign in on another
 * phone or browser later.
 */
import {
  EmailAuthProvider, linkWithCredential, reload, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type User,
} from 'firebase/auth';
import { auth } from './firebase';

export const MIN_PASSWORD = 8;

/** Friendly message for a Firebase sign-in error. */
export function authError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-email': return 'That email address doesn’t look right.';
    case 'auth/email-already-in-use':
    case 'auth/credential-already-in-use': return 'That email already has a Rotawise login. Sign in with it instead.';
    case 'auth/weak-password': return `Use a password of at least ${MIN_PASSWORD} characters.`;
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'Email or password is wrong.';
    case 'auth/too-many-requests': return 'Too many tries. Wait a few minutes and try again.';
    case 'auth/network-request-failed': return 'No connection. Check your internet and try again.';
    case 'auth/requires-recent-login': return 'For safety, sign out and back in, then try again.';
    case 'auth/operation-not-allowed': return 'Email login isn’t switched on yet (Firebase → Authentication → Sign-in method → Email/Password).';
    default: return (e as Error)?.message ?? 'Something went wrong.';
  }
}

export function checkLogin(email: string, password: string): string | null {
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Enter your email address.';
  if (password.length < MIN_PASSWORD) return `Use a password of at least ${MIN_PASSWORD} characters.`;
  return null;
}

/** Adds an email + password to the account you're using now (keeps everything). */
export async function saveAccount(email: string, password: string): Promise<User> {
  const u = auth.currentUser;
  if (!u) throw new Error('Still connecting — try again in a second.');
  const res = await linkWithCredential(u, EmailAuthProvider.credential(email.trim(), password));
  return res.user;
}

/** Signs in to an existing saved account (replaces the anonymous one on this phone). */
export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

/** Emails a "confirm it's you" link. */
export async function sendVerification(): Promise<void> {
  if (auth.currentUser && !auth.currentUser.isAnonymous) await sendEmailVerification(auth.currentUser);
}

/** Re-checks with Firebase whether the email has been confirmed. */
export async function isEmailVerified(): Promise<boolean> {
  if (!auth.currentUser) return false;
  await reload(auth.currentUser);
  return auth.currentUser.emailVerified;
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

/** Only for saved accounts: afterwards a fresh anonymous account starts. */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
}
