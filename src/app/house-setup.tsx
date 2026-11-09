import { useState } from 'react';
import { Redirect } from 'expo-router';
import { useApp } from '../context/AppContext';
import { createHouse, joinHouse } from '../lib/db';
import type { HouseArea } from '../lib/postcode';
import { PostcodeField } from '../components/PostcodeField';
import { Button, Card, Chip, ChipRow, ErrorText, Input, Label, Screen, Subtitle, Title } from '../components/ui';
import { colors } from '../components/theme';
import { Text } from 'react-native';

export default function HouseSetup() {
  const { user, profile, notice, clearNotice } = useApp();
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [area, setArea] = useState<HouseArea | null>(null);
  const [lookupDown, setLookupDown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Move on as soon as the profile update arrives (avoids racing the database).
  if (profile?.houseId) return <Redirect href="/" />;

  async function go() {
    if (!user || !profile) return;
    setError(null);
    setBusy(true);
    clearNotice();
    try {
      if (mode === 'create') {
        if (name.trim().length < 1) throw new Error('Give your house a name or number, e.g. "42".');
        if (!area && !lookupDown) throw new Error('Add your postcode and tap Find.');
        await createHouse(user.uid, profile.username, name, area);
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
      {notice && (
        <Card style={{ borderColor: colors.warning }}>
          <Text style={{ color: colors.text }}>{notice}</Text>
        </Card>
      )}
      <Subtitle>
        First one in your house? Create it, share the code, and you&apos;ll be the house admin. Otherwise, ask a
        housemate for their code.
      </Subtitle>

      <ChipRow>
        <Chip label="Join with a code" selected={mode === 'join'} onPress={() => setMode('join')} />
        <Chip label="Create a house" selected={mode === 'create'} onPress={() => setMode('create')} />
      </ChipRow>

      {mode === 'join' ? (
        <>
          <Label>House code</Label>
          <Input
            value={code}
            onChangeText={setCode}
            placeholder="K7MPQ2"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            style={{ fontSize: 26, letterSpacing: 6, textAlign: 'center', fontWeight: '600' }}
          />
        </>
      ) : (
        <>
          <Label>House name or number</Label>
          <Input value={name} onChangeText={setName} placeholder='e.g. "42" or "42 Hyde Park Rd"' maxLength={40} />
          <Label>Postcode</Label>
          <PostcodeField value={area} onChange={setArea} onUnavailable={() => setLookupDown(true)} />
        </>
      )}

      <ErrorText>{error}</ErrorText>
      <Button title={mode === 'join' ? 'Join house' : 'Create house'} onPress={go} loading={busy} />
    </Screen>
  );
}
