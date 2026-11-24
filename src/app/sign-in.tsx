import { useState } from 'react';
import { Text } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useApp } from '../context/AppContext';
import { authError, resetPassword, signIn } from '../lib/account';
import { haptics } from '../lib/haptics';
import { Button, Card, ErrorText, Input, Label, notify, Screen, Subtitle, Title } from '../components/ui';
import { PasswordInput } from '../components/PasswordInput';
import { EmailHint } from '../components/EmailHint';
import { colors, type } from '../components/theme';

/**
 * Sign in to a saved Rotawise account: a new phone, the website, or
 * switching from an account you made by mistake. Signing in here replaces
 * whatever account is open now (nothing is deleted).
 */
export default function SignIn() {
  const params = useLocalSearchParams<{ email?: string; switch?: string }>();
  const { user, profile, house, members, isAdmin } = useApp();
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'in' | 'reset' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wrong, setWrong] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  // Already in an account with a saved email? Signing in switches away from it.
  const current = user && !user.isAnonymous ? user.email : null;
  const me = members.find((m) => m.uid === user?.uid);
  // The account being left: if it never did a chore, it's probably a mistake/duplicate.
  const leaving = user && profile && house && me && me.totalCompleted === 0 && !me.lastCompletedAt && !isAdmin
    ? { name: profile.username, house: house.name, admin: members.find((m) => m.uid === house.adminUid)?.username ?? 'the admin' }
    : null;

  async function go() {
    setError(null);
    setInfo(null);
    setWrong(false);
    if (current && email.trim().toLowerCase() === current.toLowerCase()) {
      setError(`You're already signed in as ${current}.`);
      return;
    }
    setBusy('in');
    try {
      await signIn(email, password);
      haptics.success();
      router.replace('/');
      if (leaving) {
        setTimeout(() => notify(
          'Signed in',
          `The other account (${leaving.name}) is still listed in ${leaving.house}. Ask ${leaving.admin} to remove it: Settings → Housemates → Remove.`,
        ), 600);
      }
    } catch (e) {
      haptics.warning();
      const code = (e as { code?: string }).code ?? '';
      setWrong(['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].includes(code));
      setError(authError(e));
      setBusy(null);
    }
  }

  async function forgot() {
    setError(null);
    if (!email.trim()) return setError('Type the email of the account you want to get back into, above.');
    setBusy('reset');
    try {
      await resetPassword(email);
      setInfo(`If ${email.trim()} has a Rotawise login, we've emailed it a link to set a new password. Check Junk too. Then come back here and sign in.`);
    } catch (e) {
      setError(authError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: 'SIGN IN' }} />
      <Title>{params.switch ? 'Switch account' : 'Welcome back'}</Title>
      <Subtitle>Type the email of the account you want to use. If you&apos;ve forgotten its password, type the email and tap the reset button.</Subtitle>
      {current && (
        <Card style={{ borderColor: colors.warning, borderWidth: 1 }}>
          <Text style={type.body}>You&apos;re signed in as <Text style={{ fontWeight: '700' }}>{current}</Text> right now.</Text>
          <Text style={type.small}>Signing in below switches to the other account. Nothing gets deleted.</Text>
        </Card>
      )}
      <Label>Email</Label>
      <Input value={email} onChangeText={(t) => { setEmail(t); setError(null); setWrong(false); }} placeholder="you@example.com" autoCapitalize="none" autoCorrect={false}
        keyboardType="email-address" autoComplete="email" textContentType="emailAddress" accessibilityLabel="Email" />
      <EmailHint email={email} onUse={(e) => { setEmail(e); setError(null); setWrong(false); }} />
      <Label>Password</Label>
      <PasswordInput value={password} onChangeText={setPassword} placeholder="Password" autoComplete="current-password"
        textContentType="password" accessibilityLabel="Password" onSubmitEditing={go} />
      <ErrorText>{error}</ErrorText>
      {info && <Text style={[type.small, { color: colors.success }]}>{info}</Text>}
      <Button title="Sign in" onPress={go} loading={busy === 'in'} disabled={!email.trim() || !password || !!busy} />
      <Button
        title={email.trim() ? `Forgot password? Email a reset link to ${email.trim()}` : 'Forgot password?'}
        variant={wrong ? 'secondary' : 'ghost'}
        onPress={forgot}
        loading={busy === 'reset'}
        disabled={!!busy}
      />
    </Screen>
  );
}
