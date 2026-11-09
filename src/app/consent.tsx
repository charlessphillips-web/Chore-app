import { useState } from 'react';
import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useApp } from '../context/AppContext';
import { acceptPrivacy } from '../lib/db';
import { APP_NAME, PRIVACY_VERSION } from '../lib/legal';
import { AgreeBox } from '../components/AgreeBox';
import { Button, ErrorText, Logo, Screen, Subtitle, Title } from '../components/ui';
import { space } from '../components/theme';

/** Existing users: agree to the (new) privacy policy once. */
export default function Consent() {
  const { user, profile } = useApp();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (profile?.privacyVersion === PRIVACY_VERSION) return <Redirect href="/" />;

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: space.md, marginTop: space.lg }}>
        <Logo size={64} />
        <Title>Our privacy policy</Title>
      </View>
      <Subtitle>
        Before you carry on, please read how {APP_NAME} uses your information and agree to it. It only takes a minute.
      </Subtitle>
      <AgreeBox value={agreed} onChange={setAgreed} />
      <ErrorText>{error}</ErrorText>
      <Button
        title="Continue"
        disabled={!agreed}
        loading={busy}
        onPress={async () => {
          if (!user) return;
          setBusy(true);
          try {
            await acceptPrivacy(user.uid);
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      />
    </Screen>
  );
}
