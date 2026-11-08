import { Text } from 'react-native';
import { useApp } from '../../context/AppContext';
import { ChoreLogCard } from '../../components/ChoreLogCard';
import { Card, Screen, Subtitle, Title } from '../../components/ui';
import { colors } from '../../components/theme';

export default function Activity() {
  const { logs, user, house } = useApp();
  const toCheck = user ? logs.filter((l) => l.userId !== user.uid && l.status === 'pending' && !l.okVoters.includes(user.uid) && !l.notOkVoters.includes(user.uid)).length : 0;
  return (
    <Screen>
      <Title>Activity</Title>
      <Subtitle>
        Every chore comes with a photo. Tap a photo to see it bigger, then vote on whether it&apos;s done properly.
        {toCheck > 0 ? ` You have ${toCheck} to check.` : ''}
      </Subtitle>
      <Card>
        {logs.length === 0 || !user || !house ? (
          <Text style={{ fontSize: 13, color: colors.muted }}>No chores logged yet — be the first!</Text>
        ) : (
          logs.map((l) => <ChoreLogCard key={l.id} log={l} houseId={house.id} myUid={user.uid} />)
        )}
      </Card>
    </Screen>
  );
}
