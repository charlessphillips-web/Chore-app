import { router } from 'expo-router';
import { useApp } from '../../../context/AppContext';
import { updateProfile } from '../../../lib/db';
import { ProfileForm } from '../../../components/ProfileForm';
import { Loading, notify, Screen } from '../../../components/ui';

export default function PersonalDetails() {
  const { user, profile } = useApp();
  if (!user || !profile) return <Loading />;
  return (
    <Screen edges={['left', 'right']}>
      <ProfileForm
        initial={profile}
        submitLabel="Save changes"
        onSubmit={async (p) => {
          await updateProfile(user.uid, p, profile.houseId);
          notify('Saved', 'Your details have been updated.');
          router.back();
        }}
      />
    </Screen>
  );
}
