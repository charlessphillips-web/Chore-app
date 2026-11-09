import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { haptics } from '../lib/haptics';
import { Icon } from './ui';
import { colors, space, type } from './theme';

/** "I agree to the privacy policy" tick-box with a link to read it. */
export function AgreeBox({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: value }}
        accessibilityLabel="I agree to the privacy policy"
        onPress={() => {
          haptics.select();
          onChange(!value);
        }}
        hitSlop={8}
        style={{
          width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
          borderColor: value ? colors.text : colors.faint, backgroundColor: value ? colors.text : 'transparent',
        }}
      >
        {value && <Icon name="checkmark" size={16} color={colors.inverse} />}
      </Pressable>
      <Text style={[type.body, { flex: 1, fontSize: 15, lineHeight: 22 }]}>
        I&apos;m 13 or over and agree to the{' '}
        <Text accessibilityRole="link" style={{ textDecorationLine: 'underline', fontWeight: '600' }} onPress={() => router.push('/privacy')}>
          privacy policy
        </Text>
        , including my date of birth, gender, university and house area being used for anonymous statistics.
      </Text>
    </View>
  );
}
