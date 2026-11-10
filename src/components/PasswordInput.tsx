import { useState } from 'react';
import { Pressable, View, type TextInputProps } from 'react-native';
import { haptics } from '../lib/haptics';
import { Icon, Input } from './ui';
import { colors } from './theme';

/** Password box with an eye button to show or hide what you've typed. */
export function PasswordInput(props: Omit<TextInputProps, 'secureTextEntry'>) {
  const [shown, setShown] = useState(false);
  return (
    <View style={{ justifyContent: 'center' }}>
      <Input {...props} secureTextEntry={!shown} autoCapitalize="none" autoCorrect={false} style={[{ paddingRight: 52 }, props.style]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={shown ? 'Hide password' : 'Show password'}
        onPress={() => {
          haptics.select();
          setShown(!shown);
        }}
        hitSlop={8}
        style={{ position: 'absolute', right: 14, padding: 4 }}
      >
        <Icon name={shown ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
      </Pressable>
    </View>
  );
}
