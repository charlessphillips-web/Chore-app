import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { isAllowedUniversity, searchUniversities, UNIVERSITY_FALLBACKS } from '../lib/universities';
import { haptics } from '../lib/haptics';
import { Icon, Input } from './ui';
import { colors, radius, space, type } from './theme';

/**
 * Type a few letters and pick your university from the list. Only listed
 * universities can be chosen (or "My university isn't listed").
 */
export function UniversityInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [showOther, setShowOther] = useState(false);

  // Chosen: show it, with a way to change it.
  if (isAllowedUniversity(value)) {
    return (
      <View style={styles.chosen}>
        <Icon name="school" size={18} color={colors.text} />
        <Text style={[type.body, { flex: 1 }]}>{value}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Change university" hitSlop={8}
          onPress={() => { haptics.tap(); onChange(''); setQuery(''); setShowOther(false); }}>
          <Text style={[type.small, { padding: 4 }]}>Change</Text>
        </Pressable>
      </View>
    );
  }

  const matches = searchUniversities(query);
  const typed = query.trim().length >= 2;
  const show = focused && typed;
  const pick = (m: string) => {
    haptics.select();
    onChange(m);
    setFocused(false);
  };

  return (
    <View style={{ gap: space.sm }}>
      <View>
        <Input
          value={query}
          onChangeText={(t) => { setQuery(t); if (value) onChange(''); }}
          onFocus={() => setFocused(true)}
          // Small delay so tapping a suggestion registers before the list hides.
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Start typing, e.g. Leeds or UCL"
          autoCapitalize="words"
          autoCorrect={false}
          accessibilityLabel="University"
          style={show ? { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderColor: colors.text } : undefined}
        />
        {show && (
          <View style={styles.list} accessibilityRole="list">
            {matches.map((m, i) => (
              <Pressable
                key={m}
                accessibilityRole="button"
                accessibilityLabel={m}
                onPress={() => pick(m)}
                style={({ pressed }) => [styles.item, i > 0 && styles.divider, pressed && { backgroundColor: colors.cardRaised }]}
              >
                <Icon name="school-outline" size={16} color={colors.muted} />
                <Text style={styles.itemText}>{m}</Text>
              </Pressable>
            ))}
            {matches.length === 0 && <Text style={[type.small, styles.item]}>No university matches &quot;{query.trim()}&quot;.</Text>}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="My university isn't listed"
              onPress={() => { haptics.tap(); setShowOther(true); setFocused(false); }}
              style={({ pressed }) => [styles.item, styles.divider, pressed && { backgroundColor: colors.cardRaised }]}
            >
              <Icon name="help-circle-outline" size={16} color={colors.muted} />
              <Text style={[styles.itemText, { color: colors.muted }]}>My university isn&apos;t listed</Text>
            </Pressable>
          </View>
        )}
      </View>
      {typed && !show && !showOther && (
        <Text style={type.small}>Pick your university from the list as you type.</Text>
      )}
      {showOther && (
        <View style={{ gap: space.sm }}>
          <Text style={type.small}>Sorry we&apos;re missing yours! Choose one of these, and tell us its name in Settings → Make a suggestion so we can add it.</Text>
          {UNIVERSITY_FALLBACKS.map((f) => (
            <Pressable key={f} accessibilityRole="button" accessibilityLabel={f} onPress={() => pick(f)}
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.cardRaised }]}>
              <Text style={type.body}>{f}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chosen: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.card, borderRadius: radius,
    borderWidth: 1, borderColor: colors.line, paddingHorizontal: space.md, paddingVertical: 14,
  },
  list: {
    backgroundColor: colors.card, borderWidth: 1, borderTopWidth: 0, borderColor: colors.text,
    borderBottomLeftRadius: radius, borderBottomRightRadius: radius, overflow: 'hidden',
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: 13 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  itemText: { fontSize: 15, color: colors.text, flex: 1 },
  option: { borderWidth: 1, borderColor: colors.line, borderRadius: radius, paddingHorizontal: space.md, paddingVertical: 13 },
});
