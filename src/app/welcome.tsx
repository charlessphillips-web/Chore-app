import { View } from 'react-native';
import { router } from 'expo-router';
import { HowItWorks } from '../components/HowItWorks';
import { Button, Logo, Screen, Subtitle, Title } from '../components/ui';
import { space } from '../components/theme';

/** First thing new users see: what the app does, then the sign-up questions. */
export default function Welcome() {
  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: space.md, marginTop: space.lg }}>
        <Logo size={72} />
        <Title>Choreboard</Title>
        <Subtitle>Sharing chores fairly in your house.</Subtitle>
      </View>
      <View style={{ marginVertical: space.md }}>
        <HowItWorks />
      </View>
      <Button title="Get started" onPress={() => router.push('/onboarding')} />
    </Screen>
  );
}
