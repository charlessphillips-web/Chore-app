import { useState } from 'react';
import { Text, View } from 'react-native';
import { areaLabel, isValidPostcode, lookupPostcode, type HouseArea } from '../lib/postcode';
import { haptics } from '../lib/haptics';
import { Button, ErrorText, Icon, Input } from './ui';
import { colors, space, type } from './theme';

/**
 * Postcode box with a Find button. Only the area (e.g. "LS6 · Leeds") is
 * kept, not the full postcode.
 */
export function PostcodeField({ value, onChange, onUnavailable }: {
  value: HouseArea | null;
  onChange: (a: HouseArea) => void;
  /** The lookup service couldn't be reached (so don't insist on a postcode). */
  onUnavailable?: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  async function find() {
    setError(null);
    if (!isValidPostcode(text)) return setError('That doesn’t look like a UK postcode, e.g. LS6 1AB.');
    setBusy(true);
    try {
      const a = await lookupPostcode(text);
      if (!a) {
        haptics.warning();
        setError('We couldn’t find that postcode. Check it and try again.');
      } else {
        haptics.success();
        setEditing(false);
        onChange(a);
      }
    } catch {
      onUnavailable?.();
      setError('Couldn’t check the postcode right now. You can carry on and add it later in Settings.');
    } finally {
      setBusy(false);
    }
  }

  if (value && !editing) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Icon name="location" size={18} color={colors.success} />
        <Text style={[type.body, { flex: 1 }]}>{areaLabel(value)}</Text>
        <Text accessibilityRole="button" onPress={() => { setEditing(true); setText(''); }} style={[type.small, { padding: 6 }]}>
          Change
        </Text>
      </View>
    );
  }
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Input
          value={text}
          onChangeText={(t) => { setText(t.toUpperCase()); setError(null); }}
          placeholder="e.g. LS6 1AB"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={9}
          accessibilityLabel="Postcode"
          style={{ flex: 1, minWidth: 0 }}
          onSubmitEditing={find}
        />
        <Button title="Find" variant="secondary" onPress={find} loading={busy} disabled={!text.trim()} style={{ paddingHorizontal: 20, flexShrink: 0 }} />
      </View>
      <ErrorText>{error}</ErrorText>
      <Text style={type.small}>Only the area is saved (e.g. LS6 · Leeds), never your full address.</Text>
    </View>
  );
}
