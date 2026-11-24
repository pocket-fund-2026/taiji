// Pick any city in India: popular cities as chips, a searchable list by state, or type a city that is not listed.
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { tr } from './i18n';
import { Btn, C, Chip, Input, M } from './ui';
import { ALL_CITIES, POPULAR_CITIES } from './india';

export function CityPicker({ value, onChange, listed = [] }: { value: string; onChange: (c: string) => void; listed?: string[] }) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const matches = query ? ALL_CITIES.filter(c => c.toLowerCase().includes(query)).slice(0, 8) : [];
  const chips = value && !POPULAR_CITIES.includes(value) ? [value, ...POPULAR_CITIES] : POPULAR_CITIES;
  const pick = (c: string) => { onChange(c); setOpen(false); setQ(''); };
  const hasVendors = !!value && listed.some(c => c.toLowerCase() === value.toLowerCase());
  return <View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {chips.map(c => <Chip key={c} label={c} on={value === c} onPress={() => onChange(c)} />)}
      <Chip label={open ? tr('Close search') : tr('Other city')} on={open} onPress={() => setOpen(!open)} />
    </View>
    {open ? <View style={{ marginTop: 4 }}>
      <Input icon="search" label={tr('Search your city')} value={q} onChangeText={setQ} placeholder={tr('e.g. Indore, Udaipur, Kochi')} autoCapitalize="words" autoCorrect={false} maxLength={60} returnKeyType="done" onSubmitEditing={() => q.trim().length > 1 && pick(q.trim())} />
      {matches.map(c => <Pressable key={c} accessibilityRole="button" onPress={() => pick(c)} style={{ minHeight: 44, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: C.line }}>
        <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 15, color: C.ink }}>{c}</Text></Pressable>)}
      {q.trim().length > 1 && !matches.some(c => c.toLowerCase() === query) ? <Btn kind="quiet" title={`${tr('Use')} “${q.trim()}”`} onPress={() => pick(q.trim())} /> : null}
    </View> : null}
    {value && listed.length > 0 ? <M style={{ marginTop: 4 }}>{hasVendors ? tr('Vendors are listed in this city.') : tr('No vendors are listed here yet. Planning tools work everywhere in India.')}</M> : null}
  </View>;
}
