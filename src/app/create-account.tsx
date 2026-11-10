import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useApp } from '../context/AppContext';
import { authError, checkLogin, saveAccount } from '../lib/account';
import { haptics } from '../lib/haptics';
import { track } from '../lib/analytics';
import { PasswordInput } from '../components/PasswordInput';
import { Button, ErrorText, Input, Label, Logo, Screen, Subtitle, Title } from '../components/ui';
import { colors, space, type } from '../components/theme';

/** First step after the intro: an email + password, so nobody loses their account. */
export default function CreateAccount() {
  const { user, profile } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (profile) return <Redirect href="/" />;
  if (user && !user.isAnonymous) return <Redirect href="/onboarding" />;

  async function go() {
    const err = checkLogin(email, password);
    if (err) return setError(err);
    setError(null);
    setBusy(true);
    try {
      await saveAccount(email, password);
      track('account_created');
      haptics.success();
      router.replace('/onboarding');
    } catch (e) {
      haptics.warning();
      setError(authError(e));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: space.md, marginTop: space.lg }}>
        <Logo size={64} />
        <Title>Create your account</Title>
      </View>
      <Subtitle>So you never lose your house or your scores, even if you get a new phone.</Subtitle>
      <Label>Email</Label>
      <Input value={email} onChangeText={(t) => { setEmail(t); setError(null); }} placeholder="you@example.com" autoCapitalize="none"
        autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" accessibilityLabel="Email" />
      <Label>Password (8+ characters)</Label>
      <PasswordInput value={password} onChangeText={(t) => { setPassword(t); setError(null); }} placeholder="Choose a password"
        autoComplete="new-password" textContentType="newPassword" accessibilityLabel="Password" onSubmitEditing={go} />
      <ErrorText>{error}</ErrorText>
      <Button title="Continue" onPress={go} loading={busy} disabled={!email.trim() || !password} />
      <Text style={[type.small, { textAlign: 'center' }]}>
        Your email is only used to sign in and reset your password. Housemates never see it.
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Already have an account? Sign in"
        onPress={() => { haptics.tap(); router.push('/sign-in'); }} style={{ alignSelf: 'center', padding: space.sm }}>
        <Text style={[type.body, { color: colors.muted, fontSize: 15 }]}>
          Already have an account? <Text style={{ color: colors.text, fontWeight: '600', textDecorationLine: 'underline' }}>Sign in</Text>
        </Text>
      </Pressable>
    </Screen>
  );
}
