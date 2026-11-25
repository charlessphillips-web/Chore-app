import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { getAppIconName, setAlternateAppIcon, supportsAlternateIcons } from 'expo-alternate-app-icons';
import { haptics } from '../../lib/haptics';
import { notify, Screen, Subtitle } from '../../components/ui';
import { colors } from '../../components/theme';

/** Purple is the default; the others are alternate icons set up in app.json. */
const ICONS = [
  { id: null, label: 'Purple', src: require('../../../assets/icon.png') },
  { id: 'Black', label: 'Black', src: require('../../../assets/app-icons/black.png') },
  { id: 'White', label: 'White', src: require('../../../assets/app-icons/white.png') },
  { id: 'Navy', label: 'Navy', src: require('../../../assets/app-icons/navy.png') },
  { id: 'Green', label: 'Green', src: require('../../../assets/app-icons/green.png') },
  { id: 'Coral', label: 'Coral', src: require('../../../assets/app-icons/coral.png') },
] as const;

/** Settings → App icon: pick the Rotawise icon on your home screen (iPhone/Android app). */
export default function AppIconScreen() {
  const [current, setCurrent] = useState<string | null>(() => {
    try { return supportsAlternateIcons ? getAppIconName() : null; } catch { return null; }
  });

  if (!supportsAlternateIcons) {
    return (
      <Screen edges={['left', 'right']}>
        <Subtitle>Choosing your app icon works in the iPhone and Android app, not the website.</Subtitle>
      </Screen>
    );
  }

  return (
    <Screen edges={['left', 'right']}>
      <Subtitle>Pick the icon on your home screen. Only your phone changes.</Subtitle>
      <View style={styles.grid}>
        {ICONS.map((ic) => {
          const on = (current ?? null) === ic.id;
          return (
            <Pressable
              key={ic.label}
              accessibilityRole="radio"
              accessibilityLabel={`${ic.label} icon`}
              accessibilityState={{ selected: on }}
              onPress={async () => {
                haptics.select();
                try {
                  await setAlternateAppIcon(ic.id as never);
                  setCurrent(ic.id);
                } catch (e) {
                  notify('Couldn’t change the icon', (e as Error).message);
                }
              }}
              style={styles.item}
            >
              <View style={[styles.ring, on && { borderColor: colors.brand }]}>
                <Image source={ic.src} style={styles.icon} />
              </View>
              <Text style={[styles.label, on && { color: colors.text, fontWeight: '700' }]}>{ic.label}{on ? ' ✓' : ''}</Text>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 18 },
  item: { width: '31%', alignItems: 'center', gap: 6 },
  ring: { borderWidth: 3, borderColor: 'transparent', borderRadius: 24, padding: 3 },
  icon: { width: 76, height: 76, borderRadius: 18 },
  label: { fontSize: 13, color: colors.muted },
});
