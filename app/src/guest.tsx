// Screens for people who haven't signed in yet: the app is open to explore, and planning starts with an account.
import React, { useContext } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { LANGS, LangCtx, tr } from './i18n';
import { getBase } from './api';
import { Btn, C, Card, Chip, F, M } from './ui';
import { Icon, IconName } from './icons';
import { FloralArch } from './visuals';

const PLAN_PERKS: [IconName, string, string][] = [
  ['checklist', 'A checklist timed to your date', 'Tasks are spaced out from today to the wedding, with reminders on your phone.'],
  ['wallet', 'A budget split across services', 'See what each service should cost and what you have booked or paid.'],
  ['family', 'Guests and RSVPs per ceremony', 'Invite people to the haldi, sangeet or wedding separately and get headcounts.'],
  ['chat', 'Vendors, quotes and payments together', 'Ask several vendors at once, compare quotes, and pay in instalments.'],
];

// Plan tab before sign-in: what planning gives you, and one way in.
export function StartPlanning({ navigation }: any) {
  return <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
    <View style={{ backgroundColor: C.primary, padding: 24, paddingTop: 32, overflow: 'hidden' }}>
      <View pointerEvents="none" style={{ position: 'absolute', right: -30, bottom: -50, opacity: 0.3 }}><FloralArch size={160} color={C.goldSoft} /></View>
      <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: F.display, fontSize: 28, lineHeight: 34, color: C.goldSoft, maxWidth: 300 }}>{tr('Plan your wedding in one place')}</Text>
      <Text maxFontSizeMultiplier={1.3} style={{ color: '#F4DDE5', fontSize: 15, lineHeight: 22, marginTop: 8, maxWidth: 320 }}>{tr('Tell us your date, city and budget, and we set up your plan. Your family can join it too.')}</Text>
    </View>
    <View style={{ padding: 16, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
      <Card style={{ paddingVertical: 8 }}>{PLAN_PERKS.map(([icon, title, detail], i) => <View key={title} style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={20} color={C.primary} /></View>
        <View style={{ flex: 1 }}><Text maxFontSizeMultiplier={1.3} style={{ color: C.ink, fontSize: 15, fontWeight: '500' }}>{tr(title)}</Text><M style={{ marginTop: 2 }}>{tr(detail)}</M></View>
      </View>)}</Card>
      <Btn title={tr('Create a free account to start')} onPress={() => navigation.navigate('SignIn')} />
      <M style={{ textAlign: 'center', marginTop: 4 }}>{tr('Takes a minute: your mobile number, a code and your name.')}</M>
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('SignIn')} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
        <Text maxFontSizeMultiplier={1.3} style={{ color: C.primary, fontSize: 15, fontWeight: '500' }}>{tr('I already have an account · Sign in')}</Text>
      </Pressable>
    </View>
  </ScrollView>;
}

// My vendors before sign-in.
export function GuestVendors({ navigation }: any) {
  return <View style={{ flex: 1, backgroundColor: C.bg, padding: 24, justifyContent: 'center' }}>
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><Icon name="chat" size={26} color={C.primary} /></View>
      <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: F.display, fontSize: 20, color: C.ink, textAlign: 'center' }}>{tr('Your vendors will appear here')}</Text>
      <M style={{ textAlign: 'center', marginTop: 4, maxWidth: 300 }}>{tr('Sign in to send enquiries. Each vendor then stays here from first message to final payment.')}</M>
    </View>
    <Btn title={tr('Sign in or create an account')} onPress={() => navigation.navigate('SignIn')} />
    <Btn kind="ghost" title={tr('Find vendors')} onPress={() => navigation.navigate('Discover')} />
  </View>;
}

// Profile before sign-in: a way in, language, and the policies that apply to a visitor.
export function GuestProfile({ navigation }: any) {
  const { lang, setLang } = useContext(LangCtx);
  const open = (path: string) => Linking.openURL(getBase() + path).catch(() => {});
  return <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
    <View style={{ backgroundColor: C.primary, padding: 24, paddingTop: 32, overflow: 'hidden' }}>
      <View pointerEvents="none" style={{ position: 'absolute', right: -30, bottom: -50, opacity: 0.3 }}><FloralArch size={160} color={C.goldSoft} /></View>
      <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: F.display, fontSize: 28, lineHeight: 34, color: C.goldSoft, maxWidth: 300 }}>{tr('Welcome to Shaadi OS')}</Text>
      <Text maxFontSizeMultiplier={1.3} style={{ color: '#F4DDE5', fontSize: 15, lineHeight: 22, marginTop: 8, maxWidth: 320 }}>{tr('Sign in to plan your wedding, save vendors and send enquiries. Vendors sign in here too.')}</Text>
    </View>
    <View style={{ padding: 16, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
      <Btn title={tr('Sign in or create an account')} onPress={() => navigation.navigate('SignIn')} />
      <Btn kind="ghost" title={tr('Find vendors')} onPress={() => navigation.navigate('Discover')} />
      <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: F.display, fontSize: 18, color: C.ink, marginTop: 20, marginBottom: 8 }}>{tr('Language')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{LANGS.map(([code, name]) => <Chip key={code} label={name} on={lang === code} onPress={() => setLang(code)} />)}</View>
      <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: F.display, fontSize: 18, color: C.ink, marginTop: 20, marginBottom: 4 }}>{tr('Policies')}</Text>
      <Card style={{ paddingVertical: 4 }}>{[['/privacy', 'Privacy Policy'], ['/terms', 'Terms of Use'], ['/grievance', 'Raise a grievance']].map(([path, label], i) => <Pressable key={path} accessibilityRole="link" accessibilityLabel={tr(label)} onPress={() => open(path)} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
        <Text maxFontSizeMultiplier={1.3} style={{ color: C.ink, fontSize: 15 }}>{tr(label)}</Text><Icon name="chevron" size={16} color={C.mute} strokeWidth={2} />
      </Pressable>)}</Card>
    </View>
  </ScrollView>;
}
