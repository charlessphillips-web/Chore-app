import { useState } from 'react';
import { Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { isEmailVerified, sendVerification } from '../lib/account';
import { haptics } from '../lib/haptics';
import { Button, Card, notify } from './ui';
import { colors, space, type } from './theme';

/** "Confirm your email" on Home until they've tapped the link we sent. */
export function VerifyEmailBanner() {
  const { user } = useApp();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState<'check' | 'resend' | null>(null);
  if (!user || user.isAnonymous || !user.email || user.emailVerified || done) return null;

  return (
    <Card>
      <Text style={[type.body, { fontWeight: '600' }]}>Confirm your email</Text>
      <Text style={type.small}>
        We sent a link to {user.email}. Tap it so you can always get back into your account. (Check your junk folder too.)
      </Text>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button title="Resend" variant="ghost" style={{ flex: 1 }} loading={busy === 'resend'} disabled={!!busy}
          onPress={async () => {
            setBusy('resend');
            try {
              await sendVerification();
              notify('Sent', `Check ${user.email} for the link.`);
            } catch (e) {
              notify('Couldn’t send', (e as Error).message);
            } finally {
              setBusy(null);
            }
          }} />
        <Button title="I've done it" variant="secondary" style={{ flex: 1 }} loading={busy === 'check'} disabled={!!busy}
          onPress={async () => {
            setBusy('check');
            const ok = await isEmailVerified().catch(() => false);
            setBusy(null);
            if (ok) {
              haptics.success();
              setDone(true);
            } else {
              notify('Not yet', 'We can’t see it confirmed yet. Tap the link in the email, then try again.');
            }
          }} />
      </View>
      <Text style={[type.small, { color: colors.faint }]}>You can keep using Rotawise in the meantime.</Text>
    </Card>
  );
}
