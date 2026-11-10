import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../../context/AppContext';
import { authError, checkLogin, saveAccount, signOutUser } from '../../../lib/account';
import { haptics } from '../../../lib/haptics';
import { Button, Card, confirm, ErrorText, Input, Label, Loading, notify, Screen, Subtitle } from '../../../components/ui';
import { PasswordInput } from '../../../components/PasswordInput';
import { colors, type } from '../../../components/theme';

/** Your login: save an email + password so you can sign in on another phone. */
export default function AccountScreen() {
  const { user } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [savedAs, setSavedAs] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return <Loading />;
  const loginEmail = savedAs ?? (user.isAnonymous ? null : user.email);

  if (loginEmail) {
    return (
      <Screen edges={['left', 'right']}>
        <Card>
          <Text style={type.label}>Signed in as</Text>
          <Text style={type.heading}>{loginEmail}</Text>
          <Text style={type.small}>Use this email and your password to sign in on another phone, or at rotawise.org.</Text>
        </Card>
        <Button
          title="Sign out"
          variant="secondary"
          onPress={async () => {
            if (await confirm('Sign out?', 'You can sign back in any time with your email and password.', 'Sign out')) {
              await signOutUser();
              router.replace('/');
            }
          }}
        />
      </Screen>
    );
  }

  async function save() {
    const err = checkLogin(email, password);
    if (err) return setError(err);
    setError(null);
    setBusy(true);
    try {
      const u = await saveAccount(email, password);
      haptics.success();
      setSavedAs(u.email);
      notify('Account saved', 'You can now sign in with this email and password on any phone or at rotawise.org.');
    } catch (e) {
      haptics.warning();
      setError(authError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['left', 'right']}>
      <Subtitle>
        Right now your account only lives on this phone (or browser). Add an email and password so you can sign in
        somewhere else — a new phone, or the website — and keep your house, scores and picture.
      </Subtitle>
      <Label>Email</Label>
      <Input value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" autoCorrect={false}
        keyboardType="email-address" autoComplete="email" textContentType="emailAddress" accessibilityLabel="Email" />
      <Label>Password (8+ characters)</Label>
      <PasswordInput value={password} onChangeText={setPassword} placeholder="Choose a password" autoComplete="new-password"
        textContentType="newPassword" accessibilityLabel="Password" />
      <ErrorText>{error}</ErrorText>
      <Button title="Save my account" onPress={save} loading={busy} disabled={!email.trim() || !password} />
      <Text style={[type.small, { color: colors.muted }]}>
        Your email is only used to sign in and reset your password. Housemates never see it.
      </Text>
    </Screen>
  );
}
