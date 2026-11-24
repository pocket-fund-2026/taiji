// First-run onboarding in a playful, tactile style: chunky bottom-shadow buttons, thick-bordered answer tiles,
// one question per screen and a progress bar. Only this flow uses it; the rest of the app keeps the wedding-stationery look.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tr } from './i18n';
import { Icon, IconName, Logo, CAT_ICON } from './icons';
import { C, F, useReducedMotion } from './ui';
import { Prefs, markOnboarded, setPrefs } from './prefs';

// Taiji palette only: burgundy, gold and ivory from the app theme (C). Nothing here is Duolingo green or blue.
export const DUO = {
  green: C.primary, greenDeep: C.primaryDark, blue: C.gold, blueDeep: C.primary, bluePale: C.goldSoft,
  snow: C.card, swan: C.line, hare: C.faint, wolf: C.mute, eel: C.ink, bg: C.bg, white: '#FFFEFC',
};
const ND = Platform.OS !== 'web';
const HEAVY = '800' as const;
const SERIF = { fontFamily: F.display, fontWeight: '400' as const };

// A button that looks pressable: a solid 4 px lip underneath that the button sinks into when pressed.
export function DuoBtn({ title, onPress, kind = 'primary', disabled, icon }: { title: string; onPress: () => void; kind?: 'primary' | 'secondary'; disabled?: boolean; icon?: IconName }) {
  const primary = kind === 'primary';
  const bg = disabled ? DUO.swan : primary ? DUO.green : DUO.snow;
  const lip = disabled ? DUO.hare : primary ? DUO.greenDeep : DUO.swan;
  const ink = disabled ? DUO.hare : primary ? DUO.white : DUO.green;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 52, borderRadius: 16, paddingHorizontal: 24, paddingTop: 14, paddingBottom: pressed ? 14 : 14, marginTop: pressed ? 4 : 0, marginBottom: pressed ? 0 : 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: bg, borderWidth: primary ? 0 : 2, borderColor: DUO.swan, borderBottomWidth: pressed ? 0 : 4, borderBottomColor: lip })}>
    {icon ? <Icon name={icon} size={20} color={ink} strokeWidth={2} /> : null}
    <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 17, ...SERIF, letterSpacing: 0.2, color: ink }}>{title}</Text>
  </Pressable>;
}

// An answer card. Selected answers turn gold, the way a chosen option does in a quiz.
function Tile({ label, detail, icon, on, onPress, multi }: { label: string; detail?: string; icon?: IconName; on: boolean; onPress: () => void; multi?: boolean }) {
  return <Pressable accessibilityRole={multi ? 'checkbox' : 'radio'} accessibilityState={{ checked: on, selected: on }} accessibilityLabel={label} onPress={onPress}
    style={({ pressed }) => ({ borderRadius: 16, borderWidth: 2, borderBottomWidth: pressed ? 2 : 4, marginTop: pressed ? 2 : 0, marginBottom: pressed ? 2 : 0, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: on ? DUO.bluePale : DUO.snow, borderColor: on ? DUO.blue : DUO.swan })}>
    {icon ? <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: on ? DUO.white : DUO.bg, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={24} color={on ? DUO.blueDeep : DUO.wolf} /></View> : null}
    <View style={{ flex: 1 }}>
      <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 17, ...SERIF, color: on ? DUO.blueDeep : DUO.eel }}>{label}</Text>
      {detail ? <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 14, lineHeight: 20, color: on ? DUO.blueDeep : DUO.wolf, marginTop: 2 }}>{detail}</Text> : null}
    </View>
    {multi ? <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: on ? DUO.blue : DUO.swan, backgroundColor: on ? DUO.blue : DUO.white, alignItems: 'center', justifyContent: 'center' }}>{on ? <Icon name="check" size={16} color={DUO.white} strokeWidth={3} /> : null}</View> : null}
  </Pressable>;
}

function Progress({ value }: { value: number }) {
  const { reduced } = useReducedMotion();
  const w = useRef(new Animated.Value(value)).current;
  useEffect(() => { if (reduced) w.setValue(value); else Animated.timing(w, { toValue: value, duration: 320, useNativeDriver: false }).start(); }, [value, reduced, w]);
  return <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }} style={{ flex: 1, height: 16, borderRadius: 9999, backgroundColor: DUO.swan, overflow: 'hidden' }}>
    <Animated.View style={{ height: 16, borderRadius: 9999, backgroundColor: DUO.green, width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }}>
      <View style={{ position: 'absolute', left: 8, right: 8, top: 4, height: 4, borderRadius: 9999, backgroundColor: 'rgba(243,232,209,0.4)' }} />
    </Animated.View>
  </View>;
}

// The mark bounces in when a screen appears, unless the phone asks for reduced motion.
function Mascot({ size = 112 }: { size?: number }) {
  const { reduced } = useReducedMotion();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => { if (reduced) { v.setValue(1); return; } Animated.spring(v, { toValue: 1, friction: 4, tension: 90, useNativeDriver: ND }).start(); }, [reduced, v]);
  return <Animated.View style={{ alignSelf: 'center', transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }], opacity: v }}><Logo size={size} radius={size * 0.26} /></Animated.View>;
}

// Landing screen: a burgundy hero with a gold arch, then three plain promises. Taiji palette only.
const PROMISES: [IconName, string, string][] = [
  ['shield', 'Verified listings', 'Vendors show whether they are verified, with prices, portfolios and reviews you can compare.'],
  ['calendar', 'A checklist for your date', 'What to book first, and when, counted back from your wedding day.'],
  ['family', 'One budget for the family', 'Parents, siblings and your partner see the same vendors and the same numbers.'],
];
function Welcome({ top }: { top: number }) {
  return <View style={{ marginHorizontal: -20, marginTop: -8 }}>
    <View style={{ backgroundColor: C.primary, paddingTop: top + 36, paddingBottom: 56, paddingHorizontal: 24, alignItems: 'center', overflow: 'hidden', borderBottomLeftRadius: 36, borderBottomRightRadius: 36 }}>
      <View pointerEvents="none" style={{ position: 'absolute', top: -120, width: 420, height: 420, borderRadius: 210, borderWidth: 2, borderColor: 'rgba(232,200,119,0.22)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', top: -70, width: 320, height: 320, borderRadius: 160, borderWidth: 2, borderColor: 'rgba(232,200,119,0.16)' }} />
      <Mascot size={96} />
      <Text maxFontSizeMultiplier={1.2} style={{ marginTop: 12, fontSize: 13, letterSpacing: 3, color: '#E8C877', textTransform: 'uppercase', fontWeight: '700' }}>Shaadi OS</Text>
      <Text maxFontSizeMultiplier={1.3} accessibilityRole="header" style={{ fontSize: 34, lineHeight: 40, ...SERIF, color: '#FFFEFC', textAlign: 'center', marginTop: 18 }}>{tr('Plan your shaadi, one step at a time')}</Text>
      <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 16, lineHeight: 24, color: 'rgba(255,254,252,0.82)', textAlign: 'center', marginTop: 10 }}>{tr('Real vendors, a checklist for your date and a budget your whole family can see.')}</Text>
    </View>
    <View style={{ paddingHorizontal: 24, paddingTop: 28, gap: 20, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
      {PROMISES.map(([icon, title, body]) => <View key={title} style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: C.goldSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={24} color={C.primary} strokeWidth={1.75} /></View>
        <View style={{ flex: 1 }}>
          <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 17, ...SERIF, color: DUO.eel }}>{tr(title)}</Text>
          <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 14, lineHeight: 20, color: DUO.wolf, marginTop: 2 }}>{tr(body)}</Text>
        </View>
      </View>)}
    </View>
  </View>;
}

const CITIES: [string, string][] = [['Mumbai', 'Venues, caterers and studios across the city'], ['Pune', 'Lawns, mandaps and makers'], ['Nashik', 'Vendors in the city and nearby'], ['Nagpur', 'Venues and vendors across Nagpur']];
const SERVICES: [string, string][] = [['venue', 'Venue'], ['caterer', 'Catering'], ['photographer', 'Photography'], ['decor', 'Decor'], ['makeup', 'Makeup'], ['mehndi', 'Mehndi'], ['dj', 'DJ & music'], ['pandit', 'Pandit']];
const TIMELINES: [string, string, string][] = [['soon', 'Within 3 months', 'We will start with what needs booking first'], ['mid', '3 to 6 months', 'A steady pace, venue and food first'], ['far', '6 to 12 months', 'Plenty of time to compare'], ['later', 'More than a year', 'Start early and shortlist slowly'], ['unsure', 'No date yet', 'Browse first, decide later']];

// Steps: 0 welcome, 1 role, 2 city, 3 services, 4 timing, 5 done. Vendors skip 2 to 4.
export default function Onboarding({ onDone }: { onDone: (to: 'home' | 'signin', prefs: Prefs) => void }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<Prefs['role']>(); const [city, setCity] = useState(''); const [services, setServices] = useState<string[]>([]); const [timeline, setTimeline] = useState('');
  const vendor = role === 'vendor';
  const total = vendor ? 3 : 6;
  const pos = vendor && step === 5 ? 2 : step;
  const finish = async (to: 'home' | 'signin') => { const p: Prefs = { role, ...(vendor ? {} : { city, services, timeline }) }; await setPrefs(p); await markOnboarded(); onDone(to, p); };
  const next = () => setStep(vendor && step === 1 ? 5 : step + 1);
  const back = () => setStep(vendor && step === 5 ? 1 : Math.max(0, step - 1));
  const canNext = step === 1 ? !!role : step === 2 ? !!city : step === 4 ? !!timeline : true;
  const toggle = (k: string) => setServices(s => s.includes(k) ? s.filter(x => x !== k) : [...s, k]);

  const heading = (t: string, sub?: string) => <View style={{ marginBottom: 20 }}>
    <Text maxFontSizeMultiplier={1.3} accessibilityRole="header" style={{ fontSize: 28, lineHeight: 34, ...SERIF, color: DUO.eel }}>{t}</Text>
    {sub ? <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 16, lineHeight: 23, color: DUO.wolf, marginTop: 6 }}>{sub}</Text> : null}
  </View>;

  return <View style={{ flex: 1, backgroundColor: DUO.bg, paddingTop: step === 0 ? 0 : insets.top }}>
    {step > 0 && step < 5 ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 14 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={tr('Back')} onPress={back} hitSlop={12} style={{ minWidth: 32, minHeight: 32, justifyContent: 'center' }}><Icon name="close" size={26} color={DUO.hare} strokeWidth={2.5} /></Pressable>
      <Progress value={pos / (total - 1)} />
    </View> : <View style={{ height: 14 }} />}
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, padding: 20, paddingTop: 8, width: '100%', maxWidth: 520, alignSelf: 'center' }} showsVerticalScrollIndicator={false}>
      {step === 0 && <Welcome top={insets.top} />}
      {step === 1 && <>{heading(tr('Who is this for?'))}<View style={{ gap: 12 }}>
        <Tile icon="family" on={role === 'couple'} onPress={() => setRole('couple')} label={tr('I’m planning a wedding')} detail={tr('For the couple and family')} />
        <Tile icon="search" on={role === 'browse'} onPress={() => setRole('browse')} label={tr('Just looking around')} detail={tr('Browse vendors, no account needed')} />
        <Tile icon="store" on={role === 'vendor'} onPress={() => setRole('vendor')} label={tr('I’m a wedding vendor')} detail={tr('List your services and get enquiries')} />
      </View></>}
      {step === 2 && <>{heading(tr('Where is the wedding?'), tr('We will show vendors who work in your city.'))}<View style={{ gap: 12 }}>
        {CITIES.map(([c, d]) => <Tile key={c} icon="pin" on={city === c} onPress={() => setCity(c)} label={c} detail={tr(d)} />)}
      </View></>}
      {step === 3 && <>{heading(tr('What do you need first?'), tr('Pick as many as you like. You can change this any time.'))}<View style={{ gap: 12 }}>
        {SERVICES.map(([k, l]) => <Tile key={k} multi icon={CAT_ICON[k] || 'store'} on={services.includes(k)} onPress={() => toggle(k)} label={tr(l)} />)}
      </View></>}
      {step === 4 && <>{heading(tr('When is the big day?'), tr('This sets how fast we nudge you.'))}<View style={{ gap: 12 }}>
        {TIMELINES.map(([k, l, d]) => <Tile key={k} icon="calendar" on={timeline === k} onPress={() => setTimeline(k)} label={tr(l)} detail={tr(d)} />)}
      </View></>}
      {step === 5 && <View style={{ flex: 1, justifyContent: 'center', paddingTop: 16 }}>
        <Mascot size={120} />
        <Text maxFontSizeMultiplier={1.3} accessibilityRole="header" style={{ fontSize: 32, lineHeight: 38, ...SERIF, color: DUO.eel, textAlign: 'center', marginTop: 24 }}>{vendor ? tr('Let’s set up your business') : tr('You’re all set!')}</Text>
        <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 17, lineHeight: 25, color: DUO.wolf, textAlign: 'center', marginTop: 10 }}>{vendor ? tr('Create a vendor account with your mobile number and start receiving enquiries.') : `${tr('Showing you vendors in')} ${city || tr('your city')}${services.length ? ` ${tr('for')} ${services.slice(0, 2).map(k => tr(SERVICES.find(s => s[0] === k)?.[1] || k).toLowerCase()).join(' and ')}${services.length > 2 ? ` ${tr('and more')}` : ''}` : ''}.`}</Text>
        {!vendor && <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 18 }}>{[city, ...services.map(k => tr(SERVICES.find(s => s[0] === k)?.[1] || k))].filter(Boolean).map(c => <View key={c} style={{ borderRadius: 9999, borderWidth: 2, borderColor: DUO.swan, paddingHorizontal: 14, paddingVertical: 6 }}><Text maxFontSizeMultiplier={1.3} style={{ fontSize: 14, fontWeight: HEAVY, color: DUO.wolf }}>{c}</Text></View>)}</View>}
      </View>}
    </ScrollView>
    <View style={{ padding: 20, paddingBottom: insets.bottom + 16, borderTopWidth: step > 0 && step < 5 ? 2 : 0, borderTopColor: DUO.swan, width: '100%', maxWidth: 520, alignSelf: 'center' }}>
      {step === 0 && <><DuoBtn title={tr('Get started')} onPress={next} /><View style={{ height: 8 }} /><DuoBtn kind="secondary" title={tr('I already have an account')} onPress={() => finish('signin')} /></>}
      {step > 0 && step < 5 && <DuoBtn title={tr('Continue')} disabled={!canNext} onPress={next} />}
      {step === 5 && (vendor ? <DuoBtn title={tr('Create vendor account')} onPress={() => finish('signin')} />
        : <><DuoBtn title={tr('See vendors')} onPress={() => finish('home')} /><View style={{ height: 8 }} /><DuoBtn kind="secondary" title={tr('Create a free account')} onPress={() => finish('signin')} /></>)}
    </View>
  </View>;
}
