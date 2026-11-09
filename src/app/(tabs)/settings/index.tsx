import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../../context/AppContext';
import { deleteAccount, isAppOwner, leaveHouse } from '../../../lib/db';
import { Button, confirm, Icon, Label, ListGroup, ListRow, Loading, notify, Screen, Title } from '../../../components/ui';
import { resetTips, Tip } from '../../../components/Tip';
import { Avatar } from '../../../components/Avatar';
import { haptics } from '../../../lib/haptics';
import { colors, fonts, space, type } from '../../../components/theme';

export default function SettingsIndex() {
  const { user, profile, house, members, isAdmin } = useApp();
  const [hapticsOn, setHapticsOn] = useState(haptics.isEnabled());
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

  const myAvatar = members.find((m) => m.uid === user.uid)?.avatar ?? null;

  return (
    <Screen>
      <Title>Settings</Title>
      {!myAvatar && <Tip id="settings">Add a profile picture so your housemates know it&apos;s you. Tap your name below.</Tip>}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Profile picture"
        onPress={() => {
          haptics.tap();
          router.push('/settings/avatar');
        }}
        style={styles.me}
      >
        <Avatar avatar={myAvatar} name={profile?.username ?? '?'} size={64} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.heading}>{profile?.username}</Text>
          <Text style={type.small}>{myAvatar ? 'Change your picture' : 'Add a photo or character'}</Text>
        </View>
        <Icon name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>

      {isOwner && (
        <>
          <Label>App owner</Label>
          <ListGroup>
            <ListRow icon="stats-chart-outline" title="Dashboard" subtitle="Users, houses, activity, demographics" onPress={() => router.push('/settings/dashboard')} />
            <ListRow icon="mail-outline" title="Feedback inbox" subtitle="Bug reports and suggestions" onPress={() => router.push('/settings/inbox')} />
          </ListGroup>
        </>
      )}

      <Label>You</Label>
      <ListGroup>
        <ListRow icon="person-outline" title="Personal details" subtitle="Username, date of birth, university" onPress={() => router.push('/settings/personal')} />
        <ListRow
          icon="phone-portrait-outline"
          title="Haptics"
          subtitle="Gentle vibration when you tap (app only)"
          right={
            <Switch
              value={hapticsOn}
              onValueChange={(v) => {
                haptics.setEnabled(v);
                setHapticsOn(v);
                haptics.select();
              }}
              trackColor={{ true: colors.text, false: colors.line }}
              thumbColor={hapticsOn ? colors.inverse : colors.muted}
              {...({ activeThumbColor: colors.inverse, activeTrackColor: colors.text } as object)}
              accessibilityLabel="Haptics"
            />
          }
        />
      </ListGroup>

      {isAdmin ? (
        <>
          <Label>House admin</Label>
          <ListGroup>
            <ListRow icon="list-outline" title="Chores" subtitle="Choose and add chores" onPress={() => router.push('/settings/chores')} />
            <ListRow icon="people-outline" title="Housemates" subtitle="Remove people, hand over admin" onPress={() => router.push('/settings/housemates')} />
            <ListRow icon="options-outline" title="House details" subtitle="Name, leaderboard reset, wallpaper" onPress={() => router.push('/settings/house-details')} />
          </ListGroup>
        </>
      ) : (
        <Text style={type.small}>
          {admin ? `${admin.username} is the house admin` : 'Your house admin'} and manages the chores and housemates.
        </Text>
      )}

      <Label>Help</Label>
      <ListGroup>
        <ListRow icon="information-circle-outline" title="How Choreboard works" onPress={() => router.push('/how-it-works')} />
        <ListRow icon="shield-checkmark-outline" title="Privacy policy" subtitle="What we collect and why" onPress={() => router.push('/privacy')} />
        <ListRow icon="bulb-outline" title="Show tips again" subtitle="The first-time tips on each tab" onPress={() => { resetTips(); notify('Done', 'Tips will show again on each tab.'); }} />
        <ListRow icon="bug-outline" title="Report a bug" subtitle="Something not working? Tell us" onPress={() => router.push({ pathname: '/settings/feedback', params: { type: 'bug' } })} />
        <ListRow icon="bulb-outline" title="Make a suggestion" subtitle="Ideas to make Choreboard better" onPress={() => router.push({ pathname: '/settings/feedback', params: { type: 'suggestion' } })} />
      </ListGroup>

      <Label>Account</Label>
      <Button title="Leave house" icon="exit-outline" variant="secondary" onPress={leave} loading={busy === 'leave'} disabled={!!busy} />
      <Button title="Delete my account" icon="trash-outline" variant="danger" onPress={del} loading={busy === 'delete'} disabled={!!busy} />

      <Text selectable style={[type.small, { textAlign: 'center', marginTop: space.lg, fontFamily: fonts.mono, fontSize: 11 }]}>
        Account ID: {user.uid}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  me: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
});
