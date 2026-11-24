// Pick any city in India. One field; tapping it opens a list with search on top. Cities that have vendors come first (with counts),
// then popular cities, then every city by state. A city that is not listed can be typed in. The vendor counts load by themselves,
// so every screen that uses this behaves the same.
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from './api';
import { tr } from './i18n';
import { Btn, C, F, Input, M } from './ui';
import { Icon } from './icons';
import { INDIA_CITIES, POPULAR_CITIES } from './india';

type Listed = { city: string; vendors: number };
let cache: { at: number; rows: Listed[] } | null = null;
/** Cities that have vendor listings, with counts. Fetched once and shared; an empty list when offline. */
export function useListedCities(): Listed[] {
  const [rows, setRows] = useState<Listed[]>(cache?.rows || []);
  useEffect(() => {
    if (cache && Date.now() - cache.at < 300_000) return;
    let on = true;
    api<Listed[]>('/vendors/cities').then(r => { cache = { at: Date.now(), rows: r || [] }; if (on) setRows(cache.rows); }).catch(() => {});
    return () => { on = false; };
  }, []);
  return rows;
}

export function CityPicker({ value, onChange, allowAll, label }: { value: string; onChange: (c: string) => void; allowAll?: boolean; label?: string; listed?: string[] }) {
  const insets = useSafeAreaInsets();
  const listed = useListedCities();
  const [open, setOpen] = useState(false); const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const counts = useMemo(() => Object.fromEntries(listed.map(l => [l.city.toLowerCase(), l.vendors])), [listed]);
  const withVendors = useMemo(() => [...listed].sort((a, b) => b.vendors - a.vendors || a.city.localeCompare(b.city)), [listed]);
  const have = new Set(listed.map(l => l.city.toLowerCase()));
  const popular = POPULAR_CITIES.filter(c => !have.has(c.toLowerCase()));
  const popularSet = new Set(POPULAR_CITIES.map(c => c.toLowerCase()));
  const byState = INDIA_CITIES.map(([state, cities]) => [state, cities.filter(c => !have.has(c.toLowerCase()) && !popularSet.has(c.toLowerCase()))] as [string, string[]]).filter(([, c]) => c.length);
  const everyCity = useMemo(() => Array.from(new Set([...listed.map(l => l.city), ...INDIA_CITIES.flatMap(([, c]) => c)])).sort((a, b) => a.localeCompare(b)), [listed]);
  const matches = query ? everyCity.filter(c => c.toLowerCase().includes(query)).slice(0, 30) : [];
  const close = () => { setOpen(false); setQ(''); };
  const pick = (c: string) => { onChange(c); close(); };
  const n = value ? counts[value.toLowerCase()] : undefined;

  const Row = ({ city }: { city: string }) => {
    const c = counts[city.toLowerCase()]; const on = value.toLowerCase() === city.toLowerCase();
    return <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={city || tr('All cities')} onPress={() => pick(city)}
      style={({ pressed }) => ({ minHeight: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: pressed ? C.tint : 'transparent' })}>
      <Text maxFontSizeMultiplier={1.3} style={{ flex: 1, fontSize: 16, color: C.ink, fontWeight: on ? '700' : '400' }}>{city || tr('All cities')}</Text>
      {c ? <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 13, color: C.mute, marginRight: on ? 10 : 0 }}>{c} {tr(c === 1 ? 'vendor' : 'vendors')}</Text> : null}
      {on ? <Icon name="check" size={18} color={C.primary} strokeWidth={2.5} /> : null}
    </Pressable>;
  };
  const Heading = ({ text }: { text: string }) => <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 12, letterSpacing: 1.6, fontWeight: '700', color: C.mute, textTransform: 'uppercase', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, backgroundColor: C.bg }}>{text}</Text>;

  return <View style={{ marginBottom: 12 }}>
    {label ? <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 13, fontWeight: '500', color: C.mute, marginBottom: 6 }}>{label}</Text> : null}
    <Pressable accessibilityRole="button" accessibilityLabel={`${label || tr('City')}: ${value || tr('Choose your city')}`} onPress={() => setOpen(true)}
      style={({ pressed }) => ({ minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.85 : 1 })}>
      <Icon name="pin" size={18} color={C.primary} />
      <Text maxFontSizeMultiplier={1.3} style={{ flex: 1, fontSize: 16, color: value ? C.ink : C.faint }}>{value || (allowAll ? tr('All cities') : tr('Choose your city'))}</Text>
      <View style={{ transform: [{ rotate: '90deg' }] }}><Icon name="chevron" size={16} color={C.mute} strokeWidth={2} /></View>
    </Pressable>
    {value ? <M style={{ marginTop: 6 }}>{n ? `${n} ${tr(n === 1 ? 'vendor' : 'vendors')} ${tr('listed in')} ${value}.` : listed.length ? tr('No vendors are listed here yet. Planning tools work everywhere in India.') : ''}</M> : null}

    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close} transparent={false}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: Math.max(insets.top, 12) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 }}>
          <Text maxFontSizeMultiplier={1.3} accessibilityRole="header" style={{ flex: 1, fontFamily: F.display, fontSize: 22, color: C.ink }}>{tr('Choose your city')}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={tr('Close')} onPress={close} hitSlop={12} style={{ minHeight: 40, justifyContent: 'center' }}><Text maxFontSizeMultiplier={1.3} style={{ color: C.primary, fontSize: 16, fontWeight: '600' }}>{tr('Done')}</Text></Pressable>
        </View>
        <View style={{ paddingHorizontal: 20 }}>
          <Input icon="search" value={q} onChangeText={setQ} placeholder={tr('Search any city in India')} autoCapitalize="words" autoCorrect={false} maxLength={60} returnKeyType="done"
            onSubmitEditing={() => q.trim().length > 1 && pick(matches[0] || q.trim())} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          {query ? <>
            {matches.map(c => <Row key={c} city={c} />)}
            {!matches.some(c => c.toLowerCase() === query) && q.trim().length > 1 ? <View style={{ padding: 20 }}><Btn kind="quiet" title={`${tr('Use')} “${q.trim()}”`} onPress={() => pick(q.trim())} /><M>{tr('Not in the list? Type your city and use it. The planner works everywhere in India.')}</M></View> : null}
          </> : <>
            {allowAll ? <Row city="" /> : null}
            {withVendors.length ? <><Heading text={tr('Cities with vendors')} />{withVendors.map(l => <Row key={l.city} city={l.city} />)}</> : null}
            {popular.length ? <><Heading text={tr('Popular cities')} />{popular.map(c => <Row key={c} city={c} />)}</> : null}
            {byState.map(([state, cities]) => <View key={state}><Heading text={state} />{cities.map(c => <Row key={c} city={c} />)}</View>)}
          </>}
        </ScrollView>
      </View>
    </Modal>
  </View>;
}
