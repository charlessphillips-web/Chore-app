import { router } from 'expo-router';
import { HowItWorks } from '../components/HowItWorks';
import { Button, Screen } from '../components/ui';

/** "How Choreboard works", opened from Settings. */
export default function HowItWorksScreen() {
  return (
    <Screen edges={['left', 'right']}>
      <HowItWorks />
      <Button title="Got it" onPress={() => router.back()} />
    </Screen>
  );
}
