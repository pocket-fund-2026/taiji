// Reporting, blocking and legal links: the trust-and-safety and consumer-rights features stores and Indian rules expect to find in the app.
import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { api, getBase } from './api';
import { tr } from './i18n';
import { Btn, C, Input, M, err, confirm } from './ui';

export const openLegal = (path: string) => Linking.openURL(getBase().replace(/\/$/, '') + path).catch(() => {});

// A link-styled row that opens one of the public pages (policy, grievance form, listing removal).
export function LegalLink({ path, label }: { path: string; label: string }) {
  return <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={() => openLegal(path)} hitSlop={6} style={{ minHeight: 36, justifyContent: 'center' }}>
    <Text maxFontSizeMultiplier={1.3} style={{ color: C.primary, fontSize: 14, textDecorationLine: 'underline' }}>{label}</Text></Pressable>;
}

// Report something (vendor, review, message, person). Opens a short reason box, then sends it to the admin inbox.
export function ReportBox({ kind, id, label }: { kind: 'vendor' | 'review' | 'message' | 'user'; id: number; label?: string }) {
  const [open, setOpen] = useState(false); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState('');
  const send = async () => { setBusy(true); try { const r = await api<any>('/reports', 'POST', { kind, target_id: id, reason: reason.trim() }); setDone(r.reference); setOpen(false); setReason(''); } catch (e) { err(e); } finally { setBusy(false); } };
  if (done) return <M style={{ marginTop: 4 }}>{tr('Thanks. We will review this. Reference')} {done}</M>;
  if (!open) return <Btn small kind="ghost" icon="flag" title={label || tr('Report')} onPress={() => setOpen(true)} />;
  return <View style={{ marginTop: 8 }}>
    <Input label={tr('What is wrong?')} value={reason} onChangeText={setReason} multiline maxLength={500} />
    <View style={{ flexDirection: 'row', gap: 8 }}><Btn small title={tr('Send report')} disabled={busy || reason.trim().length < 5} onPress={send} /><Btn small kind="quiet" title={tr('Cancel')} onPress={() => setOpen(false)} /></View>
  </View>;
}

// Block a person: neither side can message the other afterwards. Can be undone from the same screen.
export function BlockButton({ userId, onChange }: { userId: number; onChange?: () => void }) {
  const [blocked, setBlocked] = useState(false);
  const toggle = async () => {
    try {
      if (!blocked) { if (!(await confirm(tr('Block this person?'), tr('You will not be able to message each other. You can unblock them here.'), tr('Block'), true))) return; await api('/blocks', 'POST', { user_id: userId }); setBlocked(true); }
      else { await api('/blocks/' + userId, 'DELETE'); setBlocked(false); }
      onChange?.();
    } catch (e) { err(e); }
  };
  return <Btn small kind="ghost" icon="lock" title={blocked ? tr('Unblock') : tr('Block')} onPress={toggle} />;
}

// Shown once to accounts created before the current Terms and Privacy Policy version. Nothing else is reachable until they choose.
export function ConsentGate({ onAccepted, onLogout }: { onAccepted: () => void; onLogout: () => void }) {
  const [busy, setBusy] = useState(false);
  const accept = async () => { setBusy(true); try { await api('/consent/accept-terms', 'POST', {}); onAccepted(); } catch (e) { err(e); } finally { setBusy(false); } };
  return <View style={{ flex: 1, backgroundColor: C.bg, padding: 24, justifyContent: 'center' }}>
    <Text maxFontSizeMultiplier={1.3} accessibilityRole="header" style={{ fontSize: 26, lineHeight: 32, color: C.ink, fontWeight: '600' }}>{tr('We have updated our Terms and Privacy Policy')}</Text>
    <M style={{ marginTop: 12, lineHeight: 22 }}>{tr('Please read them and agree to keep using Shaadi OS. We use your name and mobile number to run your account, and you can export or delete your data any time from Profile.')}</M>
    <View style={{ flexDirection: 'row', gap: 20, marginVertical: 12 }}><LegalLink path="/terms" label={tr('Terms of Use')} /><LegalLink path="/privacy" label={tr('Privacy Policy')} /></View>
    <Btn title={busy ? tr('Please wait…') : tr('I agree')} disabled={busy} onPress={accept} />
    <Btn kind="quiet" title={tr('Log out instead')} onPress={onLogout} />
  </View>;
}
