import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../../context/AppContext';
import { setAvatar } from '../../../lib/db';
import {
  BGS, EXTRAS, EYES, HAIR_COLORS, HAIRS, MOUTHS, randomCharacter, SKINS, type Avatar as AvatarData, type CharacterAvatar,
} from '../../../lib/avatar';
import { pickProfileImage, type PickedImage } from '../../../lib/photos';
import { haptics } from '../../../lib/haptics';
import { Avatar } from '../../../components/Avatar';
import { PhotoCropper } from '../../../components/PhotoCropper';
import { Button, Chip, ChipRow, ErrorText, Label, Loading, notify, Screen } from '../../../components/ui';
import { colors, fonts, space } from '../../../components/theme';

type Mode = 'photo' | 'character';

/** Pick your own profile picture: a photo (cropped in a circle) or a drawn character. */
export default function AvatarScreen() {
  const { user, profile, house, members } = useApp();
  const current = members.find((m) => m.uid === user?.uid)?.avatar ?? null;
  const [draft, setDraft] = useState<AvatarData | null>(current);
  const [mode, setMode] = useState<Mode>(current?.kind === 'character' ? 'character' : 'photo');
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user || !profile || !house) return <Loading />;

  const character: CharacterAvatar = draft?.kind === 'character' ? draft : { ...randomCharacter(() => 0.3), kind: 'character' };
  const setPart = (k: keyof Omit<CharacterAvatar, 'kind'>, v: number) => setDraft({ ...character, [k]: v });

  async function pick(from: 'camera' | 'library') {
    setError(null);
    try {
      const img = await pickProfileImage(from);
      if (img) setPicked(img);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function save(a: AvatarData | null) {
    setBusy(true);
    setError(null);
    try {
      await setAvatar(house!.id, user!.uid, a);
      haptics.success();
      notify('Saved', a ? 'Your housemates will see your new picture.' : 'Picture removed.');
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Screen edges={['left', 'right']}>
      <View style={styles.preview}>
        <Avatar avatar={draft} name={profile.username} size={150} />
      </View>

      <View style={styles.segment}>
        {(['photo', 'character'] as Mode[]).map((m) => (
          <Pressable
            key={m}
            accessibilityRole="button"
            accessibilityState={{ selected: mode === m }}
            onPress={() => {
              haptics.select();
              setMode(m);
              if (m === 'character' && draft?.kind !== 'character') setDraft(character);
            }}
            style={[styles.segBtn, mode === m && styles.segOn]}
          >
            <Text style={[styles.segText, mode === m && { color: colors.inverse }]}>{m === 'photo' ? 'PHOTO' : 'CHARACTER'}</Text>
          </Pressable>
        ))}
      </View>

      {mode === 'photo' && (
        <>
          <Button title="Take a photo" icon="camera-outline" variant="secondary" onPress={() => pick('camera')} />
          <Button title="Choose from photos" icon="images-outline" variant="secondary" onPress={() => pick('library')} />
          {draft?.kind === 'photo' && draft !== current && (
            <Button title="Save photo" onPress={() => save(draft)} loading={busy} />
          )}
        </>
      )}

      {mode === 'character' && (
        <>
          <Label>Skin</Label>
          <Swatches colors={SKINS} value={character.skin} onPick={(v) => setPart('skin', v)} />
          <Label>Hair</Label>
          <Options names={HAIRS} value={character.hair} onPick={(v) => setPart('hair', v)} />
          <Label>Hair colour</Label>
          <Swatches colors={HAIR_COLORS} value={character.hairColor} onPick={(v) => setPart('hairColor', v)} />
          <Label>Eyes</Label>
          <Options names={EYES} value={character.eyes} onPick={(v) => setPart('eyes', v)} />
          <Label>Mouth</Label>
          <Options names={MOUTHS} value={character.mouth} onPick={(v) => setPart('mouth', v)} />
          <Label>Extras</Label>
          <Options names={EXTRAS} value={character.extra} onPick={(v) => setPart('extra', v)} />
          <Label>Background</Label>
          <Swatches colors={BGS} value={character.bg} onPick={(v) => setPart('bg', v)} />
          <Button title="Shuffle" icon="shuffle" variant="secondary" onPress={() => setDraft(randomCharacter())} />
          <Button title="Save character" onPress={() => save(character)} loading={busy} />
        </>
      )}

      {current && <Button title="Remove picture" variant="ghost" onPress={() => save(null)} disabled={busy} />}
      <ErrorText>{error}</ErrorText>

      {picked && (
        <PhotoCropper
          image={picked}
          onCancel={() => setPicked(null)}
          onDone={(data) => {
            setPicked(null);
            setDraft({ kind: 'photo', data });
          }}
        />
      )}
    </Screen>
  );
}

function Options({ names, value, onPick }: { names: string[]; value: number; onPick: (v: number) => void }) {
  return (
    <ChipRow>
      {names.map((n, i) => <Chip key={n} label={n} selected={value === i} onPress={() => onPick(i)} />)}
    </ChipRow>
  );
}

function Swatches({ colors: list, value, onPick }: { colors: string[]; value: number; onPick: (v: number) => void }) {
  return (
    <View style={styles.swatches}>
      {list.map((c, i) => (
        <Pressable
          key={c}
          accessibilityRole="button"
          accessibilityLabel={`Colour ${i + 1}`}
          accessibilityState={{ selected: value === i }}
          onPress={() => {
            haptics.select();
            onPick(i);
          }}
          style={[styles.swatch, { backgroundColor: c }, value === i && styles.swatchOn]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center', paddingVertical: space.md },
  segment: { flexDirection: 'row', borderRadius: 999, borderWidth: 1, borderColor: colors.line, padding: 3 },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  segOn: { backgroundColor: colors.text },
  segText: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1.2, color: colors.muted },
  swatches: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.line },
  swatchOn: { borderWidth: 3, borderColor: colors.text },
});
