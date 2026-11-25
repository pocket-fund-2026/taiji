// Motion primitives. Rules: animate transform and opacity (compositor) wherever possible, never from scale 0,
// respect reduced motion, and never block input while moving.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, Text, View } from 'react-native';
import { C, ENTER_SCALE, MOTION, useReducedMotion } from './ui';
const ND = Platform.OS !== 'web';

// SMOOTH HEIGHT: content opens and closes to its measured height instead of snapping. Height itself cannot use the native
// driver, so the content is measured once and only the clip height and opacity move.
export function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  const { reduced } = useReducedMotion();
  const [h, setH] = useState(0); const [mounted, setMounted] = useState(open);
  const v = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    if (open) setMounted(true);
    if (reduced) { v.setValue(open ? 1 : 0); if (!open) setMounted(false); return; }
    const a = Animated.timing(v, { toValue: open ? 1 : 0, duration: MOTION.reveal, easing: MOTION.easing, useNativeDriver: false });
    a.start(({ finished }) => { if (finished && !open) setMounted(false); });
    return () => a.stop();
  }, [open, reduced, v]);
  if (!mounted) return null;
  const measured = h > 0;
  return <Animated.View style={{ overflow: 'hidden', opacity: v, ...(measured ? { height: v.interpolate({ inputRange: [0, 1], outputRange: [0, h] }) } : null) }}>
    <View onLayout={e => setH(e.nativeEvent.layout.height)} style={measured ? { position: 'absolute', left: 0, right: 0, top: 0 } : undefined}>{children}</View>
  </Animated.View>;
}

// DIRECTIONAL SLIDES: content enters from the side it logically came from (forward = from the right, back = from the left).
// Uses translateX (transform), not `left`. Give it a changing `key` to replay per screen.
export function Slide({ dir = 1, children, style }: { dir?: 1 | -1 | 0; children: React.ReactNode; style?: any }) {
  const { reduced } = useReducedMotion(); const v = useRef(new Animated.Value(reduced || !dir ? 1 : 0)).current;
  useEffect(() => { if (reduced || !dir) { v.setValue(1); return; } const a = Animated.timing(v, { toValue: 1, duration: MOTION.reveal, easing: MOTION.easing, useNativeDriver: ND }); a.start(); return () => a.stop(); }, [dir, reduced, v]);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [dir * 18, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [ENTER_SCALE, 1] }) }] }]}>{children}</Animated.View>;
}

// TOOLTIP WITH SKIP DELAY: the first tooltip waits 500 ms; once one has been seen, neighbours appear instantly (and without
// animation) for 800 ms, so scanning a row of icon buttons does not stall. Hover on web, press-and-hold on touch.
let lastSeen = 0;
export function Tooltip({ label, children, style }: { label: string; children: React.ReactNode; style?: any }) {
  const [show, setShow] = useState(false); const [warm, setWarm] = useState(false); const timer = useRef<any>(null);
  const open = useCallback((hold = 500) => { clearTimeout(timer.current); const isWarm = Date.now() - lastSeen < 800; timer.current = setTimeout(() => { setWarm(isWarm); setShow(true); lastSeen = Date.now(); }, isWarm ? 0 : hold); }, []);
  const close = useCallback((after = 0) => { clearTimeout(timer.current); timer.current = setTimeout(() => { setShow(s => { if (s) lastSeen = Date.now(); return false; }); }, after); }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const events: any = { onPointerEnter: () => open(500), onPointerLeave: () => close(0), onTouchStart: () => open(450), onTouchEnd: () => close(1100), onTouchCancel: () => close(0) };
  return <View {...events} style={[{ alignSelf: 'flex-start' }, style]}>
    {children}
    {show ? <Bubble label={label} instant={warm} /> : null}
  </View>;
}
function Bubble({ label, instant }: { label: string; instant: boolean }) {
  const { reduced } = useReducedMotion(); const v = useRef(new Animated.Value(instant || reduced ? 1 : 0)).current;
  useEffect(() => { if (instant || reduced) return; const a = Animated.timing(v, { toValue: 1, duration: 120, easing: MOTION.easing, useNativeDriver: ND }); a.start(); return () => a.stop(); }, [instant, reduced, v]);
  return <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no" style={{ position: 'absolute', bottom: '100%', alignSelf: 'center', marginBottom: 6, backgroundColor: C.ink, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [ENTER_SCALE, 1] }) }], zIndex: 100 }}>
    <Text numberOfLines={1} style={{ color: '#fff', fontSize: 12, fontWeight: '500' }}>{label}</Text></Animated.View>;
}

// RUBBER BAND: past a limit a drag resists instead of stopping dead. Apple's curve: x' = (1 - 1/(x*c/d + 1)) * d.
export const rubber = (x: number, d = 60, c = 0.55) => (1 - 1 / ((x * c) / d + 1)) * d;

// VELOCITY SPRINGS + RUBBER BANDING: drag down to dismiss. Dragging the wrong way resists (rubber band); on release the
// spring inherits the finger's velocity, so a flick finishes fast and a slow release settles gently.
export function useSwipeDismiss(onDismiss: () => void, distance = 140) {
  const { reduced } = useReducedMotion(); const y = useRef(new Animated.Value(0)).current; const cb = useRef(onDismiss); cb.current = onDismiss;
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => y.setValue(g.dy >= 0 ? g.dy : -rubber(-g.dy)),
    onPanResponderRelease: (_, g) => {
      const out = g.dy > 48 || g.vy > 0.6;
      if (reduced) { if (out) cb.current(); y.setValue(0); return; }
      Animated.spring(y, { toValue: out ? distance : 0, velocity: g.vy, tension: 170, friction: out ? 22 : 16, useNativeDriver: ND }).start(() => { if (out) cb.current(); });
    },
    onPanResponderTerminate: () => { Animated.spring(y, { toValue: 0, useNativeDriver: ND }).start(); },
  })).current;
  return { handlers: pan.panHandlers, style: { transform: [{ translateY: y }] } };
}
