import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useApp } from '../context/AppContext';
import { createProfile, updateProfile } from '../lib/db';
import { ProfileForm } from '../components/ProfileForm';
import { Logo, Screen, Subtitle, Title } from '../components/ui';
import { space } from '../components/theme';

export default function Onboarding() {
  const { user, profile } = useApp();

  // Move on as soon as the saved profile arrives.
  if (profile?.dob) return <Redirect href="/" />;
  const updating = !!profile; // older account missing a date of birth

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: space.md, marginTop: space.lg }}>
        <Logo size={64} />
        <Title>{updating ? 'Update your details' : 'Welcome to Choreboard'}</Title>
      </View>
      <Subtitle>
        {updating ? 'We now ask for your date of birth instead of your age.' : 'A few quick questions to set you up.'}
      </Subtitle>
      <ProfileForm
        initial={profile ?? undefined}
        submitLabel="Continue"
        onSubmit={async (p) => {
          if (!user) throw new Error('Still connecting — try again in a second.');
          if (updating) await updateProfile(user.uid, p, profile!.houseId);
          else await createProfile(user.uid, p);
          // The Redirect above fires when the profile updates.
        }}
      />
    </Screen>
  );
}
