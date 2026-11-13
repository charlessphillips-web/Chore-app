import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { haptics } from '../../lib/haptics';
import { sendBackChore, verifyChore } from '../../lib/db';
import { jpegUri } from '../../lib/photos';
import { checkProgress, effectiveStatus, needsCheckBy, needsRedo, redoReason, REDO_REASONS, timeLeft } from '../../lib/review';
import type { ChoreLog } from '../../lib/types';
import { Button, Card, Chip, ChipRow, Icon, Input, Label, Loading, notify, Screen, Title, timeAgo } from '../../components/ui';
import { Avatar } from '../../components/Avatar';
import { choreIcon } from '../../lib/chores';
import { periodStart } from '../../lib/period';
import { colors, radius, space, type } from '../../components/theme';

type IconName = React.ComponentProps<typeof Icon>['name'];

/** Photos waiting for a check. One housemate's decision is enough; then it disappears. */
export default function Checks() {
  const { user, profile, house, logs } = useApp();
  if (!user || !profile || !house) return <Loading />;

  const toCheck = logs.filter((l) => needsCheckBy(l, user.uid));
  const minePending = logs.filter((l) => l.userId === user.uid && effectiveStatus(l) === 'pending');

  const since = periodStart(new Date(), house.reset).getTime();
  const checkedByMe = logs.filter((l) => l.at >= since && l.checks.includes(user.uid)).length;

  return (
    <Screen>
      <View style={styles.head}>
        <Title>Checks</Title>
        {toCheck.length > 0 && <Text style={styles.count}>{toCheck.length} to check</Text>}
      </View>

      {toCheck.length === 0 ? (
        <>
          <View style={styles.empty}>
            <Text style={{ fontSize: 44 }}>✨</Text>
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={[type.small, { textAlign: 'center' }]}>
              {checkedByMe > 0
                ? <>You&apos;ve checked <Text style={{ color: colors.you, fontWeight: '600' }}>{checkedByMe}</Text> chore{checkedByMe === 1 ? '' : 's'} this period. The house thanks you.</>
                : 'Nothing to check right now.'}
            </Text>
          </View>
          <Label>How checks work</Label>
          <Card style={{ gap: 8 }}>
            <HowRow icon="camera-outline" text="Someone logs a chore with a photo" />
            <HowRow icon="eye-outline" text="Two housemates check it (one in a 2-person house)" />
            <HowRow icon="checkmark" text="Then it counts" />
            <HowRow icon="time-outline" text="No check in 24 hours? It counts anyway" />
          </Card>
        </>
      ) : (
        toCheck.map((l) => <CheckCard key={l.id} log={l} reviewer={{ uid: user.uid, username: profile.username }} />)
      )}

      {minePending.length > 0 && (
        <>
          <Label>Yours, waiting for a check</Label>
          <Card>
            {minePending.map((l, i) => (
              <View key={l.id} style={[styles.mineRow, i > 0 && styles.divider]}>
                <Icon name={choreIcon(l.choreKey) as IconName} size={18} color={colors.text} />
                <View style={{ flex: 1 }}>
                  <Text style={type.body} numberOfLines={1}>{l.choreName}</Text>
                  <Text style={type.small}>{timeLeft(l.at)}</Text>
                </View>
                <Dots done={checkProgress(l).done} needed={checkProgress(l).needed} />
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

function HowRow({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Icon name={icon} size={18} color={colors.muted} />
      <Text style={[type.body, { fontSize: 14, flex: 1 }]}>{text}</Text>
    </View>
  );
}

/** ▬ ▭  = 1 of 2 checks. */
function Dots({ done, needed }: { done: number; needed: number }) {
  return (
    <View style={styles.dots} accessibilityLabel={`${done} of ${needed} checks`}>
      {Array.from({ length: needed }, (_, i) => <View key={i} style={[styles.dot, i < done && styles.dotOn]} />)}
    </View>
  );
}

function CheckCard({ log, reviewer }: { log: ChoreLog; reviewer: { uid: string; username: string } }) {
  const { house, members } = useApp();
  const [busy, setBusy] = useState<'verify' | 'back' | null>(null);
  const [sendingBack, setSendingBack] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');

  async function verify() {
    setBusy('verify');
    try {
      const r = await verifyChore(house!.id, log.id, reviewer);
      haptics.success();
      if (r.done < r.needed) notify('Thanks!', `${r.needed - r.done} more housemate needs to check it before it's verified.`);
    } catch (e) {
      notify('Could not save', (e as Error).message);
      setBusy(null);
    }
  }
  async function sendBack() {
    if (!reason) return;
    setBusy('back');
    try {
      await sendBackChore(house!, log.id, reviewer, redoReason(reason, note), members);
    } catch (e) {
      notify('Could not send back', (e as Error).message);
      setBusy(null);
    }
  }

  const who = members.find((m) => m.uid === log.userId);
  const prog = checkProgress(log);
  return (
    <Card style={{ padding: 10 }}>
      <Pressable
        onPress={() => router.push({ pathname: '/photo/[logId]', params: { logId: log.id } })}
        accessibilityRole="imagebutton"
        accessibilityLabel={`Photo of ${log.choreName}`}
      >
        {log.photoThumb ? (
          <Image source={{ uri: jpegUri(log.photoThumb) }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={[styles.photo, { backgroundColor: colors.cardRaised }]} />
        )}
        <Text style={styles.enlarge}>tap to enlarge</Text>
      </Pressable>
      <View style={{ padding: 6, paddingTop: 12, gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar avatar={who?.avatar} name={log.username} size={32} />
          <View style={{ flex: 1 }}>
            <Text style={type.heading} numberOfLines={1}>{log.choreName}</Text>
            <Text style={type.small}>
              {log.username}{log.creditToName ? ` (for ${log.creditToName})` : ''} · {timeAgo(log.at)} · {timeLeft(log.at)}
            </Text>
          </View>
        </View>
        {prog.needed > 1 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Dots done={prog.done} needed={prog.needed} />
            <Text style={type.small}>{prog.done} of {prog.needed}{log.checkNames.length ? ` · ${log.checkNames.join(', ')} ✓` : ''}</Text>
          </View>
        )}

        {!sendingBack ? (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title="Send back" icon="arrow-undo" variant="secondary" style={{ flex: 1, paddingHorizontal: 10 }} onPress={() => setSendingBack(true)} disabled={!!busy} />
            <Button title="Looks good" icon="checkmark" style={{ flex: 1, paddingHorizontal: 10 }} onPress={verify} loading={busy === 'verify'} disabled={!!busy} />
          </View>
        ) : (
          <View style={{ gap: space.sm }}>
            <Text style={type.body}>Why does it need redoing?</Text>
            <ChipRow>
              {REDO_REASONS.map((r) => (
                <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
              ))}
            </ChipRow>
            <Input value={note} onChangeText={setNote} placeholder="Add a note (optional)" maxLength={100} />
            <Text style={type.small}>
              {reason && !needsRedo(reason)
                ? `It won't count, and there's nothing for ${log.username} to redo.`
                : `It won't count, and goes back to ${log.username} to redo.`}
            </Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button title="Cancel" variant="ghost" style={{ flex: 1 }} onPress={() => setSendingBack(false)} disabled={!!busy} />
              <Button title="Send back" variant="danger" style={{ flex: 1 }} onPress={sendBack} loading={busy === 'back'} disabled={!reason || !!busy} />
            </View>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { fontSize: 12, color: colors.text, backgroundColor: colors.cardRaised, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 9, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius - 4 },
  enlarge: {
    position: 'absolute', left: 10, top: 10, fontSize: 11, color: colors.text, backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8, overflow: 'hidden',
  },
  empty: { backgroundColor: colors.card, borderRadius: 20, alignItems: 'center', paddingVertical: 32, paddingHorizontal: 18, gap: 6 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: colors.text },
  mineRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 18, height: 5, borderRadius: 3, backgroundColor: colors.line },
  dotOn: { backgroundColor: colors.text },
});
