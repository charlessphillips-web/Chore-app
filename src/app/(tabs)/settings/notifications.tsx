import { useState } from 'react';
import { Platform, Switch, Text } from 'react-native';
import { useApp } from '../../../context/AppContext';
import { setNotifPrefs } from '../../../lib/db';
import { NOTIFY_KINDS, wants, type NotifyKind, type NotifyPrefs } from '../../../lib/notifyPrefs';
import { haptics } from '../../../lib/haptics';
import { Card, ErrorText, ListGroup, ListRow, Loading, Screen, Subtitle } from '../../../components/ui';
import { colors, type } from '../../../components/theme';

/** Choose which notifications you get. */
export default function NotificationSettings() {
  const { user, house, members, notifStatus } = useApp();
  const saved = members.find((m) => m.uid === user?.uid)?.notifPrefs ?? {};
  const [prefs, setPrefs] = useState<NotifyPrefs | null>(null);
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
              <Switch
                value={wants(current, k)}
                onValueChange={(v) => toggle(k, v)}
                trackColor={{ true: colors.text, false: colors.line }}
                thumbColor={wants(current, k) ? colors.inverse : colors.muted}
                {...({ activeThumbColor: colors.inverse, activeTrackColor: colors.text } as object)}
                accessibilityLabel={NOTIFY_KINDS[k].title}
              />
            }
          />
        ))}
      </ListGroup>
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
