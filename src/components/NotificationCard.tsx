import { useState } from 'react';
import { Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useApp } from '../context/AppContext';
import { Button, Card, Icon } from './ui';
import { colors, space, type } from './theme';

/**
 * Shown on Home until notifications are on. Explains why first, then shows
 * the phone's pop-up (an iPhone only lets an app ask once). If they said no
 * before, the button opens the phone's Settings instead.
 */
export function NotificationCard() {
  const { notifStatus, enableNotifications } = useApp();
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const status = notifStatus;

  if (hidden || (status !== 'ask' && status !== 'denied')) return null;
  const denied = status === 'denied';

  async function turnOn() {
    if (denied) return Linking.openSettings();
    setBusy(true);
    try {
      await enableNotifications();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ borderColor: colors.primaryBright }}>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
        <Icon name="notifications" size={24} color={colors.primaryBright} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={type.heading}>Turn on notifications</Text>
          <Text style={[type.small, { fontSize: 15, lineHeight: 21 }]}>
            {denied
              ? 'Notifications are off for Choreboard. Turn them on in your phone’s settings so you know when it’s your turn.'
              : 'Get told when it’s your turn to do a chore, or when a housemate’s photo needs checking.'}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button title="Not now" variant="ghost" style={{ flex: 1 }} onPress={() => setHidden(true)} />
        <Button title={denied ? 'Open settings' : 'Turn on'} style={{ flex: 1 }} onPress={turnOn} loading={busy} />
      </View>
    </Card>
  );
}
