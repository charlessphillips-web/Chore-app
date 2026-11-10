import { Redirect } from 'expo-router';
import { Text } from 'react-native';
import { useApp } from '../context/AppContext';
import { Loading, Screen, Title } from '../components/ui';
import { colors } from '../components/theme';
import { PRIVACY_VERSION } from '../lib/legal';

/** Sends people to the right place: questions → house code → the app. */
export default function Index() {
  const { ready, error, profile, user } = useApp();
  if (error) {
    return (
      <Screen>
        <Title>Something went wrong</Title>
        <Text style={{ color: colors.muted }}>{error}</Text>
      </Screen>
    );
  }
  if (!ready) return <Loading />;
  // Brand new: explain the app first, then the questions.
  // (Already made a login but not answered the questions yet: straight to them.)
  if (!profile) return <Redirect href={user && !user.isAnonymous ? '/onboarding' : '/welcome'} />;
  // An older account from before date of birth was asked.
  if (!profile.dob) return <Redirect href="/onboarding" />;
  // Hasn't agreed to the current privacy policy yet.
  if (profile.privacyVersion !== PRIVACY_VERSION) return <Redirect href="/consent" />;
  if (!profile.houseId) return <Redirect href="/house-setup" />;
  return <Redirect href="/home" />;
}
