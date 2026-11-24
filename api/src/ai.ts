// The in-app AI assistant. A small open model runs on this server (Ollama, bound to localhost); no outside AI service is used.
//   GET  /api/ai/status   is the assistant available right now?
//   POST /api/ai/chat     {mode, messages, context}: ask about the wedding, find vendors, draft a message, or get budget advice
// Design rules:
//  - Vendor search is plain database matching on what the person typed. The model never names vendors or prices, so it cannot invent them,
//    and scraped listing text is never given to the model (it could carry instructions).
//  - Conversations are not stored. The app keeps its own history on the phone; the server keeps only counts in memory.
//  - Off unless AI_ENABLED=1. If the model is down the app says so and every other feature keeps working.
import { z } from 'zod';
import { q } from './db.ts';

export type Msg = { role: 'user' | 'assistant'; content: string };
export type Provider = (messages: { role: string; content: string }[], opts: { maxTokens: number }) => Promise<string>;

const ollamaUrl = () => (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const model = () => process.env.AI_MODEL || 'llama3.2:3b';
const enabled = () => process.env.AI_ENABLED === '1';

const ollamaProvider: Provider = async (messages, { maxTokens }) => {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 110_000);
  try {
    const r = await fetch(ollamaUrl() + '/api/chat', {
      method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: model(), messages, stream: false, keep_alive: '30m', options: { num_predict: maxTokens, temperature: 0.5, num_ctx: 2048 } }),
    });
    if (!r.ok) throw new Error('model error ' + r.status);
    const j: any = await r.json();
    return String(j?.message?.content || '').trim();
  } finally { clearTimeout(timer); }
};
let provider: Provider = ollamaProvider;
/** Tests plug in a fake model here; pass null to restore the real one. */
export const setAiProvider = (p: Provider | null) => { provider = p || ollamaProvider; };

// ---- one answer at a time: a small model on a few CPU cores must not be flooded ----
let active = 0; const waiting: (() => void)[] = []; const MAX_QUEUE = 3;
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 1) {
    if (waiting.length >= MAX_QUEUE) throw Object.assign(new Error('The assistant is busy. Please try again in a minute.'), { status: 503 });
    await new Promise<void>(res => waiting.push(res));
  }
  active++;
  try { return await fn(); } finally { active--; waiting.shift()?.(); }
}

const hits = new Map<string, number[]>();
const limited = (ip: string, max: number) => { const now = Date.now(); const t = (hits.get(ip) || []).filter(x => now - x < 3600_000); if (t.length >= max) { hits.set(ip, t); return true; } hits.set(ip, [...t, now]); return false; };

// ---- vendor search from plain words ----
const CATEGORY_WORDS: [string, RegExp][] = [
  ['photographer', /\b(photo\w*|candid|cinematograph\w*|videograph\w*|wedding films?)\b/i],
  ['makeup', /\b(make-?up|mua|bridal beauty|hair and makeup)\b/i],
  ['mehndi', /\b(mehn?di|mehendi|henna)\b/i],
  ['decor', /\b(decor\w*|flowers?|floral|mandap|stage design)\b/i],
  ['venue', /\b(venues?|halls?|banquets?|lawns?|resorts?|farm ?house|palace)\b/i],
  ['caterer', /\b(cater\w*|food|buffet|menu)\b/i],
  ['dj', /\b(djs?|sangeet music|band|dhol)\b/i],
  ['pandit', /\b(pandit\w*|priest|purohit|pujari|officiant)\b/i],
];
const CITY_ALIASES: Record<string, string> = { bangalore: 'Bengaluru', bombay: 'Mumbai', madras: 'Chennai', calcutta: 'Kolkata', gurgaon: 'Gurugram', 'new delhi': 'Delhi' };
const KEEP = new Set(['photographer', 'makeup', 'mehndi', 'decor', 'venue', 'caterer', 'dj', 'pandit']);

/** "under 2 lakh", "below 1.5L", "within 50k", "up to ₹75,000", "budget 3 lakhs" -> paise, or null. */
export function parseBudgetPaise(text: string): number | null {
  const m = text.replace(/,/g, '').match(/(?:under|below|within|upto|up to|less than|max(?:imum)?|budget(?: of)?|around|about)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)\s*(crore|cr|lakhs?|lacs?|l|thousand|k)?\b/i)
    || text.replace(/,/g, '').match(/(?:₹|rs\.?\s*)(\d+(?:\.\d+)?)\s*(crore|cr|lakhs?|lacs?|l|thousand|k)?\b/i);
  if (!m) return null;
  const n = Number(m[1]); const u = (m[2] || '').toLowerCase();
  const rupees = /^(crore|cr)$/.test(u) ? n * 1e7 : /^(lakhs?|lacs?|l)$/.test(u) ? n * 1e5 : /^(thousand|k)$/.test(u) ? n * 1e3 : n;
  return rupees >= 1000 && rupees <= 1e10 ? Math.round(rupees * 100) : null;
}

export function parseVendorQuery(text: string, fallbackCity = '') {
  const lower = text.toLowerCase();
  const cities: string[] = q('SELECT DISTINCT city FROM vendors WHERE city IS NOT NULL AND city!=\'\'').map((r: any) => r.city);
  let city = '';
  for (const [alias, real] of Object.entries(CITY_ALIASES)) if (lower.includes(alias)) city = real;
  if (!city) city = cities.find(c => new RegExp(`\\b${c.toLowerCase()}\\b`).test(lower)) || '';
  if (!city && fallbackCity) city = cities.find(c => c.toLowerCase() === fallbackCity.toLowerCase()) || '';
  const category = CATEGORY_WORDS.find(([, re]) => re.test(text))?.[0] || '';
  const maxPaise = parseBudgetPaise(text);
  // Style words narrow the match a little (name or description), only words that are not part of the search itself.
  const style = (lower.match(/\b(candid|traditional|luxury|budget|destination|outdoor|vegetarian|jain|south indian|north indian|punjabi|bengali|marathi|gujarati|rajasthani|arabic|bridal)\b/g) || []).slice(0, 2);
  return { city, category: KEEP.has(category) ? category : '', maxPaise, style };
}

const looksLikeVendorSearch = (t: string) => /\b(find|show|suggest|recommend|looking for|need|search|any|best|who)\b/i.test(t) && CATEGORY_WORDS.some(([, re]) => re.test(t));

export function findVendors(parsed: ReturnType<typeof parseVendorQuery>, limit = 6) {
  const where: string[] = []; const args: any[] = [];
  if (parsed.city) { where.push('v.city=?'); args.push(parsed.city); }
  if (parsed.category) { where.push('v.category=?'); args.push(parsed.category); }
  // Most real listings do not show a price, so a budget keeps them and marks them "price not listed" instead of dropping them.
  if (parsed.maxPaise) { where.push('(v.start_paise IS NULL OR v.start_paise<=?)'); args.push(parsed.maxPaise); }
  for (const s of parsed.style) { where.push('(LOWER(v.name) LIKE ? OR LOWER(COALESCE(v.description,\'\')) LIKE ?)'); args.push(`%${s}%`, `%${s}%`); }
  if (!parsed.city && !parsed.category) return [];
  return q(`SELECT v.id,v.name,v.category,v.city,v.locality,v.start_paise,v.verified,v.unclaimed,v.sample,v.website,
    (SELECT url FROM vendor_photos p WHERE p.vendor_id=v.id ORDER BY p.id LIMIT 1) cover_url
    FROM vendors v WHERE ${where.join(' AND ')} ORDER BY v.sample ASC, v.unclaimed ASC, v.verified DESC, (v.start_paise IS NULL), v.id LIMIT ?`, ...args, limit);
}

// ---- prompts ----
const clean = (s: unknown, n = 160) => String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[<>]/g, '').trim().slice(0, n);
const CONTEXT = z.object({
  city: z.string().max(60).optional(), date: z.string().max(10).optional(), community: z.string().max(40).optional(), budget_paise: z.number().int().min(0).max(1e12).optional(),
  guests_est: z.number().int().min(0).max(100000).optional(), days_left: z.number().int().min(-3650).max(36500).optional(),
  tasks_done: z.number().int().min(0).max(1000).optional(), tasks_total: z.number().int().min(0).max(1000).optional(),
  overdue: z.array(z.string().max(120)).max(6).optional(), upcoming: z.array(z.string().max(120)).max(6).optional(),
  budget_rows: z.array(z.object({ category: z.string().max(30), allocated_paise: z.number().min(0).max(1e12), spent_paise: z.number().min(0).max(1e12).optional() })).max(12).optional(),
}).partial();
const rupees = (paise: number) => { const r = paise / 100; return r >= 1e7 ? `₹${+(r / 1e7).toFixed(2)} crore` : r >= 1e5 ? `₹${+(r / 1e5).toFixed(2)} lakh` : `₹${Math.round(r).toLocaleString('en-IN')}`; };

const SYSTEM = `You are the Taiji wedding assistant inside an app for Indian weddings. Help couples and families plan.
Rules:
- Answer in the same language the person writes in (English, Hindi, Marathi, Tamil, Telugu, Bengali, Gujarati, Punjabi, Kannada or Malayalam).
- Be warm, practical and brief: at most about 110 words, short paragraphs or a few bullets. Money in rupees.
- Stay on weddings, ceremonies, budgets, guests, vendors and using this app. If asked about something else, say you can only help with wedding planning.
- Never invent vendor names, prices, phone numbers or availability. For finding vendors, tell the person to describe what they need (for example "candid photographer in Pune under 2 lakh") and the app will search its directory.
- You cannot book, pay or contact anyone. Do not give legal, tax or medical advice; suggest a professional for those.
- Respect all communities and traditions. If unsure about a custom, say it varies by family and suggest asking an elder or the priest.`;

function contextBlock(c: z.infer<typeof CONTEXT>) {
  const L: string[] = [];
  if (c.city) L.push(`City: ${clean(c.city, 60)}`);
  if (c.date) L.push(`Wedding date: ${clean(c.date, 10)}${c.days_left != null ? ` (${c.days_left} days away)` : ''}`);
  if (c.community) L.push(`Tradition: ${clean(c.community, 40)}`);
  if (c.budget_paise) L.push(`Total budget: ${rupees(c.budget_paise)}`);
  if (c.guests_est) L.push(`Guests: about ${c.guests_est}`);
  if (c.tasks_total) L.push(`Checklist: ${c.tasks_done ?? 0} of ${c.tasks_total} done`);
  if (c.overdue?.length) L.push(`Overdue: ${c.overdue.map(t => clean(t, 80)).join('; ')}`);
  if (c.upcoming?.length) L.push(`Coming up: ${c.upcoming.map(t => clean(t, 80)).join('; ')}`);
  if (c.budget_rows?.length) L.push('Budget split: ' + c.budget_rows.map(r => `${clean(r.category, 30)} ${rupees(r.allocated_paise)}${r.spent_paise ? ` (spent ${rupees(r.spent_paise)})` : ''}`).join(', '));
  return L.length ? 'What the app knows about this wedding:\n' + L.join('\n') : 'The app has no wedding details yet.';
}

const DRAFTS: Record<string, string> = {
  vendor_enquiry: 'Write a short, polite WhatsApp or email enquiry from a couple to a wedding vendor. Include the wedding date, city and guest count if known, ask for availability and a quote, and leave one blank for the vendor name like [Vendor name]. Under 90 words.',
  invitation: 'Write a warm wedding invitation message that can be sent on WhatsApp. Include the date and city if known and leave blanks like [Venue] and [Time]. Under 90 words.',
  thanks: 'Write a short, heartfelt thank-you message to wedding guests, suitable for WhatsApp. Under 70 words.',
};

// ---- routes ----
const body = z.object({
  mode: z.enum(['ask', 'vendors', 'draft', 'budget']).default('ask'),
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(1000) })).min(1).max(8),
  context: CONTEXT.optional(),
  draft_kind: z.enum(['vendor_enquiry', 'invitation', 'thanks']).optional(),
  language: z.string().max(30).optional(),
});

export function mountAI(app: any, d: { wrap: any; fail: (s: number, m: string) => Error }) {
  app.get('/api/ai/status', d.wrap(async (_req: any, res: any) => {
    if (!enabled()) return res.json({ available: false, reason: 'off' });
    if (provider !== ollamaProvider) return res.json({ available: true });
    try { const r = await fetch(ollamaUrl() + '/api/tags', { signal: AbortSignal.timeout(2500) }); res.json({ available: r.ok }); } catch { res.json({ available: false, reason: 'down' }); }
  }));

  app.post('/api/ai/chat', d.wrap(async (req: any, res: any) => {
    if (!enabled()) throw d.fail(503, 'The assistant is not switched on yet.');
    if (limited(req.ip, 30)) throw d.fail(429, 'You have asked a lot of questions. Please try again in a while.');
    const b = body.parse(req.body); const ctx = b.context || {};
    const last = b.messages[b.messages.length - 1];
    if (last.role !== 'user') throw d.fail(400, 'The last message must be from you.');

    // Vendor search is database matching, not the model.
    if (b.mode === 'vendors' || (b.mode === 'ask' && looksLikeVendorSearch(last.content))) {
      const parsed = parseVendorQuery(last.content, ctx.city || '');
      const vendors = findVendors(parsed);
      if (vendors.length) {
        const bits = [parsed.category ? `${parsed.category}${vendors.length === 1 ? '' : 's'}` : 'vendors', parsed.city ? `in ${parsed.city}` : '', parsed.maxPaise ? `up to ${rupees(parsed.maxPaise)}` : ''].filter(Boolean).join(' ');
        const note = vendors.some((v: any) => !v.start_paise) ? ' Many listings do not show a price, so ask the vendor for a quote.' : '';
        return res.json({ reply: `Here are ${vendors.length} ${bits} from our directory.${note}`, vendors, parsed });
      }
      if (b.mode === 'vendors') {
        const missing = !parsed.category ? 'what kind of vendor you need (for example photographer, caterer, venue)' : !parsed.city ? 'which city' : null;
        return res.json({ reply: missing ? `Tell me ${missing}. For example: "candid photographer in Pune under 2 lakh".` : `I could not find ${parsed.category}s${parsed.city ? ' in ' + parsed.city : ''} yet. We are adding vendors city by city.`, vendors: [], parsed });
      }
    }

    const sys: { role: string; content: string }[] = [{ role: 'system', content: SYSTEM + '\n\n' + contextBlock(ctx) }];
    let history: Msg[] = b.messages.slice(-6);
    if (b.mode === 'draft') {
      const kind = b.draft_kind || 'vendor_enquiry';
      sys.push({ role: 'system', content: `${DRAFTS[kind]}${b.language ? ` Write it in ${clean(b.language, 30)}.` : ''} Output only the message text.` });
    } else if (b.mode === 'budget') {
      sys.push({ role: 'system', content: 'Review the budget split and checklist above. Give 4 to 5 concrete suggestions: where the split looks off for this city and guest count, what to book first, and what to watch. Use the rupee amounts given and invent no other numbers.' });
      history = [{ role: 'user', content: last.content }];
    }
    let reply: string;
    try { reply = await slot(() => provider([...sys, ...history], { maxTokens: b.mode === 'ask' ? 240 : 300 })); }
    catch (e: any) { if (e?.status) throw e; throw d.fail(503, 'The assistant could not answer right now. Your plan and the rest of the app still work.'); }
    if (!reply) throw d.fail(503, 'The assistant did not return an answer. Please try again.');
    res.json({ reply });
  }));
}
