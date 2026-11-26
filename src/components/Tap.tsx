/**
 * A Pressable that "squishes" the instant your finger lands (to 97%) and
 * springs back when you let go, like Apple's own buttons and cards. Runs on
 * the phone's UI thread (Reanimated), so it never lags behind your finger.
 * Use it anywhere you'd use Pressable for a button, card or tile.
 */
import { useState } from 'react';
import { Pressable, type PressableProps, type PressableStateCallbackType, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Quick and firm going in; a little give coming back out. */
export const PRESS_IN = { damping: 26, stiffness: 520, mass: 0.6 };
export const PRESS_OUT = { damping: 14, stiffness: 320, mass: 0.6 };

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle> | ((s: PressableStateCallbackType) => StyleProp<ViewStyle>);
  /** How small it gets while pressed. Cards ~0.97, small buttons/chips ~0.94. */
  scaleTo?: number;
};

export function Tap({ style, scaleTo = 0.97, onPressIn, onPressOut, disabled, ...rest }: Props) {
  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const resolved = typeof style === 'function' ? style({ pressed, hovered: false } as PressableStateCallbackType) : style;
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        setPressed(true);
        if (!disabled) scale.set(withSpring(scaleTo, PRESS_IN));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        scale.set(withSpring(1, PRESS_OUT));
        onPressOut?.(e);
      }}
      style={[resolved, anim]}
    />
  );
}
