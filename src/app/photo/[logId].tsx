import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { getChorePhoto } from '../../lib/db';
import { jpegUri } from '../../lib/photos';
import { StatusBadge } from '../../components/StatusBadge';
import { ErrorText, Screen, Subtitle, Title, timeAgo } from '../../components/ui';
import { colors, radius } from '../../components/theme';

/** Full-size chore photo. */
export default function PhotoScreen() {
  const { logId } = useLocalSearchParams<{ logId: string }>();
  const { house, logs, user } = useApp();
  const log = logs.find((l) => l.id === logId);
  const [full, setFull] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const kept = log?.photoDeleted ?? false;
  useEffect(() => {
    if (!house || !logId || kept) return;
    getChorePhoto(house.id, logId)
      .then((d) => (d ? setFull(d) : setError('No photo for this chore.')))
      .catch((e) => setError(e.message));
  }, [house, logId, kept]);

  if (!log || !house || !user) {
    return <Screen edges={['left', 'right']}><Subtitle>This chore is no longer in the recent activity.</Subtitle></Screen>;
  }
  const src = full ?? log.photoThumb;
  return (
    <Screen edges={['left', 'right']}>
      <Title>{log.choreName}</Title>
      <Text style={{ color: colors.muted }}>{log.userId === user.uid ? 'You' : log.username} · {timeAgo(log.at)}</Text>
      <StatusBadge log={log} />
      <View style={{ borderRadius: radius, overflow: 'hidden', aspectRatio: 3 / 4, backgroundColor: colors.card }}>
        {src && <Image source={{ uri: jpegUri(src) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />}
        {!full && !error && !kept && (
          <ActivityIndicator style={{ position: 'absolute', top: '50%', alignSelf: 'center' }} color={colors.primaryBright} />
        )}
      </View>
      {kept && <Text style={{ color: colors.muted, fontSize: 13 }}>Only a small copy is kept once a chore has been checked, to save space.</Text>}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
