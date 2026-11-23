import AsyncStorage from '@react-native-async-storage/async-storage';
// What the person told us during onboarding. Kept on the phone only; it shapes Discover and nothing is sent anywhere.
export type Prefs = { role?: 'couple' | 'vendor' | 'browse'; city?: string; services?: string[]; timeline?: string };
export const getPrefs = async (): Promise<Prefs | null> => { try { const v = await AsyncStorage.getItem('prefs'); return v ? JSON.parse(v) : null; } catch { return null; } };
export const setPrefs = async (p: Prefs) => { try { await AsyncStorage.setItem('prefs', JSON.stringify(p)); } catch { /* storage unavailable: the app still works */ } };
export const hasOnboarded = async () => { try { return (await AsyncStorage.getItem('onboarded')) === '1'; } catch { return true; } };
export const markOnboarded = async () => { try { await AsyncStorage.setItem('onboarded', '1'); } catch { /* ignore */ } };
