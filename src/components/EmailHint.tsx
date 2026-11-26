/** Under an email box: "Did you mean fabio@gmail.com?" with a one-tap fix. */
import { Pressable, Text, View } from 'react-native';
import { suggestEmail } from '../lib/emailCheck';
import { haptics } from '../lib/haptics';
import { colors } from './theme';

export function EmailHint({ email, onUse }: { email: string; onUse: (fixed: string) => void }) {
  const s = suggestEmail(email);
  if (!s) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <Text style={{ color: colors.warning, fontSize: 14 }}>Did you mean <Text style={{ fontWeight: '700' }}>{s}</Text>?</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Use ${s}`} hitSlop={8}
        onPress={() => { haptics.tap(); onUse(s); }}
        style={{ borderWidth: 1, borderColor: colors.warning, borderRadius: 999, borderCurve: 'continuous' as const, paddingVertical: 3, paddingHorizontal: 10 }}>
        <Text style={{ color: colors.warning, fontSize: 13, fontWeight: '600' }}>Yes, fix it</Text>
      </Pressable>
    </View>
  );
}
