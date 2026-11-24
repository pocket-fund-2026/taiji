// "Ask": the in-app AI assistant. A small open model runs on our own server; vendor search is plain database matching, so
// vendors shown here are always real listings. Chat history is kept on this phone only. Works for signed-out people too.
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { LangCtx, tr } from './i18n';
import { Btn, C, Card, Chip, F, Input, M, inr } from './ui';
import { Icon } from './icons';
import { getLocalPlan } from './localplan';
import { categoryLabel } from './marketplace';

type Vendor = { id: number; name: string; category: string; city: string; locality?: string; start_paise?: number | null; unclaimed?: number; sample?: number };
type Turn = { id: string; role: 'user' | 'assistant'; content: string; vendors?: Vendor[]; error?: boolean };
const KEY = 'assistant_chat';
const LANG_NAME: Record<string, string> = { en: 'English', hi: 'Hindi', mr: 'Marathi', ta: 'Tamil', te: 'Telugu', bn: 'Bengali', gu: 'Gujarati', pa: 'Punjabi', kn: 'Kannada', ml: 'Malayalam' };
const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);

async function loadChat(): Promise<Turn[]> { try { const v = await AsyncStorage.getItem(KEY); return v ? JSON.parse(v) : []; } catch { return []; } }
const saveChat = (t: Turn[]) => { AsyncStorage.setItem(KEY, JSON.stringify(t.slice(-30))).catch(() => {}); };

// What the assistant is told about this wedding. It comes from the plan on this phone, or from the account when signed in.
async function buildContext(): Promise<Record<string, unknown>> {
  try {
    const lp = await getLocalPlan();
    if (lp) {
      const t = today(); const open = lp.tasks.filter(x => !x.done);
      return {
        city: lp.wedding.city, date: lp.wedding.date, community: lp.wedding.community, guests_est: lp.wedding.guests_est, budget_paise: lp.wedding.budget_paise,
        days_left: Math.ceil((new Date(lp.wedding.date + 'T00:00:00').getTime() - Date.now()) / 86400000),
        tasks_done: lp.tasks.length - open.length, tasks_total: lp.tasks.length,
        overdue: open.filter(x => x.due && x.due < t).slice(0, 5).map(x => x.title),
        upcoming: open.filter(x => !x.due || x.due >= t).sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).slice(0, 5).map(x => x.title),
        budget_rows: lp.budget.map(b => ({ category: b.category, allocated_paise: b.allocated_paise, spent_paise: b.spent_paise })),
      };
    }
    const me: any = await api('/me'); const w = me?.wedding; if (!w) return {};
    const tasks: any[] = await api('/tasks').catch(() => []); const t = today(); const open = tasks.filter(x => !x.done);
    return {
      city: w.city, date: w.date, community: w.community, guests_est: w.guests_est, budget_paise: w.budget_paise,
      days_left: Math.ceil((new Date(w.date + 'T00:00:00').getTime() - Date.now()) / 86400000),
      tasks_done: tasks.length - open.length, tasks_total: tasks.length,
      overdue: open.filter(x => x.due && x.due < t).slice(0, 5).map(x => x.title),
      upcoming: open.filter(x => !x.due || x.due >= t).slice(0, 5).map(x => x.title),
    };
  } catch { return {}; }
}

export function Assistant({ navigation }: any) {
  const { lang } = useContext(LangCtx); const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<'checking' | 'ready' | 'off'>('checking');
  const [turns, setTurns] = useState<Turn[]>([]); const [text, setText] = useState(''); const [busy, setBusy] = useState(false);
  const [vendorMode, setVendorMode] = useState(false); const [showDrafts, setShowDrafts] = useState(false);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => { loadChat().then(setTurns); api<any>('/ai/status').then(s => setStatus(s?.available ? 'ready' : 'off')).catch(() => setStatus('off')); }, []);
  useEffect(() => { setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60); }, [turns.length, busy]);

  const send = useCallback(async (opts: { content: string; mode?: 'ask' | 'vendors' | 'draft' | 'budget'; draft_kind?: string }) => {
    const content = opts.content.trim(); if (!content || busy) return;
    const next: Turn[] = [...turns, { id: uid(), role: 'user', content }]; setTurns(next); saveChat(next); setText(''); setBusy(true); setVendorMode(false); setShowDrafts(false);
    try {
      const context = await buildContext();
      // Only the plain text of recent turns goes to the server; it is not stored there.
      const messages = next.filter(t => !t.error).slice(-6).map(t => ({ role: t.role, content: t.content.slice(0, 1000) }));
      const r: any = await api('/ai/chat', 'POST', { mode: opts.mode || 'ask', messages, context, draft_kind: opts.draft_kind, language: LANG_NAME[lang] || 'English' });
      const done: Turn[] = [...next, { id: uid(), role: 'assistant', content: r.reply, vendors: r.vendors }]; setTurns(done); saveChat(done);
    } catch (e: any) {
      const msg = /lost|abort|timed/i.test(e?.message || '') ? tr('That took too long. Please try again.') : (e?.message || tr('The assistant could not answer right now.'));
      setTurns([...next, { id: uid(), role: 'assistant', content: msg, error: true }]);
    } finally { setBusy(false); }
  }, [turns, busy, lang]);

  const clear = () => { setTurns([]); saveChat([]); };
  const draftKinds: [string, string][] = [['vendor_enquiry', 'Message to a vendor'], ['invitation', 'Invitation'], ['thanks', 'Thank-you note']];

  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={{ backgroundColor: C.primary, paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(232,200,119,0.2)', alignItems: 'center', justifyContent: 'center' }}><Icon name="star" size={22} color={C.goldSoft} /></View>
      <View style={{ flex: 1 }}>
        <Text maxFontSizeMultiplier={1.3} accessibilityRole="header" style={{ fontFamily: F.display, fontSize: 22, color: C.goldSoft }}>{tr('Ask Taiji')}</Text>
        <Text maxFontSizeMultiplier={1.3} style={{ color: '#F4DDE5', fontSize: 13 }}>{tr('Wedding help in your language')}</Text>
      </View>
      {turns.length > 0 ? <Pressable accessibilityRole="button" onPress={clear} hitSlop={10}><Text maxFontSizeMultiplier={1.3} style={{ color: C.goldSoft, fontSize: 13 }}>{tr('Clear')}</Text></Pressable> : null}
    </View>

    {status === 'off' ? <View style={{ padding: 24 }}><Card>
      <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: F.display, fontSize: 18, color: C.ink }}>{tr('The assistant is resting')}</Text>
      <M style={{ marginTop: 6 }}>{tr('It needs an internet connection and is not available right now. Your plan, checklist and vendor search still work.')}</M>
      <Btn kind="quiet" title={tr('Try again')} onPress={() => { setStatus('checking'); api<any>('/ai/status').then(s => setStatus(s?.available ? 'ready' : 'off')).catch(() => setStatus('off')); }} />
    </Card></View> : <>
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 8, width: '100%', maxWidth: 640, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        {turns.length === 0 ? <View>
          <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: F.display, fontSize: 20, color: C.ink, marginBottom: 6 }}>{tr('How can I help?')}</Text>
          <M>{tr('Ask about your checklist, budget or ceremonies, find vendors by describing them, or get a message written for you.')}</M>
        </View> : null}
        {turns.map(t => <View key={t.id} style={{ marginTop: 12, alignItems: t.role === 'user' ? 'flex-end' : 'flex-start' }}>
          <View style={{ maxWidth: '88%', borderRadius: 16, padding: 12, backgroundColor: t.role === 'user' ? C.primary : t.error ? C.warnSoft : C.card, borderWidth: t.role === 'user' ? 0 : 1, borderColor: C.line }}>
            <Text selectable maxFontSizeMultiplier={1.3} style={{ fontSize: 15, lineHeight: 22, color: t.role === 'user' ? '#FFFEFC' : t.error ? C.warn : C.ink }}>{t.content}</Text>
          </View>
          {t.vendors?.length ? <View style={{ width: '100%', marginTop: 8, gap: 8 }}>{t.vendors.map(v => <Pressable key={v.id} accessibilityRole="button" accessibilityLabel={v.name} onPress={() => navigation.navigate('Vendor', { id: v.id })}
            style={({ pressed }) => ({ backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14, opacity: pressed ? 0.8 : 1 })}>
            <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: F.display, fontSize: 16, color: C.ink }}>{v.name}</Text>
            <M style={{ marginTop: 2 }}>{categoryLabel(v.category)} · {v.locality ? v.locality + ', ' : ''}{v.city}</M>
            <M style={{ marginTop: 2, color: v.start_paise ? C.ink : C.mute }}>{v.start_paise ? `${tr('From')} ${inr(v.start_paise)}` : tr('Ask for a quote')}{v.unclaimed ? ` · ${tr('Not on Shaadi OS yet')}` : ''}</M>
          </Pressable>)}</View> : null}
        </View>)}
        {busy ? <View style={{ marginTop: 12, alignItems: 'flex-start' }}><View style={{ borderRadius: 16, padding: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line }}>
          <Text maxFontSizeMultiplier={1.3} style={{ color: C.mute, fontSize: 15 }}>{tr('Thinking…')}</Text><M style={{ marginTop: 2, fontSize: 12 }}>{tr('This can take up to a minute.')}</M></View></View> : null}
      </ScrollView>

      <View style={{ borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
        {showDrafts ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }}>{draftKinds.map(([k, l]) => <Chip key={k} label={tr(l)} on={false} onPress={() => send({ content: `${tr('Write a')} ${tr(l).toLowerCase()}`, mode: 'draft', draft_kind: k })} />)}</View> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }} contentContainerStyle={{ paddingRight: 8 }}>
          <Chip label={tr('What should I do first?')} on={false} onPress={() => send({ content: tr('What should I do first?') })} />
          <Chip label={tr('Find vendors')} on={vendorMode} onPress={() => { setVendorMode(!vendorMode); setShowDrafts(false); }} />
          <Chip label={tr('Write a message')} on={showDrafts} onPress={() => { setShowDrafts(!showDrafts); setVendorMode(false); }} />
          <Chip label={tr('Review my budget')} on={false} onPress={() => send({ content: tr('Review my budget and checklist'), mode: 'budget' })} />
        </ScrollView>
        <Input value={text} onChangeText={setText} placeholder={vendorMode ? tr('e.g. candid photographer in Pune under 2 lakh') : tr('Ask anything about your wedding')} maxLength={500} returnKeyType="send" editable={!busy}
          onSubmitEditing={() => send({ content: text, mode: vendorMode ? 'vendors' : 'ask' })} />
        <Btn title={busy ? tr('Thinking…') : tr('Send')} disabled={busy || !text.trim()} onPress={() => send({ content: text, mode: vendorMode ? 'vendors' : 'ask' })} />
        <M style={{ fontSize: 11, textAlign: 'center' }}>{tr('AI answers can be wrong. Check important details. Built with Llama.')}</M>
      </View>
    </>}
  </KeyboardAvoidingView>;
}
