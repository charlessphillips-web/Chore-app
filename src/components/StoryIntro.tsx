import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { haptics } from '../lib/haptics';
import { Icon, Logo } from './ui';
import { colors, fonts, space } from './theme';

type IconName = React.ComponentProps<typeof Icon>['name'];

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'home-outline', title: 'Join your house', body: 'Create a house and share its code, or join with a code from a housemate. Whoever creates it is the admin.' },
  { icon: 'camera-outline', title: 'Done a chore? Log it', body: 'Tap the chore and take a photo. It counts towards your score.' },
  { icon: 'notifications-outline', title: 'Spotted a job? Flag it', body: 'Tap the chore and say it needs doing. Whoever has done the fewest chores gets asked.' },
  { icon: 'checkmark-done-outline', title: 'Check each other', body: 'One housemate checks each photo. Not done properly? Send it back to redo. Unchecked photos count after 24 hours.' },
  { icon: 'wallet-outline', title: 'Pay to skip it', body: 'Your turn but no time? Offer the chore for money. A housemate does it, you pay them directly, and the point is yours.' },
  { icon: 'podium-outline', title: 'Leaderboard', body: 'Scores reset every 2 months, so everyone gets a fresh start. The house admin can change how often.' },
];

const native = Platform.OS !== 'web';

/**
 * "How it works" as stories: tap anywhere for the next one, tap the left
 * edge to go back. The last one has a "hold to get started" button whose
 * circle grows to fill the screen.
 */
export function StoryIntro({ onFinish, finishLabel = 'Hold to\nget started', showWelcome = true }: {
  onFinish: () => void;
  finishLabel?: string;
  /** First story is the Choreboard logo and name. */
  showWelcome?: boolean;
}) {
  const slides = (showWelcome ? 1 : 0) + STEPS.length;
  const [i, setI] = useState(0);
  const [fade] = useState(() => new Animated.Value(1));
  const { width } = useWindowDimensions();
  const last = i === slides - 1;

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: native }).start();
  }, [i, fade]);

  const go = (d: number) => {
    const n = Math.max(0, Math.min(slides - 1, i + d));
    if (n !== i) {
      haptics.select();
      setI(n);
    }
  };
  const stepIndex = showWelcome ? i - 1 : i;
  const step = stepIndex >= 0 ? STEPS[stepIndex] : null;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.bars}>
        {Array.from({ length: slides }, (_, n) => (
          <View key={n} style={[styles.bar, n <= i && styles.barOn]} />
        ))}
      </View>
      <View style={styles.topRow}>
        <Text style={styles.count}>{String(i + 1).padStart(2, '0')} / {String(slides).padStart(2, '0')}</Text>
        {!last && (
          <Pressable accessibilityRole="button" accessibilityLabel="Skip" onPress={() => { haptics.tap(); setI(slides - 1); }} hitSlop={12}>
            <Text style={styles.skip}>SKIP</Text>
          </Pressable>
        )}
      </View>

      <Pressable
        style={{ flex: 1 }}
        accessibilityRole="button"
        accessibilityLabel={last ? 'Last step' : 'Next'}
        disabled={last}
        onPress={(e) => go(e.nativeEvent.locationX < width * 0.3 ? -1 : 1)}
      >
        <Animated.View
          style={[styles.body, { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}
        >
          {step ? (
            <>
              <Text style={styles.num}>{String(stepIndex + 1).padStart(2, '0')}</Text>
              <Icon name={step.icon} size={34} color={colors.text} />
              <Text style={styles.title}>{step.title}</Text>
              <Text style={styles.text}>{step.body}</Text>
            </>
          ) : (
            <>
              <Logo size={88} />
              <Text style={[styles.title, { fontSize: 38 }]}>Choreboard</Text>
              <Text style={styles.text}>Sharing chores fairly in your house.</Text>
            </>
          )}
        </Animated.View>
        {!last && <Text style={styles.hint}>TAP TO CONTINUE</Text>}
      </Pressable>

      {last && <HoldButton label={finishLabel} onDone={onFinish} />}
    </SafeAreaView>
  );
}

const HOLD_MS = 1300;
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
        style={styles.hold}
      >
        <Animated.Text style={[styles.holdText, { color: textColor }]}>{label.toUpperCase()}</Animated.Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bars: { flexDirection: 'row', gap: 4, paddingHorizontal: space.md, paddingTop: space.sm },
  bar: { flex: 1, height: 2, borderRadius: 1, backgroundColor: colors.line },
  barOn: { backgroundColor: colors.text },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.md, paddingTop: space.sm },
  count: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted, letterSpacing: 1 },
  skip: { fontFamily: fonts.mono, fontSize: 12, color: colors.text, letterSpacing: 1.2 },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: space.lg, gap: space.md },
  num: { fontFamily: fonts.dot, fontSize: 72, color: colors.text, lineHeight: 76 },
  title: { fontSize: 30, fontWeight: '700', color: colors.text, letterSpacing: -1 },
  text: { fontSize: 18, lineHeight: 26, color: colors.muted },
  hint: { fontFamily: fonts.mono, fontSize: 11, color: colors.faint, letterSpacing: 1.2, textAlign: 'center', paddingBottom: space.lg },
  holdWrap: { alignItems: 'center', justifyContent: 'center', paddingBottom: space.xl, paddingTop: space.md },
  fill: { position: 'absolute', width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: colors.text, top: space.md, alignSelf: 'center' },
  hold: {
    width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 1, borderColor: colors.text,
    alignItems: 'center', justifyContent: 'center', padding: 12,
  },
  holdText: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.2, textAlign: 'center', lineHeight: 16 },
});
