// Local press feedback for bare Pressables used as cards or rows: a small spring to PRESS_SCALE (transform, native driver).
// Layout styles pass through untouched; the `pressed` style callback is still honoured.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, PressableProps } from 'react-native';
import { PRESS_SCALE, useReducedMotion } from './ui';
const ND = Platform.OS !== 'web';
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressScale({ style, onPressIn, onPressOut, children, ...rest }: Omit<PressableProps, 'style' | 'children'> & { style?: any; children?: React.ReactNode }) {
  const { reduced } = useReducedMotion(); const v = useRef(new Animated.Value(1)).current; const [pressed, setPressed] = useState(false);
  useEffect(() => { if (reduced) { v.stopAnimation(); v.setValue(1); } return () => v.stopAnimation(); }, [reduced, v]);
  const go = (n: number) => { if (reduced) return; Animated.spring(v, { toValue: n, useNativeDriver: ND, speed: 40, bounciness: 0 }).start(); };
  const resolved = typeof style === 'function' ? style({ pressed }) : style;
  return <AnimatedPressable {...rest} onPressIn={e => { setPressed(true); go(PRESS_SCALE); onPressIn?.(e); }} onPressOut={e => { setPressed(false); go(1); onPressOut?.(e); }} style={[resolved, { transform: [{ scale: v }] }]}>{children}</AnimatedPressable>;
}
