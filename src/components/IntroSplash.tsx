/**
 * The intro every time Rotawise opens: the logo (exactly where the iPhone's
 * launch screen left it), "ROTAWISE", then "Fair chores. No arguments.",
 * then the logo flies into its place at the top of Home and the app fades in.
 * About 3 seconds; much shorter if the phone is set to reduce motion.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, Text, useWindowDimensions } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from './theme';

// Keep the iPhone launch screen up until the intro is drawn underneath it (no flash).
SplashScreen.preventAutoHideAsync().catch(() => {});

const START = 84; // same size as the launch screen logo (app.json → expo-splash-screen)

/** Where Home's little logo is, so the intro logo can land exactly on it. */
let target: { x: number; y: number; size: number } | null = null;
export function setIntroTarget(t: { x: number; y: number; size: number }) { target = t; }

export function IntroSplash() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [done, setDone] = useState(false);
  const [a] = useState(() => ({
    word: new Animated.Value(0),
    tag: new Animated.Value(0),
    fly: new Animated.Value(0),
    bg: new Animated.Value(1),
  }));
  const [end, setEnd] = useState({ x: 16, y: insets.top + 12, size: 26 });

  useEffect(() => {
    let cancelled = false;
    const timing = (v: Animated.Value, toValue: number, duration: number, delay = 0, easing = Easing.out(Easing.cubic)) =>
      Animated.timing(v, { toValue, duration, delay, easing, useNativeDriver: true });
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        timing(a.bg, 0, 300, 500).start(() => setDone(true));
        return;
      }
      Animated.parallel([
        timing(a.word, 1, 500, 450),
        timing(a.tag, 1, 600, 1150),
      ]).start(() => {
        if (cancelled) return;
        if (target) setEnd(target);
        Animated.parallel([
          timing(a.word, 0, 250, 0, Easing.in(Easing.quad)),
          timing(a.tag, 0, 250, 0, Easing.in(Easing.quad)),
          timing(a.fly, 1, 700, 100, Easing.bezier(0.6, 0, 0.2, 1)),
          timing(a.bg, 0, 450, 450, Easing.inOut(Easing.quad)),
        ]).start(() => setDone(true));
      });
    }).catch(() => setDone(true));
    return () => { cancelled = true; };
  }, [a]);

  if (done) return null;
  const cx = (width - START) / 2;
  const cy = (height - START) / 2;
  const scale = end.size / START;
  // Move the logo's centre from the middle of the screen to the target's centre.
  const dx = end.x + end.size / 2 - (cx + START / 2);
  const dy = end.y + end.size / 2 - (cy + START / 2);
  const rise = (v: Animated.Value) => ({ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] });

  return (
    <Animated.View
      pointerEvents="none"
      onLayout={() => SplashScreen.hideAsync().catch(() => {})}
      style={[StyleSheet.absoluteFill, styles.wrap]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', opacity: a.bg }]} />
      <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: cy + START + 22, alignItems: 'center', gap: 12 }}>
        <Animated.Text style={[styles.word, rise(a.word)]}>ROTAWISE</Animated.Text>
        <Animated.Text style={[styles.tag, { opacity: a.tag }]}>
          Fair chores. <Text style={{ color: colors.brand, fontWeight: '600' }}>No arguments.</Text>
        </Animated.Text>
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute', left: cx, top: cy, width: START, height: START,
          // Fade the flying logo out at the very end, as Home's own logo is underneath it.
          opacity: a.fly.interpolate({ inputRange: [0, 0.9, 1], outputRange: [1, 1, 0] }),
          transform: [
            { translateX: a.fly.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
            { translateY: a.fly.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
            { scale: a.fly.interpolate({ inputRange: [0, 1], outputRange: [1, scale] }) },
          ],
        }}
      >
        <Image source={require('../../assets/logo.png')} style={{ width: START, height: START }} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { zIndex: 1000, elevation: 1000 },
  word: { color: '#F2F2F2', fontFamily: fonts.mono, fontWeight: '700', fontSize: 22, letterSpacing: 6 },
  tag: { color: '#9A9AA0', fontSize: 15 },
});
