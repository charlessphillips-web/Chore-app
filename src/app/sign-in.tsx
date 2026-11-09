import { useState } from 'react';
import { Text } from 'react-native';
import { router, Stack } from 'expo-router';
import { authError, resetPassword, signIn } from '../lib/account';
import { haptics } from '../lib/haptics';
import { Button, ErrorText, Input, Label, Screen, Subtitle, Title } from '../components/ui';
import { colors, type } from '../components/theme';

/** Sign in to a saved Rotawise account (e.g. on a new phone or the new web address). */
export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'in' | 'reset' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function go() {
    setError(null);
    setInfo(null);
    setBusy('in');
    try {
      await signIn(email, password);
      haptics.success();
      router.replace('/');
    } catch (e) {
      haptics.warning();
      setError(authError(e));
      setBusy(null);
    }
  }

  async function forgot() {
    setError(null);
    if (!email.trim()) return setError('Type your email above first.');
    setBusy('reset');
    try {
      await resetPassword(email);
      setInfo(`If ${email.trim()} has a Rotawise login, we've emailed a link to reset the password.`);
    } catch (e) {
      setError(authError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: 'SIGN IN' }} />
      <Title>Welcome back</Title>
      <Subtitle>Sign in with the email and password you saved in Settings → Your login.</Subtitle>
      <Label>Email</Label>
      <Input value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" autoCorrect={false}
        keyboardType="email-address" autoComplete="email" textContentType="emailAddress" accessibilityLabel="Email" />
      <Label>Password</Label>
      <Input value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry autoComplete="current-password"
        textContentType="password" accessibilityLabel="Password" onSubmitEditing={go} />
      <ErrorText>{error}</ErrorText>
      {info && <Text style={[type.small, { color: colors.success }]}>{info}</Text>}
      <Button title="Sign in" onPress={go} loading={busy === 'in'} disabled={!email.trim() || !password || !!busy} />
      <Button title="Forgot password?" variant="ghost" onPress={forgot} loading={busy === 'reset'} disabled={!!busy} />
    </Screen>
  );
}
