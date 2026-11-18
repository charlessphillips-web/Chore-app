import { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { periodKey, periodLabel, periodStart, previousPeriodKey } from '../lib/period';
import { lastResult, names, topStake } from '../lib/stakes';
import { wrap } from '../lib/wrapped';
import { WEB_URL } from '../lib/legal';
import { haptics } from '../lib/haptics';
import { track } from '../lib/analytics';
import { Icon, Loading, notify } from '../components/ui';
import { colors, fonts, shade } from '../components/theme';

interface Slide { kicker: string; big?: string; title: string; body?: string; you?: boolean }

/**
 * Rotawise Wrapped: tap through the period's story, then share it.
 * ?p=last → the period that just ended (shown once at the start of a new
 * period); ?p=now → a sneak peek of the current one so far.
 */
export default function WrappedScreen() {
  const { p } = useLocalSearchParams<{ p?: string }>();
  const { user, house, membersIn, stakes } = useApp();
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  if (!user || !house) return <Loading />;

  const now = new Date();
  const last = p !== 'now';
  const key = last ? previousPeriodKey(now, house.reset) : periodKey(now, house.reset);
  const label = periodLabel(last ? new Date(periodStart(now, house.reset).getTime() - 12 * 3_600_000) : now, house.reset);
  const members = membersIn(key);
  const choreName = (k: string) => house.chores.find((c) => c.key === k)?.name ?? k.replace(/^\w/, (x) => x.toUpperCase());
  const w = wrap(members, user.uid, choreName);
  const scores = members.map((m) => ({ username: m.username, points: m.points ?? m.totalCompleted }));
  const stakesLine = last ? lastResult(stakes, key, scores) : null;
  const prize = topStake(stakes, 'prize', key);
  const forfeit = topStake(stakes, 'forfeit', key);

  const slides: Slide[] = [
    { kicker: `${house.name} · ${label}`, title: last ? 'Your house,\nwrapped.' : 'Your Wrapped\nso far.', big: `${w.totalChores}`, body: `chore${w.totalChores === 1 ? '' : 's'} done between you${last ? '' : ' (so far)'}.` },
  ];
  if (w.top) {
    slides.push({
      kicker: 'Carried the house',
      title: `${names(w.top.names)} carried\nthe house.`,
      big: `${w.top.pct}%`,
      body: `of every chore${w.top.names.length > 1 ? ' each' : ''}. A fair share was ${w.fairPct}%.`,
    });
  }
  if (w.mostDone) {
    slides.push({ kicker: 'Most done', title: `${w.mostDone.name}.`, big: `${w.mostDone.count}×`, body: 'The house’s favourite chore (or the one that never stops).' });
  }
  if (w.me && w.totalPoints > 0) {
    slides.push({
      kicker: 'You',
      you: true,
      title: w.me.place === 1 ? 'You topped\nthe house. 🏆' : `You did\n${w.me.pct}%.`,
      big: `${w.me.points} pt${w.me.points === 1 ? '' : 's'}`,
      body: `${w.me.chores} chore${w.me.chores === 1 ? '' : 's'}${w.me.topChore ? ` · mostly ${w.me.topChore.toLowerCase()}` : ''} · ${ordinal(w.me.place)} in the house.`,
    });
  }
  if (stakesLine) slides.push({ kicker: 'The stakes', title: 'Pay up.', body: stakesLine });
  else if (!last && (prize || forfeit)) {
    slides.push({ kicker: 'Playing for', title: 'Still to play for.', body: [prize && `🏆 Top wins: ${prize.text}`, forfeit && `😅 Bottom does: ${forfeit.text}`].filter(Boolean).join('\n') });
  }
  slides.push({ kicker: 'That’s a wrap', title: last ? 'New period,\nclean slate.' : 'Keep going.', body: last ? 'Everyone starts from zero again. Good luck.' : `Your full Wrapped arrives when the period ends.` });

  const s = slides[Math.min(i, slides.length - 1)];
  const end = i >= slides.length - 1;
  const accent = s.you ? colors.you : colors.brand;
  const go = (d: number) => { haptics.select(); setI((x) => Math.max(0, Math.min(slides.length - 1, x + d))); };
  const close = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  async function share() {
    const lines = [
      `🎁 ${house!.name}: ${label}, wrapped`,
      `🧽 ${w.totalChores} chores done`,
      w.top && `🏆 ${names(w.top.names)} carried the house (${w.top.pct}%)`,
      w.mostDone && `🔁 Most done: ${w.mostDone.name} (${w.mostDone.count}×)`,
      stakesLine && `😅 ${stakesLine}`,
      `Fair chores for student houses: ${WEB_URL}`,
    ].filter(Boolean).join('\n');
    track('wrapped_share');
    try {
      await Share.share({ message: lines });
    } catch {
      notify('Copy this to share', lines);
    }
  }

  return (
    <View style={[styles.page, { backgroundColor: shade(accent, 0.78), paddingTop: insets.top + 10, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.bars}>
        {slides.map((_, n) => <View key={n} style={[styles.bar, { backgroundColor: n <= i ? colors.text : 'rgba(255,255,255,0.25)' }]} />)}
      </View>
      <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} style={styles.close}>
        <Icon name="close" size={24} color={colors.text} />
      </Pressable>

      <View style={styles.body}>
        <Text style={[styles.kicker, { color: colors.text }]}>{s.kicker}</Text>
        <Text style={styles.title}>{s.title}</Text>
        {s.big && <Text style={[styles.big, { color: s.you ? colors.you : colors.text }]} adjustsFontSizeToFit numberOfLines={1}>{s.big}</Text>}
        {s.body && <Text style={styles.text}>{s.body}</Text>}
      </View>

      {/* Tap left / right to go back / forward (like stories). */}
      <View style={styles.taps} pointerEvents="box-none">
        <Pressable style={{ flex: 1 }} onPress={() => go(-1)} accessibilityLabel="Previous" />
        <Pressable style={{ flex: 2 }} onPress={() => (end ? undefined : go(1))} accessibilityLabel="Next" />
      </View>

      <View style={styles.footer}>
        {end ? (
          <>
            <Pressable onPress={share} accessibilityRole="button" style={styles.btn}><Text style={styles.btnText}>Share</Text></Pressable>
            <Pressable onPress={close} accessibilityRole="button" style={styles.ghost}><Text style={styles.ghostText}>Done</Text></Pressable>
          </>
        ) : (
          <Text style={styles.hint}>Tap to continue →</Text>
        )}
        <Text style={styles.site}>rotawise.org</Text>
      </View>
    </View>
  );
}

function ordinal(n: number): string {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 22 },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2 },
  close: { position: 'absolute', right: 18, top: 56, zIndex: 3 },
  body: { flex: 1, justifyContent: 'center', gap: 10 },
  kicker: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', opacity: 0.8 },
  title: { fontSize: 34, fontWeight: '700', letterSpacing: -1, color: colors.text, lineHeight: 38 },
  big: { fontSize: 96, fontWeight: '700', letterSpacing: -4, lineHeight: 104 },
  text: { fontSize: 17, color: colors.text, opacity: 0.85, lineHeight: 24 },
  taps: { position: 'absolute', left: 0, right: 0, top: 90, bottom: 140, flexDirection: 'row' },
  footer: { gap: 10, alignItems: 'stretch' },
  btn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  btnText: { color: colors.primaryText, fontWeight: '700', fontSize: 16 },
  ghost: { paddingVertical: 10, alignItems: 'center' },
  ghostText: { color: colors.text, fontSize: 15 },
  hint: { color: colors.text, opacity: 0.7, textAlign: 'center', fontSize: 14 },
  site: { color: colors.text, opacity: 0.5, textAlign: 'center', fontSize: 12, fontFamily: fonts.mono },
});
