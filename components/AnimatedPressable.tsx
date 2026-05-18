import { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleProp,
  ViewStyle,
} from 'react-native';

// A Pressable that springs on hover and press — the base interaction for the
// landing-page call-to-action buttons.
export function AnimatedPressable({
  children,
  style,
  onPress,
  hoverScale = 1.04,
  pressScale = 0.96,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  hoverScale?: number;
  pressScale?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const hovered = useRef(false);

  const spring = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: false,
      friction: 7,
      tension: 90,
    }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onHoverIn={() => {
          hovered.current = true;
          spring(hoverScale);
        }}
        onHoverOut={() => {
          hovered.current = false;
          spring(1);
        }}
        onPressIn={() => spring(pressScale)}
        onPressOut={() => spring(hovered.current ? hoverScale : 1)}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
