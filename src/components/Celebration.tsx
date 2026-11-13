/**
 * The "you scored" moment after logging a chore (see lib/celebrate.ts):
 *
 *   toast  → small "+1 · line" pill at the top, gone in ~2s
 *   popup  → card with +points, a line and your bar, small purple burst; closes itself
 *   fair   → same card with full-screen confetti; stays until you tap
 *
 * Mounted once in the root layout. Anywhere can call `celebrate(c)`.
 * Celebrations can be switched off (popup button or Settings): you then only
 * get the toast.
 */
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Celebration as C } from '../lib/celebrate';
import { haptics } from '../lib/haptics';
import { colors, fonts } from './theme';

const KEY = 'rotawise.celebrations';
let enabled = true;
AsyncStorage.getItem(KEY).then((v) => { if (v === 'off') enabled = false; }).catch(() => {});

export const celebrations = {
  isEnabled: () => enabled,
  setEnabled(v: boolean) {
    enabled = v;
    AsyncStorage.setItem(KEY, v ? 'on' : 'off').catch(() => {});
  },
};

/** A celebration, or a plain message toast (points 0, no confetti). */
type Shown = (C & { id: number; tier: C['tier'] });
let listener: ((c: Shown) => void) | null = null;
let nextId = 1;

export function celebrate(c: C) {
  haptics.success();
  const tier = enabled ? c.tier : 'toast';
  listener?.({ ...c, tier, id: nextId++ });
}

/** Small message pill with no points, e.g. "Celebrations off". */
export function toast(line: string) {
  listener?.({ tier: 'toast', points: 0, line, beforePct: 0, afterPct: 0, fairPct: 0, id: nextId++ });
}

export function CelebrationHost() {
  const [shown, setShown] = useState<Shown | null>(null);
  useEffect(() => {
    listener = setShown;
    return () => { listener = null; };
  }, []);
  if (!shown) return null;
  const close = () => setShown((s) => (s?.id === shown.id ? null : s));
  return shown.tier === 'toast'
    ? <Toast key={shown.id} c={shown} onDone={close} />
    : <Popup key={shown.id} c={shown} onDone={close} />;
}

function Toast({ c, onDone }: { c: Shown; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [a] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.sequence([
      Animated.spring(a, { toValue: 1, useNativeDriver: true, friction: 7 }),
      Animated.delay(1700),
      Animated.timing(a, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]);
    anim.start(({ finished }) => finished && onDone());
    return () => anim.stop();
  }, [a, onDone]);
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { alignItems: 'center' }]}>
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          styles.toast,
          { top: insets.top + 10, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }] },
        ]}
      >
        {c.points > 0 && <Text style={styles.toastPts}>+{c.points}</Text>}
        <Text style={styles.toastText} numberOfLines={1}>{c.line}</Text>
      </Animated.View>
    </View>
  );
}

function Popup({ c, onDone }: { c: Shown; onDone: () => void }) {
  const big = c.tier === 'fair';
  const { width, height } = useWindowDimensions();
  const [pop] = useState(() => new Animated.Value(0));
  const [burst] = useState(() => new Animated.Value(0));
  const [bar] = useState(() => new Animated.Value(0));
  const [still, setStill] = useState(false);

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((r) => live && setStill(r)).catch(() => {});
    if (big) setTimeout(() => haptics.heavy(), 120);
    Animated.parallel([
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 6, tension: 90 }),
      Animated.timing(burst, { toValue: 1, duration: big ? 1600 : 1000, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(bar, { toValue: 1, duration: 700, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
    // Medium/Big close themselves; hitting fair share stays until you tap.
    const t = big ? null : setTimeout(onDone, 2600);
    return () => { live = false; if (t) clearTimeout(t); };
  }, [big, pop, burst, bar, onDone]);

  const pieces = useMemo(() => confetti(big ? 70 : 26, big), [big]);
  const fill = (p: number) => Math.min(100, (p / Math.max(1, c.fairPct)) * 100);
  const cx = width / 2;
  const cy = height * 0.42;

  return (
    <View style={[StyleSheet.absoluteFill, styles.dim]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onDone} accessibilityLabel="Close" />
      {!still && pieces.map((p, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            styles.piece,
            {
              left: cx, top: cy, width: p.w, height: p.h, backgroundColor: p.color,
              opacity: burst.interpolate({ inputRange: [0, 0.1, 0.75, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
                { translateY: burst.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, p.dy, p.dy + p.fall] }) },
                { rotate: burst.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
              ],
            },
          ]}
        />
      ))}
      <Animated.View
        style={[styles.card, { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}
        accessibilityLiveRegion="polite"
      >
        <View style={{ alignItems: 'center', alignSelf: 'stretch' }}>
          {c.points > 0 && <Text style={styles.pts}>+{c.points}</Text>}
          <Text style={styles.line}>{c.line}</Text>
          {c.fairPct > 0 && c.fairPct < 100 && (
            <View style={styles.barBlock}>
              <View style={styles.barTop}>
                <Text style={styles.label}>Your share</Text>
                <Text style={styles.label}>{c.beforePct}% → <Text style={{ color: colors.you }}>{c.afterPct}%</Text> · fair {c.fairPct}%</Text>
              </View>
              <View style={styles.track}>
                <Animated.View
                  style={[styles.fill, { width: bar.interpolate({ inputRange: [0, 1], outputRange: [`${fill(c.beforePct)}%`, `${fill(c.afterPct)}%`] }) }]}
                />
              </View>
              {big && <Text style={[styles.label, { color: colors.you }]}>🎯 Fair share reached</Text>}
            </View>
          )}
          <Pressable style={styles.btn} onPress={onDone} accessibilityRole="button">
            <Text style={styles.btnText}>Nice</Text>
          </Pressable>
          <Pressable
            hitSlop={10}
            accessibilityRole="button"
            onPress={() => {
              celebrations.setEnabled(false);
              onDone();
              setTimeout(() => toast('Celebrations off · switch back on in Settings'), 50);
            }}
          >
            <Text style={styles.off}>Turn off celebrations</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

/** Purple + white pieces flying out from the middle, then dropping a little. */
function confetti(n: number, big: boolean) {
  const shades = [colors.you, colors.text, colors.you, '#BFB4FF'];
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const d = (big ? 160 : 120) + Math.random() * (big ? 220 : 90);
    return {
      dx: Math.cos(a) * d,
      dy: Math.sin(a) * d * 1.2,
      fall: big ? 120 + Math.random() * 120 : 40,
      spin: (Math.random() - 0.5) * 720,
      w: 4 + Math.random() * 4,
      h: 8 + Math.random() * 7,
      color: shades[i % shades.length],
    };
  });
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '90%',
    backgroundColor: colors.cardRaised, borderColor: colors.line, borderWidth: 1, borderRadius: 999,
    paddingVertical: 10, paddingHorizontal: 16,
  },
  toastPts: { color: colors.you, fontWeight: '700', fontSize: 15 },
  toastText: { color: colors.text, fontSize: 14, fontWeight: '500', flexShrink: 1 },
  dim: { backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  piece: { position: 'absolute', borderRadius: 2 },
  card: {
    width: '100%', maxWidth: 340, backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1,
    borderRadius: 22, paddingTop: 22, paddingBottom: 14, paddingHorizontal: 18,
  },
  pts: { fontSize: 52, fontWeight: '700', letterSpacing: -2, color: colors.you },
  line: { fontSize: 20, fontWeight: '600', color: colors.text, textAlign: 'center', marginTop: 2 },
  barBlock: { alignSelf: 'stretch', gap: 6, marginTop: 18 },
  barTop: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, color: colors.muted, textTransform: 'uppercase' },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.you },
  btn: { alignSelf: 'stretch', backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 18 },
  btnText: { color: colors.primaryText, fontWeight: '600', fontSize: 15 },
  off: { color: colors.muted, fontSize: 13, marginTop: 12 },
});
