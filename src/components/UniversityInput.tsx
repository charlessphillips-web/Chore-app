import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { searchUniversities } from '../lib/universities';
import { Icon, Input } from './ui';
import { colors, radius, space } from './theme';

/** Type a few letters, tap a suggestion. Anything not on the list can still be typed. */
export function UniversityInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false);
  const matches = searchUniversities(value).filter((m) => m !== value);
  const show = focused && matches.length > 0;

  return (
    <View>
      <Input
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        // Small delay so tapping a suggestion registers before the list hides.
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="Start typing, e.g. Leeds or UCL"
        autoCapitalize="words"
        autoCorrect={false}
        style={show ? { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderColor: colors.primaryBright } : undefined}
      />
      {show && (
        <View style={styles.list} accessibilityRole="list">
          {matches.map((m, i) => (
            <Pressable
              key={m}
              accessibilityRole="button"
              accessibilityLabel={m}
              onPress={() => {
                onChange(m);
                setFocused(false);
              }}
              style={({ pressed }) => [styles.item, i > 0 && styles.divider, pressed && { backgroundColor: colors.cardRaised }]}
            >
              <Icon name="school-outline" size={16} color={colors.muted} />
              <Text style={styles.itemText}>{m}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: colors.card, borderWidth: 1, borderTopWidth: 0, borderColor: colors.primaryBright,
    borderBottomLeftRadius: radius, borderBottomRightRadius: radius, overflow: 'hidden',
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: 13 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  itemText: { fontSize: 15, color: colors.text, flex: 1 },
});
