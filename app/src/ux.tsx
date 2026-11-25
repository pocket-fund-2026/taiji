// Shared UX primitives. Each one exists to apply a named UX law once, so screens reuse it instead of reinventing it.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tr } from './i18n';
import { Icon } from './icons';
import { Bar, C, F, M, MOTION, Tag, useReducedMotion } from './ui';
import { Collapse, useSwipeDismiss } from './motion';

// LAW OF PROXIMITY: related things sit close, unrelated things sit far. Use these, not ad-hoc numbers.
export const SP = { tight: 4, near: 8, group: 12, block: 16, section: 24 } as const;

// LAW OF COMMON REGION: a titled, bounded region that groups related content (title and body share one card).
export { Collapse };
export function Section({ title, hint, right, children, tone = 'plain' }: { title?: string; hint?: string; right?: React.ReactNode; children: React.ReactNode; tone?: 'plain' | 'tint' }) {
  return <View style={{ backgroundColor: tone === 'tint' ? C.tint : C.card, borderRadius: 16, borderWidth: 1, borderColor: tone === 'tint' ? C.tint : C.line, padding: SP.block, marginBottom: SP.block }}>
    {title ? <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: hint ? SP.tight : SP.group }}>
      <Text maxFontSizeMultiplier={1.3} accessibilityRole="header" style={{ fontFamily: F.display, fontSize: 17, color: C.ink, flex: 1 }}>{title}</Text>{right}</View> : null}
    {hint ? <M style={{ marginBottom: SP.group }}>{hint}</M> : null}
    {children}
  </View>;
}

// Per-device flags (dismissed hints, celebrated milestones). Storage failure must never break the app.
const flagKey = (k: string) => 'ux:' + k;
export const getFlag = async (k: string) => { try { return (await AsyncStorage.getItem(flagKey(k))) === '1'; } catch { return false; } };
export const setFlag = async (k: string) => { try { await AsyncStorage.setItem(flagKey(k), '1'); } catch { /* ignore */ } };

// PARADOX OF THE ACTIVE USER: nobody reads a manual, so teach in place. One short dismissible line, shown once, where it matters.
export function Hint({ id, text, icon = 'check' }: { id: string; text: string; icon?: 'check' | 'star' | 'ring' }) {
  const [show, setShow] = useState(false);
  useEffect(() => { let on = true; getFlag('hint:' + id).then(seen => { if (on && !seen) setShow(true); }); return () => { on = false; }; }, [id]);
  if (!show) return null;
  const close = () => { setShow(false); setFlag('hint:' + id); };
  return <View accessibilityRole="summary" style={{ flexDirection: 'row', alignItems: 'center', gap: SP.near, backgroundColor: C.goldSoft, borderRadius: 12, paddingLeft: SP.group, marginBottom: SP.block }}>
    <Icon name={icon} size={16} color={C.gold} />
    <Text maxFontSizeMultiplier={1.3} style={{ flex: 1, color: C.ink, fontSize: 13, lineHeight: 18, paddingVertical: SP.group }}>{text}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={tr('Dismiss tip')} onPress={close} hitSlop={8} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: C.gold, fontSize: 13, fontWeight: '600' }}>{tr('Got it')}</Text></Pressable>
  </View>;
}

// VON RESTORFF: exactly one element per screen looks different. This gold-edged card is that element; do not use it twice on a screen.
export function Spotlight({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={{ borderRadius: 18, borderWidth: 2, borderColor: C.gold, backgroundColor: C.card, padding: SP.block + 4, marginBottom: SP.block }}>
    <View style={{ marginBottom: SP.near }}><Tag tone="gold" icon="star" label={label} /></View>
    {children}
  </View>;
}

// PARKINSON'S LAW: work fills the time given, so show a small, short time box on a step.
export const Effort = ({ mins }: { mins: number }) => <M style={{ fontSize: 12 }}>{tr('About')} {mins} {tr('min')}</M>;

// GOAL GRADIENT + ZEIGARNIK: effort accelerates near a goal and unfinished things stay in mind. Shows percent, the next
// milestone and exactly how many steps remain. `endowed` counts steps already done for free (setup), so the bar never starts at 0.
export const MILESTONES = [25, 50, 75, 100] as const;
export function MilestoneBar({ done, total, endowed = 1, noun = 'steps', onDark }: { done: number; total: number; endowed?: number; noun?: string; onDark?: boolean }) {
  const t = Math.max(1, total + endowed); const d = Math.min(t, done + endowed); const pct = Math.round(d / t * 100);
  const next = MILESTONES.find(m => m > pct) ?? 100; const need = Math.max(0, Math.ceil(next / 100 * t) - d);
  const fg = onDark ? '#fff' : C.ink; const sub = onDark ? '#F4DDE5' : C.mute;
  const label = pct >= 100 ? tr('Everything is done') : next === 100 ? `${need} ${tr(noun)} ${tr('to finish')}` : `${need} ${tr(noun)} ${tr('to reach')} ${next}%`;
  return <View accessible accessibilityLabel={`${pct}% ${tr('ready')}. ${label}`}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: SP.near }}>
      <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: F.display, fontSize: 20, color: fg, fontVariant: ['tabular-nums'] }}>{pct}% {tr('ready')}</Text>
      <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 13, color: sub }}>{label}</Text></View>
    <View>
      <Bar pct={pct} color={onDark ? C.goldSoft : C.primary} />
      {MILESTONES.slice(0, 3).map(m => <View key={m} pointerEvents="none" style={{ position: 'absolute', left: `${m}%`, top: -2, width: 2, height: 9, backgroundColor: onDark ? '#A66B7E' : C.card, opacity: pct >= m ? 0 : 1 }} />)}
    </View>
  </View>;
}

// UNIFORM CONNECTEDNESS: steps of one process are joined by a line, so they read as one thing. Also LAW OF SIMILARITY: every step looks alike.
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return <View accessible accessibilityLabel={`${steps[Math.max(0, current)] || ''}, ${tr('step')} ${current + 1} ${tr('of')} ${steps.length}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
    {steps.map((s, i) => <React.Fragment key={s}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: i <= current ? C.primary : C.card, borderWidth: 2, borderColor: i <= current ? C.primary : C.line }} />
      {i < steps.length - 1 ? <View style={{ flex: 1, height: 2, backgroundColor: i < current ? C.primary : C.line }} /> : null}
    </React.Fragment>)}
  </View>;
}

// PEAK-END RULE: people remember the high point and the ending. A short, warm confirmation at moments of success.
export function Moment({ title, detail, onDone, ms = 3200 }: { title: string; detail?: string; onDone: () => void; ms?: number }) {
  const { reduced } = useReducedMotion(); const v = useRef(new Animated.Value(reduced ? 1 : 0)).current; const swipe = useSwipeDismiss(onDone);
  useEffect(() => {
    if (!reduced) Animated.timing(v, { toValue: 1, duration: MOTION.reveal, easing: MOTION.easing, useNativeDriver: Platform.OS !== 'web' }).start();
    const timer = setTimeout(onDone, ms); return () => { clearTimeout(timer); v.stopAnimation(); };
  }, [reduced, v, onDone, ms]);
  return <Animated.View {...swipe.handlers} accessibilityLiveRegion="polite" style={{ position: 'absolute', left: SP.block, right: SP.block, bottom: SP.section, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }], zIndex: 50 }}>
    <Animated.View style={swipe.style}><Pressable accessibilityRole="button" accessibilityLabel={tr('Dismiss')} onPress={onDone} style={{ flexDirection: 'row', alignItems: 'center', gap: SP.group, backgroundColor: C.primaryDark, borderRadius: 16, padding: SP.block, borderWidth: 1, borderColor: C.gold }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.goldSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={20} color={C.gold} strokeWidth={2.4} /></View>
      <View style={{ flex: 1 }}><Text maxFontSizeMultiplier={1.3} style={{ fontFamily: F.display, fontSize: 17, color: '#fff' }}>{title}</Text>
        {detail ? <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 13, color: '#F4DDE5', marginTop: 2 }}>{detail}</Text> : null}</View>
    </Pressable></Animated.View>
  </Animated.View>;
}

// Fires once per milestone, ever: crossing 25/50/75/100% shows a Moment and is remembered so it never repeats.
export function useMilestoneMoment(id: string, pct: number | null) {
  const [moment, setMoment] = useState<{ title: string; detail: string } | null>(null);
  useEffect(() => {
    if (pct == null) return; let on = true;
    (async () => {
      const hit = [...MILESTONES].reverse().find(m => pct >= m); if (!hit) return;
      if (await getFlag(`ms:${id}:${hit}`)) return;
      for (const m of MILESTONES) if (m <= hit) await setFlag(`ms:${id}:${m}`);
      if (on) setMoment(hit === 100 ? { title: tr('Everything is in place'), detail: tr('Your plan is complete. Enjoy the wedding.') } : { title: `${hit}% ${tr('of your plan is done')}`, detail: tr('You are making real progress.') });
    })();
    return () => { on = false; };
  }, [id, pct]);
  const clear = useCallback(() => setMoment(null), []);
  return [moment, clear] as const;
}

// RECOGNITION OVER RECALL: remember what the person already used and offer it back as one-tap choices.
export function useRecent(key: string, max = 5) {
  const [items, setItems] = useState<string[]>([]);
  useEffect(() => { let on = true; AsyncStorage.getItem('recent:' + key).then(v => { if (on && v) { try { setItems(JSON.parse(v)); } catch { /* ignore */ } } }).catch(() => {}); return () => { on = false; }; }, [key]);
  const add = useCallback((v: string) => {
    const t = v.trim(); if (!t) return;
    setItems(prev => { const next = [t, ...prev.filter(x => x.toLowerCase() !== t.toLowerCase())].slice(0, max); AsyncStorage.setItem('recent:' + key, JSON.stringify(next)).catch(() => {}); return next; });
  }, [key, max]);
  const clear = useCallback(() => { setItems([]); AsyncStorage.removeItem('recent:' + key).catch(() => {}); }, [key]);
  return { items, add, clear };
}

// OCCAM'S RAZOR / PARETO: show the few things most people use; fold the long tail behind one honest control.
export function MoreToggle({ open, onPress, count }: { open: boolean; onPress: () => void; count: number }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onPress} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SP.tight }}>
    <Text maxFontSizeMultiplier={1.3} style={{ color: C.primary, fontSize: 15, fontWeight: '500' }}>{open ? tr('Show fewer') : `${tr('Show')} ${count} ${tr('more')}`}</Text>
    <View style={{ transform: [{ rotate: open ? '-90deg' : '90deg' }] }}><Icon name="chevron" size={16} color={C.primary} /></View>
  </Pressable>;
}
