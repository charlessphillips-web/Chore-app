import { useMemo, useState } from 'react';
import { Alert, Text } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../context/AppContext';
import { requestChore } from '../lib/db';
import { choreKey } from '../lib/chores';
import { pickAssignee, type AssignMode } from '../lib/assign';
import { ChorePicker } from '../components/ChorePicker';
import { Button, Card, Chip, ChipRow, ErrorText, Label, Screen, Subtitle } from '../components/ui';
import { colors } from '../components/theme';

export default function RequestChore() {
  const { user, profile, house, members } = useApp();
  const [chore, setChore] = useState('');
  const [mode, setMode] = useState<AssignMode>('overall');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const key = choreKey(chore);
  // Live preview of who'll be asked, using the same logic as the real send.
  const preview = useMemo(
    () => (user && key ? pickAssignee(members, user.uid, mode, key) : null),
    [members, user, mode, key],
  );

  async function send() {
    if (!user || !profile || !house) return;
    setError(null);
    setSending(true);
    try {
      const { assignee, notified } = await requestChore({
        houseId: house.id,
        houseName: house.name,
        requester: { uid: user.uid, username: profile.username },
        members,
        choreName: chore,
        mode,
      });
      Alert.alert(
        'Sent',
        notified
          ? `${assignee.username} has been notified.`
          : `Added to ${assignee.username}'s list. (They haven't turned on notifications, so they'll see it next time they open the app.)`,
      );
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setSending(false);
    }
  }

  return (
    <Screen>
      <Subtitle>Spotted something that needs doing? We'll ask whoever's done the least.</Subtitle>
      <ChorePicker value={chore} onChange={setChore} />

      <Label>Who should do it?</Label>
      <ChipRow>
        <Chip label="Fewest chores overall" selected={mode === 'overall'} onPress={() => setMode('overall')} />
        <Chip label="Fewest of this chore" selected={mode === 'chore'} onPress={() => setMode('chore')} />
      </ChipRow>

      {key ? (
        <Card>
          <Text style={{ color: colors.muted }}>This will go to</Text>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
            {preview ? preview.username : 'Nobody yet — you are the only one in the house'}
          </Text>
          {preview && (
            <Text style={{ color: colors.muted }}>
              {mode === 'chore'
                ? `Done "${chore.trim()}" ${preview.choreCounts[key] ?? 0} time(s)`
                : `${preview.totalCompleted} chore(s) done in total`}
            </Text>
          )}
        </Card>
      ) : null}

      <ErrorText>{error}</ErrorText>
      <Button title="Send request" onPress={send} loading={sending} disabled={!preview} />
    </Screen>
  );
}
