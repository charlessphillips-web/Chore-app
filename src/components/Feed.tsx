/**
 * The house feed (House tab): who's away, then every chore logged, newest
 * first, with emoji reactions. Tap an emoji to react (tap again to take it
 * off); the chore-doer gets a notification. You can't react to your own.
 */
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../context/AppContext';
import { reactToLog, REACTIONS, watchBonuses, type Bonus } from '../lib/db';
import { awayDaysBetween, tillLabel } from '../lib/away';
import { currentStreak, seedStreak } from '../lib/streak';
import { jpegUri } from '../lib/photos';
import { haptics } from '../lib/haptics';
import type { ChoreLog } from '../lib/types';
import { Avatar } from './Avatar';
import { StatusBadge } from './StatusBadge';
import { Empty, notify, timeAgo } from './ui';
import { colors, soft } from './theme';
import { Tap } from './Tap';
import { SkeletonList } from './Skeleton';
import { Item } from './Motion';

const chipOn = () => ({ borderColor: colors.you, backgroundColor: soft(colors.you) });

export function Feed({ step = 10 }: { step?: number }) {
  const { user, profile, house, members, logs, houseLoaded } = useApp();
  const [now] = useState(() => Date.now());
  // Show 10 at a time so the page stays quick.
  const [shown, setShown] = useState(step);
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const houseId = house?.id;
  useEffect(() => (houseId ? watchBonuses(houseId, setBonuses, () => {}) : undefined), [houseId]);
  if (!user || !house) return null;
  if (!houseLoaded) return <SkeletonList rows={4} />;
  const away = members.filter((m) => m.away);
  const streaky = members
    .map((m) => ({ m, w: currentStreak(seedStreak(m.streak, m.lastCompletedAt), now, (a, b) => awayDaysBetween(m.aways, a, b)) }))
    .filter((x) => x.w >= 4)
    .sort((a, b) => b.w - a.w);

  return (
    <View style={{ gap: 10 }}>
      {away.map((m) => (
        <View key={`away-${m.uid}`} style={[styles.card, styles.row]}>
          <Avatar avatar={m.avatar} name={m.username} size={32} />
          <Text style={[styles.text, { flex: 1 }]}>
            <Text style={styles.name}>{m.uid === user.uid ? 'You' : m.username}</Text>
            {m.uid === user.uid ? ' are' : ' is'} away till {tillLabel(m.aways, now)} ✈️
          </Text>
        </View>
      ))}
      {streaky.map(({ m, w }) => (
        <View key={`streak-${m.uid}`} style={[styles.card, styles.row]}>
          <Avatar avatar={m.avatar} name={m.username} size={32} />
          <Text style={[styles.text, { flex: 1 }]}>
            <Text style={[styles.name, m.uid === user.uid && { color: colors.you }]}>{m.uid === user.uid ? 'You' : m.username}</Text>
            {m.uid === user.uid ? ' are' : ' is'} on a {w}-week streak 🔥
          </Text>
        </View>
      ))}
      {bonuses.filter((b) => now - b.at < 30 * 86_400_000).map((b) => (
        <View key={`bonus-${b.id}`} style={[styles.card, styles.row]}>
          <Text style={{ fontSize: 26 }}>🎁</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.text}>
              <Text style={[styles.name, b.to === user.uid && { color: colors.you }]}>{b.to === user.uid ? 'You' : b.toName}</Text>
              {b.to === user.uid ? ' got ' : ' got '}<Text style={styles.name}>{b.points} bonus points</Text>
            </Text>
            {!!b.reason && <Text style={[styles.text, { fontSize: 14, fontStyle: 'italic' }]} numberOfLines={2}>&ldquo;{b.reason}&rdquo;</Text>}
            <Text style={styles.sub}>From {b.by === user.uid ? 'you' : b.byName} · {timeAgo(b.at)}</Text>
          </View>
        </View>
      ))}
      {logs.length === 0 ? (
        <View style={styles.card}><Empty icon="time-outline">No chores logged yet. They&apos;ll show up here.</Empty></View>
      ) : (
        logs.slice(0, shown).map((l, i) => (
          <Item key={l.id} index={i}>
            <FeedItem log={l} me={{ uid: user.uid, username: profile?.username ?? '' }} />
          </Item>
        ))
      )}
      {logs.length > shown && (
        <Tap onPress={() => { haptics.tap(); setShown((n) => n + step); }} accessibilityRole="button" style={styles.more}>
          <Text style={styles.moreText}>Show more</Text>
        </Tap>
      )}
    </View>
  );
}

function FeedItem({ log, me }: { log: ChoreLog; me: { uid: string; username: string } }) {
  const { house, members } = useApp();
  const [picking, setPicking] = useState(false);
  const mine = log.userId === me.uid;
  const who = members.find((m) => m.uid === log.userId);
  const myReaction = log.reactions[me.uid] ?? null;
  const counts = REACTIONS.map((e) => ({ e, n: Object.values(log.reactions).filter((x) => x === e).length })).filter((c) => c.n > 0);

  const react = (emoji: string) => {
    haptics.select();
    setPicking(false);
    reactToLog(house!.id, log, me, myReaction === emoji ? null : emoji, members).catch((e) => notify('Could not react', (e as Error).message));
  };

  return (
    <View style={styles.card}>
      <Tap
        onPress={() => router.push({ pathname: '/photo/[logId]', params: { logId: log.id } })}
        accessibilityRole="button"
        accessibilityLabel={`${mine ? 'You' : log.username}: ${log.choreName}. Open photo`}
        style={styles.row}
      >
        <Avatar avatar={who?.avatar} name={log.username} size={32} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.text} numberOfLines={2}>
            <Text style={[styles.name, mine && { color: colors.you }]}>{mine ? 'You' : log.username}</Text>
            {' · '}{log.choreName}{log.creditToName ? ` for ${log.creditTo === me.uid ? 'you' : log.creditToName}` : ''}
          </Text>
          {log.note && <Text style={[styles.text, { fontSize: 14, fontStyle: 'italic' }]} numberOfLines={2}>&ldquo;{log.note}&rdquo;</Text>}
          <Text style={styles.sub}>{timeAgo(log.at)} · +{log.points} pt{log.points === 1 ? '' : 's'}{log.beforePhoto ? ' · before & after' : ''}</Text>
          <StatusBadge log={log} />
        </View>
        {log.photoThumb ? (
          <Image source={{ uri: jpegUri(log.photoThumb) }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, { backgroundColor: colors.cardRaised }]} />
        )}
      </Tap>

      {(counts.length > 0 || !mine) && (
        <View style={styles.reactions}>
          {(picking ? [] : counts).map(({ e, n }) => (
            <Tap
              key={e}
              disabled={mine}
              onPress={() => react(e)}
              accessibilityRole="button"
              accessibilityLabel={`${e} ${n}${myReaction === e ? ', yours' : ''}`}
              style={[styles.chip, myReaction === e && chipOn()]}
            >
              <Text style={styles.chipText}>{e} {n}</Text>
            </Tap>
          ))}
          {!mine && (picking ? REACTIONS.map((e) => (
            <Tap key={e} onPress={() => react(e)} accessibilityRole="button" accessibilityLabel={`React ${e}`}
              style={[styles.chip, myReaction === e && chipOn()]}>
              <Text style={styles.chipText}>{e}</Text>
            </Tap>
          )) : (
            <Tap onPress={() => { haptics.tap(); setPicking(true); }} accessibilityRole="button" accessibilityLabel="Add a reaction" style={styles.chip}>
              <Text style={[styles.chipText, { color: colors.muted }]}>{counts.length ? '＋' : '＋ React'}</Text>
            </Tap>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 16, borderCurve: 'continuous' as const, padding: 14 },
  more: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999, borderCurve: 'continuous' as const, borderWidth: 1, borderColor: colors.line },
  moreText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { fontSize: 15, color: colors.text },
  name: { fontWeight: '700', color: colors.text },
  sub: { fontSize: 12, color: colors.muted },
  thumb: { width: 48, height: 48, borderRadius: 10, borderCurve: 'continuous' },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { backgroundColor: colors.cardRaised, borderRadius: 10, borderCurve: 'continuous' as const, paddingVertical: 5, paddingHorizontal: 10, borderWidth: 1, borderColor: 'transparent' },
  chipText: { fontSize: 13, color: colors.text },
});
