import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../../context/AppContext';
import { setPayLink, updateProfile } from '../../../lib/db';
import { normalisePayLink } from '../../../lib/money';
import { ProfileForm } from '../../../components/ProfileForm';
import { Button, Card, ErrorText, Input, Label, Loading, notify, Screen } from '../../../components/ui';
import { type } from '../../../components/theme';

export default function PersonalDetails() {
  const { user, profile, house, members } = useApp();
  const saved = members.find((m) => m.uid === user?.uid)?.payLink ?? '';
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user || !profile) return <Loading />;
  const value = link ?? saved;

  async function saveLink() {
    const n = normalisePayLink(value);
    if (n && typeof n === 'object') return setError(n.error);
    setError(null);
    setBusy(true);
    try {
      await setPayLink(house!.id, user!.uid, n);
      setLink(n ?? '');
      notify('Saved', n ? 'Housemates can now pay you with one tap.' : 'Payment link removed.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['left', 'right']}>
      <ProfileForm
        initial={profile}
        submitLabel="Save changes"
        onSubmit={async (p) => {
          await updateProfile(user.uid, p, profile.houseId);
          notify('Saved', 'Your details have been updated.');
          router.back();
        }}
      />

      {house && (
        <>
          <Label>Get paid for chores (optional)</Label>
          <Card>
            <Text style={type.small}>
              Add your Monzo or PayPal link so housemates can pay you in one tap when you do a chore for them. Your
              housemates can see it. Find it in your Monzo app under &quot;Share your monzo.me link&quot;, or at paypal.me.
            </Text>
          </Card>
          <Input
            value={value}
            onChangeText={setLink}
            placeholder="monzo.me/yourname or paypal.me/yourname"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessibilityLabel="Payment link"
          />
          <ErrorText>{error}</ErrorText>
          <Button title="Save payment link" variant="secondary" onPress={saveLink} loading={busy} disabled={busy || value === saved} />
        </>
      )}
    </Screen>
  );
}
