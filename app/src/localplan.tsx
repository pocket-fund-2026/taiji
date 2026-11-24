// Plan a wedding with no account. The plan is built once by the server's preview endpoint, then lives on this phone
// (AsyncStorage). If the person signs up later, importLocalPlan() moves it onto their account.
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { getPrefs } from './prefs';
import { tr } from './i18n';
import { Bar, Btn, C, Card, Check, Chip, DateField, F, Input, M, confirm, dateIN, inr, todayISO } from './ui';
import { FloralArch } from './visuals';
import { CityPicker } from './citypicker';
import { COMMUNITIES } from './india';
import { buildPlan, checkPlanInput } from './planengine';

const KEY = 'localplan';
type LPTask = { id: string; title: string; due?: string; done: boolean };
type LPPlan = {
  wedding: { date: string; city: string; community: string; guests_est: number; budget_paise: number };
  tasks: LPTask[]; events: { name: string; date: string }[];
  budget: { category: string; allocated_paise: number; spent_paise: number }[];
  guests: { id: string; name: string; party: number }[];
  suggestions: { key: string; title: string; due: string; phase: string }[];
};
export const getLocalPlan = async (): Promise<LPPlan | null> => { try { const v = await AsyncStorage.getItem(KEY); return v ? JSON.parse(v) : null; } catch { return null; } };
const saveLocalPlan = async (p: LPPlan) => { try { await AsyncStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable: the plan stays on screen for this session */ } };
export const clearLocalPlan = async () => { try { await AsyncStorage.removeItem(KEY); } catch { /* ignore */ } };
const uid = () => Math.random().toString(36).slice(2, 10);

// After sign-up: move the on-phone plan onto the new account, then remove it from the phone. Never throws.
export async function importLocalPlan() {
  try {
    const p = await getLocalPlan(); if (!p) return;
    const me: any = await api('/me'); if (me?.user?.role !== 'couple' || me?.wedding) return;
    const w = p.wedding;
    await api('/wedding', 'POST', { title: `${w.city} wedding`, date: w.date, city: w.city, community: w.community, guests_est: w.guests_est, budget_paise: w.budget_paise });
    const made: any[] = await api('/tasks');
    for (const t of p.tasks) {
      const match = made.find(m => m.title === t.title);
      if (match) { if (t.done && !match.done) await api(`/tasks/${match.id}`, 'PATCH', { done: true }); } else await api('/tasks', 'POST', { title: t.title, ...(t.due ? { due: t.due } : {}) }).then(async (r: any) => { if (t.done && r?.id) await api(`/tasks/${r.id}`, 'PATCH', { done: true }); });
    }
    await api('/budget', 'PUT', { total_paise: w.budget_paise, rows: p.budget.map(b => ({ category: b.category, allocated_paise: b.allocated_paise })) }).catch(() => {});
    for (const b of p.budget) if (b.spent_paise > 0) await api('/expenses', 'POST', { category: b.category, payee: tr('Paid so far'), amount_paise: b.spent_paise, paid: true }).catch(() => {});
    for (const g of p.guests) await api('/guests', 'POST', { name: g.name, party: Math.max(1, Math.min(50, g.party)) }).catch(() => {});
    await clearLocalPlan();
  } catch { /* the plan stays on the phone; they can retry from the Plan tab */ }
}

const BUDGETS = [500000, 1000000, 1500000, 2500000, 5000000];
const LABEL: Record<string, string> = { venue: 'Venue', caterer: 'Catering', photographer: 'Photography', decor: 'Decor', makeup: 'Makeup', mehndi: 'Mehndi', dj: 'DJ & music', other: 'Other' };
const daysTo = (iso: string) => Math.ceil((new Date(iso + 'T00:00:00').getTime() - Date.now()) / 86400000);

export function LocalPlanner({ navigation }: any) {
  const [plan, setPlan] = useState<LPPlan | null | undefined>(undefined);
  useEffect(() => { getLocalPlan().then(setPlan); }, []);
  const update = useCallback((fn: (p: LPPlan) => LPPlan) => setPlan(cur => { if (!cur) return cur; const next = fn(cur); saveLocalPlan(next); return next; }), []);
  if (plan === undefined) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  if (!plan) return <Setup navigation={navigation} onCreated={p => { saveLocalPlan(p); setPlan(p); }} />;
  return <Dashboard plan={plan} update={update} navigation={navigation} onReset={() => { clearLocalPlan(); setPlan(null); }} />;
}

function Hero({ title, text }: { title: string; text: string }) {
  return <View style={{ backgroundColor: C.primary, padding: 24, paddingTop: 32, overflow: 'hidden' }}>
    <View pointerEvents="none" style={{ position: 'absolute', right: -30, bottom: -50, opacity: 0.3 }}><FloralArch size={160} color={C.goldSoft} /></View>
    <Text maxFontSizeMultiplier={1.3} accessibilityRole="header" style={{ fontFamily: F.display, fontSize: 28, lineHeight: 34, color: C.goldSoft, maxWidth: 300 }}>{title}</Text>
    <Text maxFontSizeMultiplier={1.3} style={{ color: '#F4DDE5', fontSize: 15, lineHeight: 22, marginTop: 8, maxWidth: 320 }}>{text}</Text>
  </View>;
}

function Setup({ navigation, onCreated }: { navigation: any; onCreated: (p: LPPlan) => void }) {
  const [f, setF] = useState({ date: '', city: '', budget: '1500000', guests: '250', community: 'North Indian Hindu' });
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [listed, setListed] = useState<string[]>([]);
  useEffect(() => { api('/vendors/cities').then((r: any) => setListed((r || []).map((x: any) => x.city))).catch(() => {}); getPrefs().then(p => { if (p?.city) setF(x => x.city ? x : { ...x, city: p.city! }); }); }, []);
  const set = (k: string, v: string) => { setF(x => ({ ...x, [k]: v })); setError(''); };
  // The plan is built on the phone by the same rules the server uses, so it works with no internet at all.
  const go = () => {
    const input = { date: f.date, city: f.city, community: f.community, guests_est: Math.max(1, +f.guests || 200), budget_paise: Math.round(+f.budget * 100) };
    const problem = checkPlanInput(input);
    if (problem) return setError(tr(problem === 'Enter a real calendar date' ? 'Choose your wedding date.' : problem));
    setBusy(true);
    try {
      const r = buildPlan(input);
      onCreated({ wedding: { ...r.wedding }, tasks: r.tasks.map(t => ({ id: uid(), title: t.title, due: t.due, done: t.done })), events: r.events,
        budget: r.budget.map(b => ({ ...b, spent_paise: 0 })), guests: [], suggestions: r.suggestions });
    } catch (e: any) { setError(e?.message || String(e)); } finally { setBusy(false); }
  };
  return <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Hero title={tr('Plan your wedding, no account needed')} text={tr('Tell us your date, city and budget. Your plan is saved on this phone.')} />
    <View style={{ padding: 16, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
      <DateField label={tr('Wedding date')} value={f.date} onChange={v => set('date', v)} min={todayISO()} placeholder={tr('Choose the main wedding day')} />
      <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 13, fontWeight: '500', color: C.mute, marginBottom: 8 }}>{tr('City')}</Text>
      <CityPicker value={f.city} onChange={c => set('city', c)} listed={listed} />
      <Input label={tr('Total budget')} prefix="₹" value={f.budget ? (+f.budget).toLocaleString('en-IN') : ''} onChangeText={v => set('budget', v.replace(/\D/g, '').slice(0, 11))} keyboardType="number-pad" placeholder="15,00,000" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>{BUDGETS.map(b => <Chip key={b} label={inr(b * 100)} on={+f.budget === b} onPress={() => set('budget', String(b))} />)}</View>
      <Input label={tr('About how many guests?')} value={f.guests} onChangeText={v => set('guests', v.replace(/\D/g, '').slice(0, 5))} keyboardType="number-pad" placeholder="250" />
      <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 13, fontWeight: '500', color: C.mute, marginBottom: 8 }}>{tr('Your traditions')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>{COMMUNITIES.map(c => <Chip key={c} label={tr(c)} on={f.community === c} onPress={() => set('community', c)} />)}</View>
      {!!error && <Text maxFontSizeMultiplier={1.3} accessibilityRole="alert" style={{ color: C.warn, fontSize: 15, lineHeight: 20, marginBottom: 8 }}>{error}</Text>}
      <Btn title={busy ? tr('Building your plan…') : tr('Build my plan')} onPress={go} disabled={busy} />
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('SignIn')} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
        <Text maxFontSizeMultiplier={1.3} style={{ color: C.primary, fontSize: 15, fontWeight: '500' }}>{tr('I already have an account · Sign in')}</Text>
      </Pressable>
    </View>
  </ScrollView>;
}

function Dashboard({ plan, update, navigation, onReset }: { plan: LPPlan; update: (fn: (p: LPPlan) => LPPlan) => void; navigation: any; onReset: () => void }) {
  const [tab, setTab] = useState<'tasks' | 'budget' | 'guests'>('tasks');
  const today = todayISO(); const left = daysTo(plan.wedding.date);
  const done = plan.tasks.filter(t => t.done).length; const pct = plan.tasks.length ? (done / plan.tasks.length) * 100 : 0;
  return <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <View style={{ backgroundColor: C.primary, padding: 24, paddingTop: 28, overflow: 'hidden' }}>
      <View pointerEvents="none" style={{ position: 'absolute', right: -30, bottom: -50, opacity: 0.3 }}><FloralArch size={160} color={C.goldSoft} /></View>
      <Text maxFontSizeMultiplier={1.2} style={{ fontSize: 12, letterSpacing: 2.5, color: '#E8C877', fontWeight: '700', textTransform: 'uppercase' }}>{plan.wedding.city} · {dateIN(plan.wedding.date)}</Text>
      <Text maxFontSizeMultiplier={1.3} accessibilityRole="header" style={{ fontFamily: F.display, fontSize: 34, lineHeight: 40, color: C.goldSoft, marginTop: 6 }}>{left > 0 ? `${left} ${tr('days to go')}` : left === 0 ? tr('Your wedding day') : tr('Congratulations')}</Text>
      <Text maxFontSizeMultiplier={1.3} style={{ color: '#F4DDE5', fontSize: 14, marginTop: 6, marginBottom: 12 }}>{done} {tr('of')} {plan.tasks.length} {tr('tasks done')}</Text>
      <Bar pct={pct} color={C.goldSoft} />
    </View>
    <View style={{ padding: 16, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{([['tasks', 'Checklist'], ['budget', 'Budget'], ['guests', 'Guests']] as const).map(([k, l]) => <Chip key={k} label={tr(l)} on={tab === k} onPress={() => setTab(k)} />)}</View>
      {tab === 'tasks' ? <Tasks plan={plan} update={update} today={today} /> : tab === 'budget' ? <BudgetTab plan={plan} update={update} /> : <GuestsTab plan={plan} update={update} />}
      <Card style={{ marginTop: 20, backgroundColor: C.tint }}>
        <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: F.display, fontSize: 18, color: C.ink }}>{tr('Save this plan online')}</Text>
        <M style={{ marginTop: 4 }}>{tr('Your plan is only on this phone. Create a free account to back it up, add your family and ask vendors for quotes. Everything here moves across.')}</M>
        <Btn title={tr('Create a free account')} onPress={() => navigation.navigate('SignIn')} />
      </Card>
      <Pressable accessibilityRole="button" onPress={async () => { if (await confirm(tr('Start over?'), tr('This deletes the plan saved on this phone.'), tr('Delete plan'), true)) onReset(); }} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
        <Text maxFontSizeMultiplier={1.3} style={{ color: C.mute, fontSize: 14 }}>{tr('Start over with a new plan')}</Text>
      </Pressable>
    </View>
  </ScrollView>;
}

function Tasks({ plan, update, today }: { plan: LPPlan; update: (fn: (p: LPPlan) => LPPlan) => void; today: string }) {
  const [title, setTitle] = useState(''); const [showSug, setShowSug] = useState(false);
  const sorted = [...plan.tasks].sort((a, b) => Number(a.done) - Number(b.done) || (a.due || '9999').localeCompare(b.due || '9999'));
  const have = new Set(plan.tasks.map(t => t.title.toLowerCase()));
  const sugg = plan.suggestions.filter(s => !have.has(s.title.toLowerCase()));
  const toggle = (id: string) => update(p => ({ ...p, tasks: p.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t) }));
  const add = () => { const t = title.trim(); if (t.length < 1) return; update(p => ({ ...p, tasks: [...p.tasks, { id: uid(), title: t, done: false }] })); setTitle(''); };
  return <View style={{ marginTop: 8 }}>
    {sorted.map(t => { const late = !t.done && !!t.due && t.due < today; return <Pressable key={t.id} accessibilityRole="checkbox" accessibilityState={{ checked: t.done }} accessibilityLabel={t.title} onPress={() => toggle(t.id)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line, minHeight: 52 }}>
      <Check on={t.done} />
      <View style={{ flex: 1 }}>
        <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 15, color: t.done ? C.mute : C.ink, textDecorationLine: t.done ? 'line-through' : 'none' }}>{tr(t.title)}</Text>
        {t.due ? <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 12, color: late ? C.warn : C.mute, marginTop: 2 }}>{late ? `${tr('Overdue')} · ` : ''}{dateIN(t.due)}</Text> : null}
      </View>
    </Pressable>; })}
    <View style={{ marginTop: 16 }}>
      <Input label={tr('Add your own task')} value={title} onChangeText={setTitle} placeholder={tr('e.g. Book the band')} maxLength={120} returnKeyType="done" onSubmitEditing={add} />
      <Btn kind="quiet" title={tr('Add task')} onPress={add} disabled={!title.trim()} />
    </View>
    {sugg.length > 0 ? <View style={{ marginTop: 8 }}>
      <Btn kind="ghost" title={`${showSug ? tr('Hide') : tr('Show')} ${sugg.length} ${tr('suggested tasks')}`} onPress={() => setShowSug(!showSug)} />
      {showSug ? sugg.map(s => <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
        <View style={{ flex: 1 }}><Text maxFontSizeMultiplier={1.3} style={{ fontSize: 15, color: C.ink }}>{tr(s.title)}</Text><Text maxFontSizeMultiplier={1.3} style={{ fontSize: 12, color: C.mute, marginTop: 2 }}>{tr(s.phase)} · {dateIN(s.due)}</Text></View>
        <Btn small kind="quiet" title={tr('Add')} onPress={() => update(p => ({ ...p, tasks: [...p.tasks, { id: uid(), title: s.title, due: s.due, done: false }] }))} />
      </View>) : null}
    </View> : null}
  </View>;
}

function BudgetTab({ plan, update }: { plan: LPPlan; update: (fn: (p: LPPlan) => LPPlan) => void }) {
  const total = plan.wedding.budget_paise; const spent = plan.budget.reduce((n, b) => n + b.spent_paise, 0);
  const setSpent = (cat: string, v: string) => update(p => ({ ...p, budget: p.budget.map(b => b.category === cat ? { ...b, spent_paise: Math.round((+v.replace(/\D/g, '').slice(0, 10) || 0) * 100) } : b) }));
  return <View style={{ marginTop: 8 }}>
    <Card>
      <M>{tr('Total budget')}</M><Text maxFontSizeMultiplier={1.3} style={{ fontFamily: F.display, fontSize: 28, color: C.ink, marginTop: 2 }}>{inr(total)}</Text>
      <View style={{ flexDirection: 'row', gap: 24, marginTop: 8 }}>
        <View><M>{tr('Spent so far')}</M><Text maxFontSizeMultiplier={1.3} style={{ fontSize: 17, color: C.ink, fontWeight: '500' }}>{inr(spent)}</Text></View>
        <View><M>{tr('Left to spend')}</M><Text maxFontSizeMultiplier={1.3} style={{ fontSize: 17, color: total - spent < 0 ? C.warn : C.ok, fontWeight: '500' }}>{inr(total - spent)}</Text></View>
      </View>
    </Card>
    {plan.budget.map(b => <View key={b.category} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 15, color: C.ink, fontWeight: '500' }}>{tr(LABEL[b.category] || b.category)}</Text>
        <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 15, color: C.mute }}>{inr(b.allocated_paise)}</Text>
      </View>
      <Bar pct={b.allocated_paise ? (b.spent_paise / b.allocated_paise) * 100 : 0} color={b.spent_paise > b.allocated_paise ? C.warn : C.primary} />
      <Input label={tr('Spent so far')} prefix="₹" value={b.spent_paise ? String(b.spent_paise / 100) : ''} onChangeText={v => setSpent(b.category, v)} keyboardType="number-pad" placeholder="0" />
    </View>)}
  </View>;
}

function GuestsTab({ plan, update }: { plan: LPPlan; update: (fn: (p: LPPlan) => LPPlan) => void }) {
  const [name, setName] = useState(''); const [party, setParty] = useState(1);
  const invited = plan.guests.reduce((n, g) => n + g.party, 0);
  const add = () => { const n = name.trim(); if (!n) return; update(p => ({ ...p, guests: [...p.guests, { id: uid(), name: n, party }] })); setName(''); setParty(1); };
  return <View style={{ marginTop: 8 }}>
    <Card>
      <M>{tr('People on your list')}</M>
      <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: F.display, fontSize: 28, color: C.ink, marginTop: 2 }}>{invited} <Text style={{ fontSize: 15, color: C.mute }}>{tr('of about')} {plan.wedding.guests_est}</Text></Text>
    </Card>
    <Input label={tr('Guest or family name')} value={name} onChangeText={setName} autoCapitalize="words" maxLength={80} placeholder={tr('e.g. Sharma family')} returnKeyType="done" onSubmitEditing={add} />
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
      <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 15, color: C.ink, flex: 1 }}>{tr('People in this party')}: {party}</Text>
      <Btn small kind="quiet" title="−" onPress={() => setParty(Math.max(1, party - 1))} /><Btn small kind="quiet" title="+" onPress={() => setParty(Math.min(20, party + 1))} />
    </View>
    <Btn title={tr('Add to guest list')} onPress={add} disabled={!name.trim()} />
    {plan.guests.map(g => <View key={g.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line, gap: 12 }}>
      <View style={{ flex: 1 }}><Text maxFontSizeMultiplier={1.3} style={{ fontSize: 15, color: C.ink }}>{g.name}</Text><M>{g.party} {tr(g.party === 1 ? 'person' : 'people')}</M></View>
      <Btn small kind="ghost" title={tr('Remove')} onPress={() => update(p => ({ ...p, guests: p.guests.filter(x => x.id !== g.id) }))} />
    </View>)}
  </View>;
}
