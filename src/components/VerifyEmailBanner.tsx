import { useState } from 'react';
import { Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { authError, isEmailVerified, sendVerification } from '../lib/account';
import { haptics } from '../lib/haptics';
import { Button, Card } from './ui';
import { colors, space, type } from './theme';

/** "Confirm your email" on Home until they've tapped the link we sent. */
export function VerifyEmailBanner() {
  const { user } = useApp();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState<'check' | 'resend' | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  if (!user || user.isAnonymous || !user.email || user.emailVerified || done) return null;

  return (
    <Card>
      <Text style={[type.body, { fontWeight: '600' }]}>Confirm your email</Text>
      <Text style={type.small}>
        We sent a link to {user.email}. Tap it so you can always get back into your account.
      </Text>
      <Text style={type.small}>
        It comes from noreply@choreboard-58094.firebaseapp.com, so check your Junk folder.
      </Text>
      {status && <Text style={[type.small, { color: status.ok ? colors.success : colors.danger }]}>{status.text}</Text>}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button title="Resend" variant="ghost" style={{ flex: 1 }} loading={busy === 'resend'} disabled={!!busy}
          onPress={async () => {
            setBusy('resend');
            try {
              await sendVerification();
              haptics.success();
              setStatus({ ok: true, text: `✓ Sent to ${user.email}. It can take a few minutes, and check Junk.` });
            } catch (e) {
              haptics.warning();
              setStatus({ ok: false, text: `Couldn’t send: ${authError(e)}` });
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
              setStatus({ ok: false, text: 'Not confirmed yet. Tap the link in the email first, then press this again.' });
            }
          }} />
      </View>
      <Text style={[type.small, { color: colors.faint }]}>You can keep using Rotawise in the meantime.</Text>
    </Card>
  );
}
