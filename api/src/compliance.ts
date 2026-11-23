// Consumer, intermediary and data-protection duties that need working features, not just policy text:
// listing removal/claim requests, grievances with an acknowledgement, abuse reports, blocking, and the admin inbox for all of them.
import { z } from 'zod';
import { db, q, one, run } from './db.ts';
import { adminPhones, POLICY_VERSION } from './config.ts';
import { notify, compose, isEmail } from './mailer.ts';

db.exec(`
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, actor INT, action TEXT, detail TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS listing_requests(id INTEGER PRIMARY KEY, vendor_id INT, kind TEXT NOT NULL, name TEXT NOT NULL, contact TEXT NOT NULL, message TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'open', resolution TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, resolved_at TEXT);
CREATE TABLE IF NOT EXISTS listing_suppressions(name TEXT NOT NULL, city TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(name, city));
CREATE TABLE IF NOT EXISTS grievances(id INTEGER PRIMARY KEY, user_id INT, name TEXT NOT NULL, contact TEXT NOT NULL, category TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', ack_at TEXT DEFAULT CURRENT_TIMESTAMP, created_at TEXT DEFAULT CURRENT_TIMESTAMP, resolution TEXT, resolved_at TEXT);
CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY, reporter_id INT NOT NULL, kind TEXT NOT NULL, target_id INT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', resolution TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, resolved_at TEXT);
CREATE TABLE IF NOT EXISTS blocks(blocker_id INT NOT NULL, blocked_id INT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(blocker_id, blocked_id));
`);

const fail = (status: number, message: string) => Object.assign(new Error(message), { status });
const contactRule = z.string().trim().min(5, 'Add a phone number or email so we can reply').max(120).refine(v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) || /^\+?[\d\s-]{10,15}$/.test(v), 'Enter a valid phone number or email');
export const isSuppressed = (name: string, city: string) => !!one('SELECT 1 x FROM listing_suppressions WHERE name=? AND city=?', name, city);
export const ref = (prefix: string, id: number) => `${prefix}-${String(id).padStart(6, '0')}`;
// Tell the grievance officer about a new submission, and acknowledge the sender when they gave an email address.
function mailIntake(kind: string, reference: string, b: any) {
  const officer = process.env.GRIEVANCE_OFFICER_EMAIL;
  if (isEmail(officer)) { const m = compose(`New ${kind} ${reference}`, [`From: ${b.name} (${b.contact})`, ...(b.category ? [`Category: ${b.category}`] : []), String(b.message || '').slice(0, 2000)], undefined, 'Internal notification from Shaadi OS.'); notify({ to: officer, subject: `[${reference}] New ${kind}`, text: m.text, html: m.html, template: `${kind.replace(' ', '-')}-officer` }); }
  if (isEmail(b.contact)) { const m = compose(`We received your ${kind}`, [`Your reference is ${reference}.`, 'We acknowledge every request within 48 hours and resolve grievances within one month.'], undefined, 'You are receiving this because you contacted Shaadi OS.'); notify({ to: b.contact, subject: `Shaadi OS: we received your ${kind} (${reference})`, text: m.text, html: m.html, template: `${kind.replace(' ', '-')}-ack` }); }
}

// Retention limits promised in the privacy policy: security and audit logs 180 days, resolved grievances three years, resolved reports and listing requests one year.
export function purgeExpired() {
  const gone = [
    run("DELETE FROM audit WHERE created_at < datetime('now','-180 days')"),
    run("DELETE FROM grievances WHERE status='resolved' AND resolved_at < datetime('now','-3 years')"),
    run("DELETE FROM reports WHERE status='resolved' AND resolved_at < datetime('now','-1 year')"),
    run("DELETE FROM listing_requests WHERE status='resolved' AND resolved_at < datetime('now','-1 year')"),
  ];
  return gone.reduce((n, r) => n + Number(r.changes), 0);
}

export function mountCompliance(app: any, auth: any, wrap: any, spamGuard: any) {
  const admin = (req: any, _r: any, next: any) => { const u = one('SELECT phone FROM users WHERE id=?', req.user.id); if (!adminPhones().includes(u?.phone)) return next(fail(403, 'Admins only')); next(); };
  const audit = (a: number, action: string, d: any) => run('INSERT INTO audit(actor,action,detail) VALUES(?,?,?)', a, action, JSON.stringify(d));

  // Existing accounts made before the current policy version are asked to accept it once; the acceptance is logged with its version.
  app.post('/api/consent/accept-terms', auth, wrap((req: any, res: any) => {
    for (const purpose of ['terms', 'privacy_notice']) run('INSERT INTO consents(user_id,purpose,granted) VALUES(?,?,1)', req.user.id, `${purpose}:${POLICY_VERSION}`);
    res.json({ ok: true, version: POLICY_VERSION });
  }));
  purgeExpired(); setInterval(purgeExpired, 24 * 3600 * 1000).unref();

  // Anyone, signed in or not, can ask for a listing to be removed, corrected or claimed. Requests are acknowledged at once and handled within 48 hours.
  app.post('/api/listing-requests', spamGuard(), wrap((req: any, res: any) => {
    const b = z.object({ vendor_id: z.coerce.number().int().positive().optional(), kind: z.enum(['remove', 'claim', 'correct']), name: z.string().trim().min(2).max(120), contact: contactRule, message: z.string().trim().max(1000).optional() }).parse(req.body);
    if (b.vendor_id && !one('SELECT 1 x FROM vendors WHERE id=?', b.vendor_id)) throw fail(404, 'That listing was not found');
    const r = run('INSERT INTO listing_requests(vendor_id,kind,name,contact,message) VALUES(?,?,?,?,?)', b.vendor_id ?? null, b.kind, b.name, b.contact, b.message || '');
    mailIntake('listing request', ref('L', Number(r.lastInsertRowid)), { ...b, category: b.kind });
    res.status(201).json({ ok: true, reference: ref('L', Number(r.lastInsertRowid)), note: 'We acknowledge every request within 48 hours.' });
  }));
  // Grievances (Consumer Protection E-Commerce Rules, IT Intermediary Rules): acknowledged on receipt, resolved within a month.
  app.post('/api/grievances', spamGuard(), wrap((req: any, res: any) => {
    const b = z.object({ name: z.string().trim().min(2).max(120), contact: contactRule, category: z.enum(['privacy', 'booking', 'payment', 'vendor', 'content', 'other']), message: z.string().trim().min(10, 'Tell us a little more').max(2000) }).parse(req.body);
    const r = run('INSERT INTO grievances(name,contact,category,message) VALUES(?,?,?,?)', b.name, b.contact, b.category, b.message);
    mailIntake('grievance', ref('G', Number(r.lastInsertRowid)), b);
    res.status(201).json({ ok: true, reference: ref('G', Number(r.lastInsertRowid)), note: 'We have received your grievance. We will acknowledge it within 48 hours and resolve it within one month.' });
  }));
  // Report and block: required for apps with user-generated content (chat, reviews, vendor profiles).
  app.post('/api/reports', auth, wrap((req: any, res: any) => {
    const b = z.object({ kind: z.enum(['vendor', 'review', 'message', 'user']), target_id: z.coerce.number().int().positive(), reason: z.string().trim().min(5, 'Say what is wrong').max(500) }).parse(req.body);
    const table: Record<string, string> = { vendor: 'vendors', review: 'reviews', message: 'messages', user: 'users' };
    if (!one(`SELECT 1 x FROM ${table[b.kind]} WHERE id=?`, b.target_id)) throw fail(404, 'Not found');
    const r = run('INSERT INTO reports(reporter_id,kind,target_id,reason) VALUES(?,?,?,?)', req.user.id, b.kind, b.target_id, b.reason);
    res.status(201).json({ ok: true, reference: ref('R', Number(r.lastInsertRowid)) });
  }));
  app.get('/api/blocks', auth, wrap((req: any, res: any) => res.json(q('SELECT b.blocked_id user_id, u.name FROM blocks b JOIN users u ON u.id=b.blocked_id WHERE b.blocker_id=?', req.user.id))));
  app.post('/api/blocks', auth, wrap((req: any, res: any) => {
    const { user_id } = z.object({ user_id: z.coerce.number().int().positive() }).parse(req.body);
    if (user_id === req.user.id) throw fail(400, 'You cannot block yourself');
    if (!one('SELECT 1 x FROM users WHERE id=?', user_id)) throw fail(404, 'Not found');
    run('INSERT OR IGNORE INTO blocks(blocker_id,blocked_id) VALUES(?,?)', req.user.id, user_id); res.json({ ok: true });
  }));
  app.delete('/api/blocks/:id', auth, wrap((req: any, res: any) => { run('DELETE FROM blocks WHERE blocker_id=? AND blocked_id=?', req.user.id, Number(req.params.id)); res.json({ ok: true }); }));

  // Admin inbox: one place for everything awaiting a human.
  app.get('/api/admin/inbox', auth, admin, wrap((_q: any, r: any) => r.json({
    listing_requests: q("SELECT l.*, v.name vendor_name, v.city vendor_city FROM listing_requests l LEFT JOIN vendors v ON v.id=l.vendor_id WHERE l.status='open' ORDER BY l.id"),
    grievances: q("SELECT * FROM grievances WHERE status='open' ORDER BY id"),
    reports: q("SELECT * FROM reports WHERE status='open' ORDER BY id"),
  })));
  app.post('/api/admin/listing-requests/:id/resolve', auth, admin, wrap((req: any, res: any) => {
    const b = z.object({ action: z.enum(['remove', 'close']), note: z.string().trim().min(3).max(500) }).parse(req.body);
    const l = one('SELECT * FROM listing_requests WHERE id=?', req.params.id); if (!l) throw fail(404, 'Not found'); if (l.status !== 'open') throw fail(409, 'Already resolved');
    if (b.action === 'remove') {
      const v = l.vendor_id ? one('SELECT * FROM vendors WHERE id=?', l.vendor_id) : null;
      if (!v) throw fail(400, 'This request names no listing to remove');
      if (!v.unclaimed) throw fail(409, 'Only unclaimed listings can be removed this way; the owner manages their own storefront');
      // Remember the removal so a future import of the same list does not bring the business back.
      run('INSERT OR IGNORE INTO listing_suppressions(name,city) VALUES(?,?)', v.name, v.city);
      run('DELETE FROM vendor_photos WHERE vendor_id=?', v.id); run('DELETE FROM vendor_packages WHERE vendor_id=?', v.id); run('DELETE FROM vendors WHERE id=?', v.id);
    }
    run("UPDATE listing_requests SET status='resolved', resolution=?, resolved_at=datetime('now') WHERE id=?", `${b.action}: ${b.note}`, l.id);
    audit(req.user.id, 'listing_request_' + b.action, { id: l.id, vendor_id: l.vendor_id }); res.json({ ok: true });
  }));
  app.post('/api/admin/grievances/:id/resolve', auth, admin, wrap((req: any, res: any) => {
    const { resolution } = z.object({ resolution: z.string().trim().min(3).max(1000) }).parse(req.body);
    const g = one('SELECT * FROM grievances WHERE id=?', req.params.id); if (!g) throw fail(404, 'Not found'); if (g.status !== 'open') throw fail(409, 'Already resolved');
    run("UPDATE grievances SET status='resolved', resolution=?, resolved_at=datetime('now') WHERE id=?", resolution, g.id); audit(req.user.id, 'resolve_grievance', { id: g.id }); res.json({ ok: true });
  }));
  app.post('/api/admin/reports/:id/resolve', auth, admin, wrap((req: any, res: any) => {
    const { resolution } = z.object({ resolution: z.string().trim().min(3).max(500) }).parse(req.body);
    const r = one('SELECT * FROM reports WHERE id=?', req.params.id); if (!r) throw fail(404, 'Not found'); if (r.status !== 'open') throw fail(409, 'Already resolved');
    run("UPDATE reports SET status='resolved', resolution=?, resolved_at=datetime('now') WHERE id=?", resolution, r.id); audit(req.user.id, 'resolve_report', { id: r.id }); res.json({ ok: true });
  }));
}
