import { Redirect } from 'expo-router';
import { Text } from 'react-native';
import { useApp } from '../context/AppContext';
import { Loading, Screen, Title } from '../components/ui';
import { colors } from '../components/theme';

/** Sends people to the right place: questions → house code → the app. */
export default function Index() {
  const { ready, error, profile } = useApp();
  if (error) {
    return (
      <Screen>
        <Title>Something went wrong</Title>
        <Text style={{ color: colors.muted }}>{error}</Text>
      </Screen>
    );
  }
  if (!ready) return <Loading />;
  // No profile yet, or an older one from before date of birth was asked.
  if (!profile || !profile.dob) return <Redirect href="/onboarding" />;
  if (!profile.houseId) return <Redirect href="/house-setup" />;
  return <Redirect href="/home" />;
}
