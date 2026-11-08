import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { voteOnChore } from '../lib/db';
import { jpegUri } from '../lib/photos';
import type { Vote } from '../lib/review';
import type { ChoreLog } from '../lib/types';
import { timeAgo } from './ui';
import { colors, space } from './theme';

const BADGE = {
  pending: { label: '⏳ Waiting for a check', bg: '#FEF3C7', fg: '#92400E' },
  verified: { label: '✓ Verified', bg: '#D1FAE5', fg: '#065F46' },
  rejected: { label: '✗ Rejected — not counted', bg: '#FEE2E2', fg: '#991B1B' },
} as const;

export function StatusBadge({ status }: { status: ChoreLog['status'] }) {
  const b = BADGE[status];
  return (
    <View style={[styles.badge, { backgroundColor: b.bg }]}>
      <Text style={[styles.badgeText, { color: b.fg }]}>{b.label}</Text>
    </View>
  );
}

/** 👍 / 👎 buttons. Tapping your current vote again removes it. */
export function VoteButtons({ log, houseId, myUid }: { log: ChoreLog; houseId: string; myUid: string }) {
  const [busy, setBusy] = useState(false);
  if (log.userId === myUid) {
    return <Text style={styles.meta}>Your housemates will check this photo.</Text>;
  }
  const mine: Vote | null = log.okVoters.includes(myUid) ? 'ok' : log.notOkVoters.includes(myUid) ? 'not_ok' : null;

  async function vote(v: Vote) {
    setBusy(true);
    try {
      await voteOnChore(houseId, log.id, myUid, mine === v ? null : v);
    } catch (e) {
      Alert.alert('Could not save vote', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.voteRow}>
      <VoteButton label={`👍 Looks good (${log.okVoters.length})`} active={mine === 'ok'} color={colors.success} disabled={busy} onPress={() => vote('ok')} />
      <VoteButton label={`👎 Not done (${log.notOkVoters.length})`} active={mine === 'not_ok'} color={colors.danger} disabled={busy} onPress={() => vote('not_ok')} />
    </View>
  );
}

function VoteButton(p: { label: string; active: boolean; color: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: p.active, disabled: p.disabled }}
      onPress={p.onPress}
      disabled={p.disabled}
      style={[styles.vote, { borderColor: p.color }, p.active && { backgroundColor: p.color }, p.disabled && { opacity: 0.5 }]}
    >
      <Text style={[styles.voteText, { color: p.active ? '#fff' : p.color }]}>{p.label}</Text>
    </Pressable>
  );
}

/** One chore in the activity feed: who, what, photo, status and voting. */
export function ChoreLogCard({ log, houseId, myUid }: { log: ChoreLog; houseId: string; myUid: string }) {
  const open = () => router.push({ pathname: '/photo/[logId]', params: { logId: log.id } });
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Pressable onPress={open} accessibilityRole="imagebutton" accessibilityLabel={`Photo of ${log.choreName}`}>
          {log.photoThumb ? (
            <Image source={{ uri: jpegUri(log.photoThumb) }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.noPhoto]}><Text>📷</Text></View>
          )}
        </Pressable>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.title}>
            <Text style={{ fontWeight: '800' }}>{log.userId === myUid ? 'You' : log.username}</Text> · {log.choreName}
          </Text>
          <Text style={styles.meta}>{timeAgo(log.at)}{log.requestId ? ' · was requested' : ''}</Text>
          <StatusBadge status={log.status} />
        </View>
      </View>
      <VoteButtons log={log} houseId={houseId} myUid={myUid} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  top: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  thumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: colors.border },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, color: colors.text },
  meta: { fontSize: 13, color: colors.muted },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  voteRow: { flexDirection: 'row', gap: space.sm },
  vote: { flex: 1, borderWidth: 1.5, borderRadius: 999, paddingVertical: 8, alignItems: 'center' },
  voteText: { fontSize: 14, fontWeight: '700' },
});
