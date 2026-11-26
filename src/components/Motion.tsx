/**
 * List items that move like Apple's: new ones spring in, removed ones fade
 * out, and everything else glides into its new place instead of jumping.
 */
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import type { StyleProp, ViewStyle } from 'react-native';

/** A gentle spring that settles without wobbling. */
const glide = LinearTransition.springify().damping(22).stiffness(220);

export function Item({ children, index = 0, style }: { children: React.ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View
      style={style}
      entering={FadeInDown.delay(Math.min(index, 6) * 45).springify().damping(20).stiffness(200)}
      exiting={FadeOut.duration(180)}
      layout={glide}
    >
      {children}
    </Animated.View>
  );
}
