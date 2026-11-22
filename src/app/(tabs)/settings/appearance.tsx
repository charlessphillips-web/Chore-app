import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { saveAppearanceAndReload, type AppearancePref } from '../../../lib/appearance';
import { haptics } from '../../../lib/haptics';
import { Icon, Screen, Subtitle } from '../../../components/ui';
import { appearance, colors } from '../../../components/theme';

type IconName = React.ComponentProps<typeof Icon>['name'];

const OPTIONS: { pref: AppearancePref; title: string; sub: string; icon: IconName; bg: string; card: string; ink: string }[] = [
  { pref: 'dark', title: 'Dark', sub: 'Black background, white text', icon: 'moon-outline', bg: '#000000', card: '#1C1C1C', ink: '#F2F2F2' },
  { pref: 'light', title: 'Light', sub: 'Off-white background, black text', icon: 'sunny-outline', bg: '#F4F2EE', card: '#FFFFFF', ink: '#141414' },
  { pref: 'system', title: 'Match my phone', sub: 'Light or dark, whatever your phone is set to', icon: 'phone-portrait-outline', bg: '#7A7A7A', card: '#BDBDBD', ink: '#141414' },
];

/** Settings → Appearance: Dark, Light, or match the phone. Restarts the app for a moment to repaint. */
export default function AppearanceScreen() {
  const [busy, setBusy] = useState<AppearancePref | null>(null);
  return (
    <Screen edges={['left', 'right']}>
      <Subtitle>Changing it restarts Rotawise for a second so every screen updates.</Subtitle>
      <View style={styles.card}>
        {OPTIONS.map((o, i) => {
          const on = appearance === o.pref;
          return (
            <Pressable
              key={o.pref}
              accessibilityRole="radio"
              accessibilityLabel={o.title}
              accessibilityState={{ selected: on }}
              disabled={on || !!busy}
              onPress={() => { haptics.select(); setBusy(o.pref); saveAppearanceAndReload(o.pref).catch(() => setBusy(null)); }}
              style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && { opacity: 0.6 }]}
            >
              <View style={[styles.preview, { backgroundColor: o.bg }]}>
                <View style={[styles.previewCard, { backgroundColor: o.card }]} />
                <View style={[styles.previewLine, { backgroundColor: o.ink }]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{o.title}</Text>
                <Text style={styles.sub}>{busy === o.pref ? 'Switching…' : o.sub}</Text>
              </View>
              {on ? <Icon name="checkmark" size={22} color={colors.you} /> : <Icon name={o.icon} size={20} color={colors.muted} />}
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 18, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  preview: { width: 46, height: 58, borderRadius: 10, padding: 6, gap: 5, borderWidth: 1, borderColor: colors.line },
  previewCard: { height: 22, borderRadius: 5 },
  previewLine: { height: 4, width: 22, borderRadius: 2 },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
});
