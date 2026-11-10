import { Stack } from 'expo-router';
import { Terms } from '../components/Terms';
import { Screen, Title } from '../components/ui';
import { APP_NAME } from '../lib/legal';

/** Terms of use. Also a public web page: /terms */
export default function TermsScreen() {
  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{ title: 'TERMS' }} />
      <Title>{APP_NAME} terms of use</Title>
      <Terms />
    </Screen>
  );
}
