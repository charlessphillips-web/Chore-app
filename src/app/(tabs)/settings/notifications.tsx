import { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useApp } from '../../../context/AppContext';
import { runNotificationTest, type TestStep } from '../../../lib/notifyTest';
import { setNotifPrefs } from '../../../lib/db';
import { NOTIFY_KINDS, wants, type NotifyKind, type NotifyPrefs } from '../../../lib/notifyPrefs';
import { haptics } from '../../../lib/haptics';
import { Button, Card, ErrorText, ListGroup, ListRow, Loading, Screen, Subtitle, Toggle } from '../../../components/ui';
import { colors, type } from '../../../components/theme';

/** Choose which notifications you get. */
export default function NotificationSettings() {
  const { user, house, members, notifStatus } = useApp();
  const saved = members.find((m) => m.uid === user?.uid)?.notifPrefs ?? {};
  const [prefs, setPrefs] = useState<NotifyPrefs | null>(null);
  const [testing, setTesting] = useState(false);
  const [steps, setSteps] = useState<TestStep[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!user || !house) return <Loading />;
  const current = prefs ?? saved;

  async function toggle(k: NotifyKind, on: boolean) {
    haptics.select();
    const next = { ...current, [k]: on };
    setPrefs(next);
    try {
      await setNotifPrefs(house!.id, user!.uid, next);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Screen edges={['left', 'right']}>
      <Subtitle>Choose what Rotawise tells you about.</Subtitle>
      <Card style={{ gap: 10 }}>
        <Text style={type.body}>Not getting notifications?</Text>
        <Text style={type.small}>Send yourself two test ones. If something&apos;s wrong, this says exactly what.</Text>
        <Button title={testing ? 'Testing… (about 10 seconds)' : 'Send me a test notification'} variant="secondary" loading={testing}
          onPress={async () => {
            if (!user || !house) return;
            setTesting(true);
            setSteps(null);
            const result = await runNotificationTest({ houseId: house.id, uid: user.uid }).catch((e) => [{ label: 'Test failed', ok: false, detail: (e as Error).message }]);
            setSteps(result);
            setTesting(false);
          }} />
        {steps?.map((st) => (
          <View key={st.label} style={{ gap: 2 }}>
            <Text style={[type.body, { color: st.ok ? colors.success : colors.danger, fontSize: 15 }]}>{st.ok ? '✓' : '✗'} {st.label}</Text>
            {st.detail && <Text style={type.small}>{st.detail}</Text>}
          </View>
        ))}
      </Card>
      {(Platform.OS === 'web' || notifStatus === 'unavailable') && (
        <Card>
          <Text style={type.small}>
            Notifications only work in the Rotawise phone app, not the website. Your choices here are saved for when you
            switch.
          </Text>
        </Card>
      )}
      {notifStatus === 'denied' && (
        <Card><Text style={type.small}>Notifications are off for Rotawise in your phone&apos;s Settings, so none will arrive.</Text></Card>
      )}
      <ListGroup>
        {(Object.keys(NOTIFY_KINDS) as NotifyKind[]).map((k) => (
          <ListRow
            key={k}
            title={NOTIFY_KINDS[k].title}
            subtitle={NOTIFY_KINDS[k].desc}
            right={
              <Toggle value={wants(current, k)} onValueChange={(v) => toggle(k, v)} accessibilityLabel={NOTIFY_KINDS[k].title} />
            }
          />
        ))}
      </ListGroup>
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
