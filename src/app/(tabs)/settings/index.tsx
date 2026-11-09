import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../../context/AppContext';
import { deleteAccount, isAppOwner, leaveHouse } from '../../../lib/db';
import { Button, Card, confirm, Label, Loading, notify, RowButton, Screen, Title } from '../../../components/ui';
import { space, type } from '../../../components/theme';

export default function SettingsIndex() {
  const { user, house, members, isAdmin } = useApp();
  const [busy, setBusy] = useState<'leave' | 'delete' | null>(null);
  // Owner = you (the app's creator). Shows the Feedback inbox. Set up in the Firebase console.
  const [ownerOf, setOwnerOf] = useState<string | null>(null);
  const uid = user?.uid;
  useEffect(() => {
    if (!uid) return;
    let live = true;
    isAppOwner(uid).then((yes) => live && setOwnerOf(yes ? uid : null));
    return () => { live = false; };
  }, [uid]);
  const isOwner = !!uid && ownerOf === uid;
  if (!user || !house) return <Loading />;
  const admin = members.find((m) => m.uid === house.adminUid);

  async function leave() {
    const others = members.length > 1;
    const ok = await confirm(
      'Leave house?',
      isAdmin && others
        ? 'Your chore history here will be removed, and the person who has been in the house longest becomes admin.'
        : 'Your chore history in this house will be removed.',
      'Leave',
    );
    if (!ok) return;
    setBusy('leave');
    try {
      await leaveHouse(user!.uid, house!, members);
    } catch (e) {
      notify('Could not leave', (e as Error).message);
      setBusy(null);
    }
  }

  async function del() {
    const ok = await confirm(
      'Delete your account?',
      'This permanently deletes your details and removes you from your house. It cannot be undone.',
      'Delete',
    );
    if (!ok) return;
    setBusy('delete');
    try {
      await deleteAccount(user!.uid, house, members);
    } catch (e) {
      notify('Could not delete account', (e as Error).message);
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Title>Settings</Title>

      {isOwner && (
        <>
          <Label>App owner</Label>
          <RowButton icon="mail-outline" title="Feedback inbox" subtitle="Bug reports and suggestions" onPress={() => router.push('/settings/inbox')} />
        </>
      )}

      <Label>You</Label>
      <RowButton icon="person-outline" title="Personal details" subtitle="Username, date of birth, university" onPress={() => router.push('/settings/personal')} />

      {isAdmin ? (
        <>
          <Label>House admin</Label>
          <RowButton icon="list-outline" title="Chores" subtitle="Choose and add chores" onPress={() => router.push('/settings/chores')} />
          <RowButton icon="people-outline" title="Housemates" subtitle="Remove people, hand over admin" onPress={() => router.push('/settings/housemates')} />
          <RowButton icon="image-outline" title="House details" subtitle="Name and wallpaper" onPress={() => router.push('/settings/house-details')} />
        </>
      ) : (
        <Card>
          <Text style={type.small}>
            {admin ? `${admin.username} is the house admin` : 'Your house admin'} and manages the chores and housemates.
          </Text>
        </Card>
      )}

      <Label>Help</Label>
      <RowButton icon="information-circle-outline" title="How Choreboard works" onPress={() => router.push('/how-it-works')} />
      <RowButton icon="bug-outline" title="Report a bug" subtitle="Something not working? Tell us" onPress={() => router.push({ pathname: '/settings/feedback', params: { type: 'bug' } })} />
      <RowButton icon="bulb-outline" title="Make a suggestion" subtitle="Ideas to make Choreboard better" onPress={() => router.push({ pathname: '/settings/feedback', params: { type: 'suggestion' } })} />

      <Label>Account</Label>
      <Button title="Leave house" icon="exit-outline" variant="secondary" onPress={leave} loading={busy === 'leave'} disabled={!!busy} />
      <Button title="Delete my account" icon="trash-outline" variant="danger" onPress={del} loading={busy === 'delete'} disabled={!!busy} />

      <Text selectable style={[type.small, { textAlign: 'center', marginTop: space.lg }]}>
        Account ID: {user.uid}
      </Text>
    </Screen>
  );
}
