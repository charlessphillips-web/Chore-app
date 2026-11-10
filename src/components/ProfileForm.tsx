import { useState } from 'react';
import { Text } from 'react-native';
import { dobError } from '../lib/dob';
import { isAllowedUniversity } from '../lib/universities';
import { GENDERS, type Gender, type ProfileDetails } from '../lib/types';
import { DobPicker } from './DobPicker';
import { UniversityInput } from './UniversityInput';
import { Button, Chip, ChipRow, ErrorText, Input, Label } from './ui';
import { colors } from './theme';

/** Username, date of birth, gender, student, university. Used at sign-up and in Settings. */
export function ProfileForm({
  initial,
  submitLabel,
  onSubmit,
  footer,
}: {
  initial?: Partial<ProfileDetails>;
  submitLabel: string;
  onSubmit: (p: ProfileDetails) => Promise<void>;
  /** Shown just above the button, e.g. the privacy tick-box. */
  footer?: React.ReactNode;
}) {
  const [username, setUsername] = useState(initial?.username ?? '');
  const [dob, setDob] = useState(initial?.dob ?? '');
  const [gender, setGender] = useState<Gender | null>(initial?.gender ?? null);
  const [isStudent, setIsStudent] = useState<boolean | null>(initial?.isStudent ?? null);
  const [university, setUniversity] = useState(initial?.university ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (username.trim().length < 2) return setError('Pick a username (at least 2 characters).');
    const dErr = dobError(dob);
    if (dErr) return setError(dErr);
    if (!gender) return setError('Choose a gender option (or "Prefer not to say").');
    if (isStudent === null) return setError('Let us know if you are a university student.');
    if (isStudent && !isAllowedUniversity(university)) {
      return setError('Pick your university from the list (or tap "My university isn\'t listed").');
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit({
        username: username.trim(),
        dob,
        gender,
        isStudent,
        university: isStudent ? university : null,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Label>Username</Label>
      <Input value={username} onChangeText={setUsername} placeholder="What your housemates will see" autoCapitalize="words" maxLength={24} />

      <Label>Date of birth</Label>
      <DobPicker value={dob} onChange={setDob} />

      <Label>Gender</Label>
      <ChipRow>
        {GENDERS.map((g) => (
          <Chip key={g} label={g} selected={gender === g} onPress={() => setGender(g)} />
        ))}
      </ChipRow>

      <Label>University student?</Label>
      <ChipRow>
        <Chip label="Yes" selected={isStudent === true} onPress={() => setIsStudent(true)} />
        <Chip label="No" selected={isStudent === false} onPress={() => setIsStudent(false)} />
      </ChipRow>

      {isStudent && (
        <>
          <Label>University</Label>
          <UniversityInput value={university} onChange={(v) => { setUniversity(v); setError(null); }} />
        </>
      )}

      {footer}
      <ErrorText>{error}</ErrorText>
      <Button title={submitLabel} onPress={submit} loading={saving} />
      <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>
        Your date of birth, gender and university are never shown to housemates.
      </Text>
    </>
  );
}
