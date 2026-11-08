import { useState } from 'react';
import { Redirect } from 'expo-router';
import { useApp } from '../context/AppContext';
import { createHouse, joinHouse } from '../lib/db';
import { Button, Card, Chip, ChipRow, ErrorText, Input, Label, Screen, Subtitle, Title } from '../components/ui';

export default function HouseSetup() {
  const { user, profile } = useApp();
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Move on as soon as the profile update arrives (avoids racing the database).
  if (profile?.houseId) return <Redirect href="/" />;

  async function go() {
    if (!user || !profile) return;
    setError(null);
    setBusy(true);
    try {
      if (mode === 'create') {
        if (name.trim().length < 2) throw new Error('Give your house a name, e.g. "42 Hyde Park Rd".');
        await createHouse(user.uid, profile.username, name);
      } else {
        await joinHouse(user.uid, profile.username, code);
      }
      // Stay "busy" — the Redirect above fires when the profile updates.
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Your house</Title>
      <Subtitle>
        First one in your house? Create it and share the code. Otherwise, ask a housemate for their code.
      </Subtitle>

      <ChipRow>
        <Chip label="Join with a code" selected={mode === 'join'} onPress={() => setMode('join')} />
        <Chip label="Create a house" selected={mode === 'create'} onPress={() => setMode('create')} />
      </ChipRow>

      <Card>
        {mode === 'join' ? (
          <>
            <Label>House code</Label>
            <Input
              value={code}
              onChangeText={setCode}
              placeholder="e.g. K7MPQ2"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              style={{ fontSize: 24, letterSpacing: 4, textAlign: 'center' }}
            />
          </>
        ) : (
          <>
            <Label>House name</Label>
            <Input value={name} onChangeText={setName} placeholder='e.g. "42 Hyde Park Rd"' maxLength={40} />
          </>
        )}
      </Card>

      <ErrorText>{error}</ErrorText>
      <Button title={mode === 'join' ? 'Join house' : 'Create house'} onPress={go} loading={busy} />
    </Screen>
  );
}
