// Opening animation. The scene (three.js + GSAP) lives in opening/opening.js and is bundled offline into openingHtml.ts.
// It plays over the burgundy boot colour, so the native splash, this and the boot screen hand off with no flash.
// Skipped for reduced motion; if WebGL or the WebView fails, or takes too long, the app simply continues.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { OPENING_HTML } from './openingHtml';
import { C, useReducedMotion } from './ui';

export function Opening({ onDone }: { onDone: () => void }) {
  const { reduced, ready } = useReducedMotion();
  const fade = useRef(new Animated.Value(1)).current; const done = useRef(false);
  const [mounted, setMounted] = useState(true);
  const end = React.useCallback(() => {
    if (done.current) return; done.current = true;
    Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start(() => { setMounted(false); onDone(); });
  }, [fade, onDone]);
  useEffect(() => { if (ready && reduced) end(); }, [ready, reduced, end]);
  // Failsafe: the whole sequence is about 4.4 s; never hold the app hostage beyond 8 s.
  useEffect(() => { const t = setTimeout(end, 8000); return () => clearTimeout(t); }, [end]);
  if (!mounted || Platform.OS === 'web' || (ready && reduced)) return null;
  return <Animated.View pointerEvents="auto" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.primary, opacity: fade, zIndex: 999 }}>
    <WebView source={{ html: OPENING_HTML }} originWhitelist={['*']} javaScriptEnabled scrollEnabled={false} bounces={false} overScrollMode="never"
      style={{ flex: 1, backgroundColor: 'transparent' }} containerStyle={{ backgroundColor: C.primary }} androidLayerType="hardware"
      onMessage={e => { const m = e.nativeEvent.data; if (m === 'done' || m === 'fail') end(); }} onError={end} onHttpError={end} accessible={false} importantForAccessibility="no-hide-descendants" />
  </Animated.View>;
}
