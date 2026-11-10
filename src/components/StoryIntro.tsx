import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { haptics } from '../lib/haptics';
import { track } from '../lib/analytics';
import { Button, Icon, Logo } from './ui';
import { colors, space } from './theme';

type IconName = React.ComponentProps<typeof Icon>['name'];

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'camera-outline', title: 'Done a chore?\nLog it.', body: 'Tap the chore and snap a photo. It counts towards your score.' },
  { icon: 'notifications-outline', title: 'Spotted a job?\nFlag it.', body: 'Say it needs doing, and whoever has done the fewest chores gets asked.' },
  { icon: 'checkmark-done-outline', title: 'Check each\nother.', body: 'A housemate checks every photo. Not done properly? It gets sent back to redo.' },
  { icon: 'trash-outline', title: 'Never miss\nbin day.', body: 'Add your bin days once, and everyone gets a reminder at 8pm the night before.' },
  { icon: 'wallet-outline', title: 'No time?\nPay to skip.', body: 'Offer your chore to a housemate for money. They do it, you pay them, and you keep the point.' },
];

const native = Platform.OS !== 'web';

/**
 * Short intro: one step per screen with dots, a Next button and swiping.
 * The last screen has a "hold to get started" button whose circle grows to
 * fill the screen.
 */
export function StoryIntro({ onFinish, finishLabel = 'Hold to\nget started', showWelcome = true }: {
  onFinish: () => void;
  finishLabel?: string;
  /** First screen is the Rotawise logo and name. */
  showWelcome?: boolean;
}) {
  const slides = (showWelcome ? 1 : 0) + STEPS.length;
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [anim] = useState(() => new Animated.Value(1));
  const last = i === slides - 1;
  // Count new visitors starting the intro (not people re-reading it from Settings).
  useEffect(() => {
    if (showWelcome) track('intro_start');
  }, [showWelcome]);

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
  }, [i, anim]);

  const go = (d: number) => {
    const n = Math.max(0, Math.min(slides - 1, i + d));
    if (n === i) return;
    haptics.select();
    setDir(d);
    setI(n);
  };
  // Swipe left / right.
  const goRef = useRef(go);
  useEffect(() => {
    goRef.current = go;
  });
  // The handler only reads the ref when a finger lifts, not while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [swipe] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -50) goRef.current(1);
        else if (g.dx > 50) goRef.current(-1);
      },
    }),
  );

  const signIn = () => {
    haptics.tap();
    router.push('/sign-in');
  };
  const stepIndex = showWelcome ? i - 1 : i;
  const step = stepIndex >= 0 ? STEPS[stepIndex] : null;
  const slideIn = anim.interpolate({ inputRange: [0, 1], outputRange: [28 * dir, 0] });

  return (
    <SafeAreaView style={[styles.root, noSelect]}>
      <View style={styles.topRow}>
        <View />
        {!last ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Skip" onPress={() => { haptics.tap(); if (showWelcome) track('intro_skip'); setDir(1); setI(slides - 1); }} hitSlop={12}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        ) : <View />}
      </View>

      <View style={{ flex: 1 }} {...swipe.panHandlers}>
        <Animated.View style={[styles.body, { opacity: anim, transform: [{ translateX: slideIn }] }]}>
          {step ? (
            <>
              <View style={styles.tile}>
                <Icon name={step.icon} size={40} color={colors.text} />
              </View>
              <Text style={styles.title}>{step.title}</Text>
              <Text style={styles.text}>{step.body}</Text>
            </>
          ) : (
            <>
              <Logo size={96} />
              <Text style={styles.title}>Rotawise</Text>
              <Text style={styles.text}>Sharing chores fairly in your house.</Text>
            </>
          )}
        </Animated.View>
      </View>

      <View style={styles.dots} accessibilityLabel={`Step ${i + 1} of ${slides}`}>
        {Array.from({ length: slides }, (_, n) => (
          <View key={n} style={[styles.dot, n === i && styles.dotOn]} />
        ))}
      </View>
      {last ? (
        <>
          <HoldButton label={finishLabel} onDone={() => { if (showWelcome) track('intro_finish'); onFinish(); }} />
          {showWelcome && (
            <Pressable accessibilityRole="button" accessibilityLabel="Already have an account? Sign in" onPress={signIn} hitSlop={10} style={styles.signInLink}>
              <Text style={styles.backText}>Already have an account? <Text style={styles.signInText}>Sign in</Text></Text>
            </Pressable>
          )}
        </>
      ) : (
        <View style={styles.footer}>
          <Button title="Next" onPress={() => go(1)} />
          {i === 0 && showWelcome ? (
            <Button title="I already have an account" variant="secondary" onPress={signIn} />
          ) : i > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => go(-1)} hitSlop={10} style={styles.back}>
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          ) : <View style={styles.back} />}
        </View>
      )}
    </SafeAreaView>
  );
}

const HOLD_MS = 1300;
/** On the web: no text selection or "Copy" pop-up when holding. */
const noSelect = (Platform.OS === 'web'
  ? { userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', touchAction: 'none' }
  : {}) as object;
const SIZE = 132;

/** Press and hold: a white circle grows from the button until it fills the screen. */
function HoldButton({ label, onDone }: { label: string; onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const [grow] = useState(() => new Animated.Value(0));
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const done = useRef(false);
  const ticks = useRef<ReturnType<typeof setInterval> | null>(null);
  // Big enough to cover the screen from the button's centre.
  const maxScale = (Math.hypot(width, height) * 2) / SIZE;

  const stopTicks = () => {
    if (ticks.current) clearInterval(ticks.current);
    ticks.current = null;
  };
  useEffect(() => stopTicks, []);

  const start = () => {
    if (done.current) return;
    haptics.tap();
    stopTicks();
    ticks.current = setInterval(() => haptics.select(), 180);
    anim.current?.stop();
    anim.current = Animated.timing(grow, { toValue: 1, duration: HOLD_MS, easing: Easing.in(Easing.quad), useNativeDriver: native });
    anim.current.start(({ finished }) => {
      stopTicks();
      if (finished && !done.current) {
        done.current = true;
        haptics.success();
        onDone();
      }
    });
  };
  const cancel = () => {
    if (done.current) return;
    stopTicks();
    anim.current?.stop();
    anim.current = Animated.timing(grow, { toValue: 0, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: native });
    anim.current.start();
  };

  const scale = grow.interpolate({ inputRange: [0, 1], outputRange: [0.001, maxScale] });
  const textColor = grow.interpolate({ inputRange: [0, 0.05, 0.06, 1], outputRange: [colors.text, colors.text, colors.inverse, colors.inverse] });

  return (
    <View style={styles.holdWrap}>
      <Animated.View pointerEvents="none" style={[styles.fill, { transform: [{ scale }] }]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label.replace('\n', ' ')}
        accessibilityHint="Press and hold"
        onPressIn={start}
        onPressOut={cancel}
        // Never treat the hold as a long-press (that would cancel it).
        delayLongPress={60_000}
        style={[styles.hold, noSelect]}
      >
        <Animated.Text selectable={false} style={[styles.holdText, noSelect, { color: textColor }]}>{label}</Animated.Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.md, minHeight: 40 },
  skip: { fontSize: 16, color: colors.muted, fontWeight: '500' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: space.xl, gap: space.md },
  tile: { width: 104, height: 104, borderRadius: 30, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
  title: { fontSize: 32, fontWeight: '700', color: colors.text, letterSpacing: -1, textAlign: 'center', lineHeight: 37 },
  text: { fontSize: 17, lineHeight: 25, color: colors.muted, textAlign: 'center', maxWidth: 340 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingBottom: space.lg },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.line },
  dotOn: { width: 22, backgroundColor: colors.text },
  footer: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.sm },
  back: { alignSelf: 'center', paddingVertical: 10, minHeight: 40 },
  backText: { fontSize: 15, color: colors.muted },
  signInLink: { alignSelf: 'center', paddingBottom: space.lg, paddingTop: 4 },
  signInText: { color: colors.text, fontWeight: '600', textDecorationLine: 'underline' },
  holdWrap: { alignItems: 'center', justifyContent: 'center', paddingBottom: space.lg, paddingTop: space.xs },
  fill: { position: 'absolute', width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: colors.text, top: space.xs, alignSelf: 'center' },
  hold: {
    width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 1, borderColor: colors.text,
    alignItems: 'center', justifyContent: 'center', padding: 12,
  },
  holdText: { fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 19 },
});
