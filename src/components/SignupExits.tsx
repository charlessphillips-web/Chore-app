/**
 * Ways out while setting up: "Use a different account" (sign out) on every
 * set-up screen, and the confirm-your-email gate before joining or making a
 * house (real emails only), with a "wrong email? start again" escape.
 */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../context/AppContext';
import { authError, isEmailVerified, sendVerification, signOutUser } from '../lib/account';
import { deleteAccount } from '../lib/db';
import { haptics } from '../lib/haptics';
import { Button, Card, confirm, ErrorText, notify, Subtitle, Title } from './ui';
import { colors, type } from './theme';

export function UseDifferentAccount() {
  const { user } = useApp();
  if (!user) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Use a different account"
      hitSlop={8}
      style={{ alignSelf: 'center', paddingVertical: 10 }}
      onPress={async () => {
        haptics.tap();
        const who = user.email ? ` (${user.email})` : '';
        if (!(await confirm('Use a different account?', `You'll be signed out of this one${who}. You can sign back in any time.`, 'Sign out'))) return;
        await signOutUser().catch(() => {});
        router.replace('/');
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 14 }}>
        {user.email ? <>Signed in as {user.email} · </> : null}
        <Text style={{ color: colors.text, textDecorationLine: 'underline' }}>Use a different account</Text>
      </Text>
    </Pressable>
  );
}

/** Shown instead of house set-up until the email is confirmed. Calls onVerified once it is. */
export function ConfirmEmailGate({ onVerified }: { onVerified: () => void }) {
  const { user, house, members } = useApp();
  const [busy, setBusy] = useState<'check' | 'resend' | 'restart' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  if (!user?.email) return null;

  return (
    <View style={{ gap: 14 }}>
      <Title>Confirm your email</Title>
      <Subtitle>
        We sent a link to <Text style={{ color: colors.text, fontWeight: '700' }}>{user.email}</Text>. Tap it, then come back
        here. This makes sure you can always get back into your account.
      </Subtitle>
      <Card style={{ gap: 6 }}>
        <Text style={type.small}>📬 Not there? Check Junk/Spam. It comes from noreply@choreboard-58094.firebaseapp.com.</Text>
      </Card>
      <ErrorText>{error}</ErrorText>
      {info && <Text style={[type.small, { color: colors.success }]}>{info}</Text>}
      <Button
        title="I've confirmed it"
        loading={busy === 'check'}
        onPress={async () => {
          setBusy('check'); setError(null); setInfo(null);
          const ok = await isEmailVerified().catch(() => false);
          setBusy(null);
          if (ok) { haptics.success(); onVerified(); }
          else setError('Not confirmed yet. Tap the link in the email first (check Junk too), then try again.');
        }}
      />
      <Button
        title="Send the email again"
        variant="secondary"
        loading={busy === 'resend'}
        onPress={async () => {
          setBusy('resend'); setError(null);
          try { await sendVerification(); setInfo(`Sent again to ${user.email}.`); } catch (e) { setError(authError(e)); }
          setBusy(null);
        }}
      />
      <Button
        title="Wrong email? Start again"
        variant="ghost"
        loading={busy === 'restart'}
        onPress={async () => {
          if (!(await confirm('Start again?', `This removes the account for ${user.email} so you can sign up with the right email.`, 'Start again'))) return;
          setBusy('restart');
          try {
            await deleteAccount(user.uid, house, members);
            router.replace('/');
          } catch (e) {
            notify('Could not remove it', `${authError(e)} You can sign out instead and sign up again.`);
            setBusy(null);
          }
        }}
      />
    </View>
  );
}
