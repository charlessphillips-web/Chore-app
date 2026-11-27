import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApp } from '../../context/AppContext';
import { BONUS_MAX, giveBonus, makeAdmin, removeMember } from '../../lib/db';
import { haptics } from '../../lib/haptics';
import type { Member } from '../../lib/types';
import { Button, Card, Chip, ChipRow, confirm, ErrorText, Input, Loading, notify, Screen, Subtitle } from '../../components/ui';
import { colors, space, type } from '../../components/theme';

/** Admin: give bonus points, remove housemates or hand over the admin role. */
export default function Housemates() {
  const { user, profile, house, members, isAdmin } = useApp();
  const [bonusFor, setBonusFor] = useState<string | null>(null);
  if (!user || !house) return <Loading />;
  if (!isAdmin) return <Screen edges={['left', 'right']}><Subtitle>Only the house admin can manage housemates.</Subtitle></Screen>;

  const others = members.filter((m) => m.uid !== user.uid).sort((a, b) => a.username.localeCompare(b.username));

  async function remove(uid: string, name: string) {
    if (!(await confirm(`Remove ${name}?`, `${name} will be taken out of the house and off the leaderboard.`, 'Remove'))) return;
    try {
      await removeMember(house!.id, uid);
    } catch (e) {
      notify('Could not remove', (e as Error).message);
    }
  }
  async function handOver(uid: string, name: string) {
    if (!(await confirm(`Make ${name} admin?`, "You'll no longer be able to manage chores or housemates.", 'Make admin'))) return;
    try {
      await makeAdmin(house!.id, uid);
    } catch (e) {
      notify('Could not change admin', (e as Error).message);
    }
  }

  return (
    <Screen edges={['left', 'right']}>
      {others.length === 0 ? (
        <Subtitle>Nobody else has joined yet. Share your house code from the House tab.</Subtitle>
      ) : (
        others.map((m) => (
          <Card key={m.uid}>
            <Text style={type.heading}>{m.username}</Text>
            {isLikelyDuplicate(m, members) && (
              <Text style={[type.small, { color: colors.warning }]}>
                Possible duplicate: same name as another housemate and no chores ever. If they made a second account by mistake, remove this one.
              </Text>
            )}
            <Text style={type.small}>{m.points ?? m.totalCompleted} points · {m.totalCompleted} chore{m.totalCompleted === 1 ? '' : 's'} this period</Text>
            {bonusFor === m.uid ? (
              <BonusForm member={m} onDone={() => setBonusFor(null)}
                give={(pts, reason) => giveBonus(house, { uid: user.uid, username: profile?.username ?? 'Admin' }, m, pts, reason)} />
            ) : (
              <Button title="Give bonus points" icon="gift-outline" variant="secondary" onPress={() => setBonusFor(m.uid)} />
            )}
            <View style={styles.actions}>
              <Button title="Make admin" variant="secondary" style={{ flex: 1 }} onPress={() => handOver(m.uid, m.username)} />
              <Button title="Remove" variant="danger" style={{ flex: 1 }} onPress={() => remove(m.uid, m.username)} />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
});

/** Never done a chore, and shares a first name with someone who has, or who joined earlier (the newer one is the spare). */
function isLikelyDuplicate(
  m: { uid: string; username: string; lastCompletedAt: number | null; joinedAt: number },
  all: { uid: string; username: string; lastCompletedAt: number | null; joinedAt: number }[],
) {
  const first = (n: string) => n.trim().toLowerCase().split(/\s+/)[0];
  return !m.lastCompletedAt && all.some((o) => o.uid !== m.uid && first(o.username) === first(m.username)
    && (!!o.lastCompletedAt || o.joinedAt < m.joinedAt));
}

/** Pick 5 / 10 / 15 / 20 points and say why. Everyone sees it in the house feed. */
function BonusForm({ member, give, onDone }: { member: Member; give: (points: number, reason: string) => Promise<void>; onDone: () => void }) {
  const [points, setPoints] = useState(10);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    if (!reason.trim()) return setError('Say why, e.g. "Loads of chores before we had Rotawise".');
    if (!(await confirm(`Give ${member.username} ${points} points?`, 'They go on this period\'s table, and everyone in the house sees it in the feed.', 'Give points'))) return;
    setBusy(true);
    setError(null);
    try {
      await give(points, reason);
      haptics.success();
      notify('Done', `${member.username} got ${points} bonus points.`);
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: space.sm }}>
      <Text style={type.small}>How many points? (max {BONUS_MAX})</Text>
      <ChipRow>
        {[5, 10, 15, 20].map((n) => <Chip key={n} label={`+${n}`} selected={points === n} onPress={() => setPoints(n)} />)}
      </ChipRow>
      <Input value={reason} onChangeText={setReason} placeholder='Why? e.g. "Loads of chores before Rotawise"' maxLength={80} accessibilityLabel="Reason" />
      <ErrorText>{error}</ErrorText>
      <View style={styles.actions}>
        <Button title="Cancel" variant="ghost" style={{ flex: 1 }} onPress={onDone} />
        <Button title={`Give +${points}`} style={{ flex: 1 }} loading={busy} onPress={go} />
      </View>
    </View>
  );
}
