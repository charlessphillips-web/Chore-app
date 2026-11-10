import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { binsOn, listNames, nextCollections, type BinSchedule } from '../lib/bins';
import { haptics } from '../lib/haptics';
import { Icon } from './ui';
import { colors, space, type } from './theme';

/**
 * Bin days on Home:
 *  - the night before / that morning: a highlighted "Bins go out tonight" card
 *  - otherwise: a small "Next bins: Recycling · Tue 17 Nov" line
 *  - no bins set: the admin sees "Set up bin day reminders"
 */
export function BinBanner({ bins, now, isAdmin }: { bins: BinSchedule[]; now: Date; isAdmin: boolean }) {
  if (!bins.length) {
    if (!isAdmin) return null;
    return (
      <Pressable accessibilityRole="button" accessibilityLabel="Set up bin day reminders"
        onPress={() => { haptics.tap(); router.push('/settings/bins'); }}
        style={({ pressed }) => [rowStyle, pressed && { backgroundColor: colors.cardRaised }]}>
        <Icon name="trash-outline" size={20} color={colors.text} />
        <View style={{ flex: 1 }}>
          <Text style={[type.body, { fontWeight: '600' }]}>Set up bin day reminders</Text>
          <Text style={type.small}>Everyone gets a reminder at 8pm the night before</Text>
        </View>
        <Icon name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>
    );
  }
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const t = binsOn(bins, tomorrow);
  const today = now.getHours() < 12 ? binsOn(bins, now) : [];
  if (t.length || today.length) {
    return (
      <View style={[rowStyle, { backgroundColor: colors.cardRaised }]} accessibilityLabel="Bin day">
        <Icon name="trash-outline" size={22} color={colors.text} />
        <View style={{ flex: 1 }}>
          <Text style={[type.body, { fontWeight: '600' }]}>{today.length ? 'Bins go out this morning' : 'Bins go out tonight'}</Text>
          <Text style={type.small}>{listNames(today.length ? today : t)}</Text>
        </View>
      </View>
    );
  }
  // The next collection day, and which bins.
  const nextDay = bins
    .map((b) => nextCollections(b, now, 1)[0])
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  if (!nextDay) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Bin days"
      onPress={() => { haptics.tap(); router.push('/house'); }}
      style={({ pressed }) => [rowStyle, { paddingVertical: 12 }, pressed && { backgroundColor: colors.cardRaised }]}>
      <Icon name="trash-outline" size={18} color={colors.muted} />
      <Text style={[type.small, { flex: 1, color: colors.text }]}>
        Next bins: {listNames(binsOn(bins, nextDay))} · {nextDay.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
      </Text>
    </Pressable>
  );
}

const rowStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.md, backgroundColor: colors.card, borderRadius: 16, padding: 14 };
