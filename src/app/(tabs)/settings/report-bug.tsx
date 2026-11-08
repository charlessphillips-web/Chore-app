import { useState } from 'react';
import { Image, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../../context/AppContext';
import { submitBugReport } from '../../../lib/db';
import { jpegUri, pickFromLibrary } from '../../../lib/photos';
import { Button, ErrorText, Input, Label, Loading, notify, Screen, Subtitle } from '../../../components/ui';
import { colors, radius } from '../../../components/theme';

/** Everyone: describe a problem, optionally attach a screenshot. */
export default function ReportBug() {
  const { user, profile } = useApp();
  const [message, setMessage] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [busy, setBusy] = useState<'pick' | 'send' | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!user) return <Loading />;

  async function attach() {
    setError(null);
    setBusy('pick');
    try {
      const data = await pickFromLibrary();
      if (data) setScreenshot(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    setError(null);
    setBusy('send');
    try {
      await submitBugReport({
        uid: user!.uid,
        username: profile?.username ?? null,
        houseId: profile?.houseId ?? null,
        message,
        screenshot,
      });
      notify('Thanks!', "Your report has been sent. We'll look into it.");
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <Screen edges={['left', 'right']}>
      <Subtitle>
        What went wrong? Tell us what you were doing and what happened. A screenshot helps a lot (on iPhone: side
        button + volume up).
      </Subtitle>

      <Label>What happened</Label>
      <Input
        value={message}
        onChangeText={setMessage}
        placeholder="e.g. I pressed Log chore and nothing happened"
        multiline
        maxLength={2000}
        style={{ minHeight: 140, textAlignVertical: 'top' }}
      />

      <Label>Screenshot (optional)</Label>
      {screenshot && (
        <View style={{ alignSelf: 'center', width: '45%', borderRadius: radius, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
          <Image source={{ uri: jpegUri(screenshot) }} style={{ width: '100%', aspectRatio: 9 / 16 }} resizeMode="contain" />
        </View>
      )}
      <Button
        title={screenshot ? 'Change screenshot' : 'Attach a screenshot'}
        icon="image-outline"
        variant="secondary"
        onPress={attach}
        loading={busy === 'pick'}
        disabled={busy === 'send'}
      />
      {screenshot && <Button title="Remove screenshot" variant="ghost" onPress={() => setScreenshot(null)} />}

      <ErrorText>{error}</ErrorText>
      <Button title="Send report" icon="send" onPress={send} loading={busy === 'send'} disabled={message.trim().length < 5 || busy === 'pick'} />
    </Screen>
  );
}
