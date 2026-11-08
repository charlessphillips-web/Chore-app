import { useState } from 'react';
import { Redirect } from 'expo-router';
import { Text } from 'react-native';
import { useApp } from '../context/AppContext';
import { saveProfile } from '../lib/db';
import type { Gender } from '../lib/types';
import { Button, Chip, ChipRow, ErrorText, Input, Label, Screen, Subtitle, Title } from '../components/ui';
import { colors } from '../components/theme';

const GENDERS: Gender[] = ['Male', 'Female', 'Non-binary', 'Other', 'Prefer not to say'];
const MIN_AGE = 13;

export default function Onboarding() {
  const { user, profile } = useApp();
  const [username, setUsername] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [isStudent, setIsStudent] = useState<boolean | null>(null);
  const [university, setUniversity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Move on as soon as the saved profile arrives.
  if (profile) return <Redirect href="/" />;

  async function submit() {
    const ageNum = Number(age);
    if (username.trim().length < 2) return setError('Pick a username (at least 2 characters).');
    if (!Number.isInteger(ageNum) || ageNum < MIN_AGE || ageNum > 120)
      return setError(`Enter your age as a number (you must be ${MIN_AGE}+).`);
    if (!gender) return setError('Choose a gender option (or "Prefer not to say").');
    if (isStudent === null) return setError('Let us know if you are a university student.');
    if (isStudent && university.trim().length < 2) return setError('Which university are you at?');
    if (!user) return setError('Still connecting — try again in a second.');

    setError(null);
    setSaving(true);
    try {
      await saveProfile(user.uid, {
        username: username.trim(),
        age: ageNum,
        gender,
        isStudent,
        university: isStudent ? university.trim() : null,
      });
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Title>Welcome 👋</Title>
      <Subtitle>A few quick questions to set you up.</Subtitle>

      <Label>Username</Label>
      <Input value={username} onChangeText={setUsername} placeholder="What your housemates will see" autoCapitalize="words" maxLength={24} />

      <Label>Age</Label>
      <Input value={age} onChangeText={setAge} placeholder="e.g. 20" keyboardType="number-pad" maxLength={3} />

      <Label>Gender</Label>
      <ChipRow>
        {GENDERS.map((g) => (
          <Chip key={g} label={g} selected={gender === g} onPress={() => setGender(g)} />
        ))}
      </ChipRow>

      <Label>Are you a university student?</Label>
      <ChipRow>
        <Chip label="Yes" selected={isStudent === true} onPress={() => setIsStudent(true)} />
        <Chip label="No" selected={isStudent === false} onPress={() => setIsStudent(false)} />
      </ChipRow>

      {isStudent && (
        <>
          <Label>Which university?</Label>
          <Input value={university} onChangeText={setUniversity} placeholder="e.g. University of Leeds" autoCapitalize="words" />
        </>
      )}

      <ErrorText>{error}</ErrorText>
      <Button title="Continue" onPress={submit} loading={saving} />
      <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>
        Your age, gender and university are never shown to housemates.
      </Text>
    </Screen>
  );
}
