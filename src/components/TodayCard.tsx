/**
 * "Your house, today" on Home: the top 3 things for you right now (see
 * lib/today.ts for what's picked and why), with "+N more" and up to two
 * big buttons for the most urgent ones.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { allClear, partOfDay, type TodayItem } from '../lib/today';
import { haptics } from '../lib/haptics';
import { colors, fonts, isLight, soft } from './theme';

export function TodayCard({ items, now }: { items: TodayItem[]; now: Date }) {
  const [open, setOpen] = useState(false);
  const clear = allClear(items, now);
  const shown = open ? items : items.slice(0, 3);
  const more = items.length - shown.length;
  const actions = items.filter((i) => i.action).slice(0, 2);
  const go = (url: string) => { haptics.tap(); router.push(url as never); };

  return (
    <View style={styles.card} accessibilityLabel="Your house, today">
      <View style={styles.pill}><Text style={styles.pillText}>{partOfDay(now)}</Text></View>
      <Text style={styles.big}>{clear ?? 'Your house, today'}</Text>
      {clear && <Text style={styles.clearSub}>Nothing needs you right now. Feet up.</Text>}
      <View style={styles.rule} />
      {shown.length === 0 && <Text style={styles.sub}>Nothing new in the house yet.</Text>}
      {shown.map((it, n) => (
        <Pressable key={it.id} onPress={() => go(it.url)} accessibilityRole="button" accessibilityLabel={`${it.title}. ${it.sub ?? ''}`}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
          <Text style={styles.num}>{n + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{it.title}</Text>
            {!!it.sub && <Text style={styles.sub}>{it.sub}</Text>}
          </View>
        </Pressable>
      ))}
      {more > 0 && (
        <Pressable onPress={() => { haptics.select(); setOpen(true); }} accessibilityRole="button" style={styles.row}>
          <Text style={[styles.num, { color: colors.muted }]}>+</Text>
          <Text style={[styles.sub, { marginTop: 0 }]}>{more} more</Text>
        </Pressable>
      )}
      {open && items.length > 3 && (
        <Pressable onPress={() => { haptics.select(); setOpen(false); }} accessibilityRole="button" style={styles.row}>
          <Text style={[styles.sub, { marginTop: 0, marginLeft: 22 }]}>Show less</Text>
        </Pressable>
      )}
      {actions.length > 0 && !clear && (
        <View style={styles.btns}>
          {actions.map((a, i) => (
            <Pressable key={a.id} onPress={() => go(a.url)} accessibilityRole="button"
              style={({ pressed }) => [styles.btn, i === 0 ? styles.btnMain : styles.btnOther, pressed && { opacity: 0.75 }]}>
              <Text style={[styles.btnText, i === 0 && { color: isLight ? '#FFFFFF' : '#0B0B0F' }]} numberOfLines={1}>{a.action}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: soft(colors.brand) },
  pill: { alignSelf: 'flex-start', backgroundColor: soft(colors.brand), borderRadius: 7, paddingVertical: 3, paddingHorizontal: 8 },
  pillText: { color: colors.brand, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', fontFamily: fonts.mono },
  big: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.8, marginTop: 8 },
  clearSub: { color: colors.muted, fontSize: 14, marginTop: 4 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginTop: 10, marginBottom: 4 },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 7 },
  num: { color: colors.brand, fontWeight: '700', fontSize: 15, width: 12 },
  title: { color: colors.text, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  sub: { color: colors.muted, fontSize: 13, marginTop: 1 },
  btns: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  btnMain: { backgroundColor: colors.brand },
  btnOther: { backgroundColor: colors.cardRaised },
  btnText: { color: colors.text, fontWeight: '700', fontSize: 14 },
});
