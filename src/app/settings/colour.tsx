import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../../context/AppContext';
import { haptics } from '../../lib/haptics';
import { Avatar } from '../../components/Avatar';
import { Label, Loading, Screen, Subtitle } from '../../components/ui';
import { colors, swatch, YOU_COLORS } from '../../components/theme';

/** Pick your "you" colour: your bar, name, points and confetti. Only you see it. */
export default function ColourScreen() {
  const { user, profile, members, youColor, setYouColor } = useApp();
  if (!user) return <Loading />;
  const me = members.find((m) => m.uid === user.uid);
  const other = members.find((m) => m.uid !== user.uid);

  return (
    <Screen edges={['left', 'right']}>
      <Subtitle>Your bar, your name, your points and your confetti. Only you see it: to everyone else you look like everyone else.</Subtitle>
      <View style={styles.card}>
        <View style={styles.swatches}>
          {YOU_COLORS.map((c) => {
            const on = c.hex === youColor;
            return (
              <Pressable
                key={c.hex}
                accessibilityRole="radio"
                accessibilityLabel={c.name}
                accessibilityState={{ selected: on }}
                onPress={() => { haptics.select(); setYouColor(c.hex); }}
                style={[styles.ring, on && { borderColor: colors.text }]}
              >
                <View style={[styles.swatch, { backgroundColor: swatch(c) }]} />
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.name}>{YOU_COLORS.find((c) => c.hex === youColor)?.name}</Text>
      </View>

      <Label>Preview</Label>
      <View style={[styles.card, { gap: 14 }]}>
        <Row avatar={<Avatar avatar={me?.avatar} name={profile?.username ?? '?'} size={30} />} name="You" pct={27} you />
        <Row avatar={<Avatar avatar={other?.avatar} name={other?.username ?? 'Sam'} size={30} />} name={other?.username ?? 'Sam'} pct={31} />
      </View>
      <View style={[styles.card, { alignItems: 'center' }]}>
        <Text style={[styles.pts, { color: colors.you }]}>+2</Text>
        <Text style={styles.line}>Carpet looking crisp.</Text>
      </View>
    </Screen>
  );
}

function Row({ avatar, name, pct, you }: { avatar: React.ReactNode; name: string; pct: number; you?: boolean }) {
  const c = you ? colors.you : colors.text;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {avatar}
      <Text style={[styles.rowName, you && { color: c, fontWeight: '600' }]} numberOfLines={1}>{name}</Text>
      <View style={styles.track}><View style={[styles.fill, { width: `${pct * 2.5}%`, backgroundColor: c }]} /></View>
      <Text style={[styles.pct, you && { color: c }]}>{pct}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 18, padding: 16 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  ring: { width: 50, height: 50, borderRadius: 25, borderWidth: 3, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 38, height: 38, borderRadius: 19 },
  name: { color: colors.muted, fontSize: 13, marginTop: 10 },
  rowName: { width: 70, fontSize: 15, color: colors.text },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  pct: { width: 40, textAlign: 'right', fontSize: 12, color: colors.muted },
  pts: { fontSize: 44, fontWeight: '700', letterSpacing: -2 },
  line: { fontSize: 17, fontWeight: '600', color: colors.text },
});
