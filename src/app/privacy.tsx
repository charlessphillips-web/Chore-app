import { Stack } from 'expo-router';
import { PrivacyPolicy } from '../components/PrivacyPolicy';
import { Screen, Title } from '../components/ui';
import { APP_NAME } from '../lib/legal';

/** Privacy policy. Also the public web address for app stores: /privacy */
export default function PrivacyScreen() {
  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: 'PRIVACY' }} />
      <Title>{APP_NAME} privacy policy</Title>
      <PrivacyPolicy />
    </Screen>
  );
}
