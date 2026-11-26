/**
 * Grey placeholder shapes while a page's data arrives, shaped like what's
 * coming, so the page fills in once in place instead of popping in bit by bit.
 */
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type DimensionValue } from 'react-native';
import { colors } from './theme';

function usePulse() {
  const [a] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [a]);
  return a.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.85] });
}

export function Bone({ w = '100%', h = 14, r = 7 }: { w?: DimensionValue; h?: number; r?: number }) {
  return <View style={{ width: w, height: h, borderRadius: r, borderCurve: 'continuous', backgroundColor: colors.cardRaised }} />;
}

/** A card of grey lines (e.g. where "Your house, today" will be). */
export function SkeletonCard({ lines = 3, title = true }: { lines?: number; title?: boolean }) {
  const opacity = usePulse();
  return (
    <Animated.View style={[styles.card, { opacity }]} accessibilityLabel="Loading">
      {title && <Bone w={90} h={16} r={6} />}
      {title && <Bone w="70%" h={26} r={8} />}
      {Array.from({ length: lines }, (_, i) => (
        <View key={i} style={styles.row}>
          <Bone w={12} h={12} r={6} />
          <View style={{ flex: 1, gap: 6 }}>
            <Bone w={`${80 - i * 12}%`} h={14} />
            <Bone w={`${50 - i * 6}%`} h={11} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

/** A list of rows with a round picture and a thumbnail (the house feed, checks). */
export function SkeletonList({ rows = 4, thumb = true }: { rows?: number; thumb?: boolean }) {
  const opacity = usePulse();
  return (
    <Animated.View style={{ gap: 10, opacity }} accessibilityLabel="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={[styles.card, styles.row, { gap: 12 }]}>
          <Bone w={32} h={32} r={16} />
          <View style={{ flex: 1, gap: 6 }}>
            <Bone w={`${75 - (i % 3) * 10}%`} h={14} />
            <Bone w="40%" h={11} />
          </View>
          {thumb && <Bone w={48} h={48} r={10} />}
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 18, borderCurve: 'continuous', padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
