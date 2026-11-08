import { useState } from 'react';
import { router } from 'expo-router';
import { useApp } from '../context/AppContext';
import { logChore } from '../lib/db';
import { choreKey } from '../lib/chores';
import { ChorePicker } from '../components/ChorePicker';
import { Button, ErrorText, Screen, Subtitle } from '../components/ui';

export default function LogChore() {
  const { user, profile, house, openRequests } = useApp();
  const [chore, setChore] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!user || !profile || !house) return;
    setError(null);
    setSaving(true);
    try {
      // If someone had flagged this chore as needing doing, close that request too.
      const key = choreKey(chore);
      const match =
        openRequests.find((r) => r.choreKey === key && r.assignedTo === user.uid) ??
        openRequests.find((r) => r.choreKey === key);
      await logChore(house.id, user.uid, profile.username, chore, match?.id ?? null);
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Subtitle>Nice one. Log it so it counts towards your total.</Subtitle>
      <ChorePicker value={chore} onChange={setChore} />
      <ErrorText>{error}</ErrorText>
      <Button title="Log chore" onPress={save} loading={saving} disabled={!choreKey(chore)} />
    </Screen>
  );
}
