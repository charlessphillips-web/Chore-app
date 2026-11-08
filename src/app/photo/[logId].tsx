import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { getChorePhoto } from '../../lib/db';
import { jpegUri } from '../../lib/photos';
import { StatusBadge, VoteButtons } from '../../components/ChoreLogCard';
import { Card, ErrorText, Screen, Subtitle, Title, timeAgo } from '../../components/ui';
import { colors, radius } from '../../components/theme';

/** Full-size chore photo, for housemates to check. */
export default function PhotoScreen() {
  const { logId } = useLocalSearchParams<{ logId: string }>();
  const { house, logs, user } = useApp();
  const log = logs.find((l) => l.id === logId);
  const [full, setFull] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!house || !logId) return;
    getChorePhoto(house.id, logId)
      .then((d) => (d ? setFull(d) : setError('No photo for this chore.')))
      .catch((e) => setError(e.message));
  }, [house, logId]);

  if (!log || !house || !user) {
    return <Screen><Subtitle>This chore is no longer in the recent activity.</Subtitle></Screen>;
  }

  const src = full ?? log.photoThumb;
  return (
    <Screen>
      <Title>{log.choreName}</Title>
      <Subtitle>{log.userId === user.uid ? 'You' : log.username} · {timeAgo(log.at)}</Subtitle>
      <View style={{ borderRadius: radius, overflow: 'hidden', aspectRatio: 3 / 4, backgroundColor: colors.border }}>
        {src && <Image source={{ uri: jpegUri(src) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />}
        {!full && !error && (
          <ActivityIndicator style={{ position: 'absolute', top: '50%', alignSelf: 'center' }} color={colors.primary} />
        )}
      </View>
      <ErrorText>{error}</ErrorText>
      <Card>
        <StatusBadge status={log.status} />
        <Text style={{ color: colors.muted }}>Is this chore done properly?</Text>
        <VoteButtons log={log} houseId={house.id} myUid={user.uid} />
      </Card>
    </Screen>
  );
}
