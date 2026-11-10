import { Text, View } from 'react-native';
import { binsOn, listNames, type BinSchedule } from '../lib/bins';
import { Icon } from './ui';
import { colors, space, type } from './theme';

/** "🗑 Bins tonight: General waste and Recycling" the day before (and on the morning itself). */
export function BinBanner({ bins, now }: { bins: BinSchedule[]; now: Date }) {
  if (!bins.length) return null;
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const t = binsOn(bins, tomorrow);
  const today = now.getHours() < 12 ? binsOn(bins, now) : [];
  if (!t.length && !today.length) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.cardRaised, borderRadius: 16, padding: 14 }}>
      <Icon name="trash-outline" size={22} color={colors.text} />
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { fontWeight: '600' }]}>{today.length ? 'Bins go out this morning' : 'Bins go out tonight'}</Text>
        <Text style={type.small}>{listNames(today.length ? today : t)}</Text>
      </View>
    </View>
  );
}
