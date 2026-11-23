// Email verification and email sign-in / sign-up (one-time codes). Phone sign-in is untouched and still switchable (MOCK_PHONE_LOGIN).
//   POST /api/me/email            (signed in) save an email address and send it a 6-digit code
//   POST /api/me/email/verify     (signed in) confirm the code; only verified addresses ever receive notifications
//   POST /api/auth/email-otp      ask for a sign-in or sign-up code (needs EMAIL_OTP_ENABLED=1 and mail configured)
//   POST /api/auth/email-verify   exchange the code for a session, or for a short-lived sign-up ticket when the email is new
//   POST /api/auth/email-signup   finish creating an account from that ticket (role, name, terms accepted)
// Codes: 6 digits, stored only as a salted hash, valid 10 minutes, single use, 5 wrong tries then dead.
// App Store review: REVIEW_EMAIL + REVIEW_OTP (6 digits) let one demo address sign in without any mail being sent. Never admin.
import { z } from 'zod';
import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { one, run } from './db.ts';
import { adminPhones, POLICY_VERSION } from './config.ts';
import { sendMail, mailConfigured, compose, normEmail, isEmail } from './mailer.ts';

const WINDOW = 10 * 60 * 1000;
const TICKET_TTL = 15 * 60 * 1000;
const hits = new Map<string, number[]>();
function limited(key: string, max: number, windowMs = WINDOW) {
  const now = Date.now(); const t = (hits.get(key) || []).filter(x => now - x < windowMs);
  if (t.length >= max) { hits.set(key, t); return true; }
  hits.set(key, [...t, now]); return false;
}

export function mountEmailAuth(app: any, d: { auth: any; wrap: any; fail: (s: number, m: string) => Error; secret: string; sign: (u: any) => string }) {
  const hash = (email: string, code: string) => createHash('sha256').update(`${email}:${code}:${d.secret}`).digest();
  const same = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);
  const sameText = (a: string, b: string) => same(Buffer.from(a), Buffer.from(b));
  const emailSchema = z.string().trim().max(254).refine(isEmail, 'Enter a valid email address').transform(normEmail);
  const profile = { role: z.enum(['couple', 'vendor']), name: z.string().trim().min(2, 'Enter your name').max(80), accept_terms: z.literal(true, { errorMap: () => ({ message: 'Please accept the Terms and Privacy Policy to create an account.' }) }) };

  // A sign-up ticket proves the holder just verified this email. HMAC-signed, expires in 15 minutes, useless once the account exists.
  const mac = (body: string) => createHmac('sha256', d.secret).update('email-signup:' + body).digest('base64url');
  const makeTicket = (email: string) => { const body = Buffer.from(JSON.stringify({ e: email, x: Date.now() + TICKET_TTL })).toString('base64url'); return `${body}.${mac(body)}`; };
  const readTicket = (t: string): string | null => {
    const [body, sig] = String(t).split('.'); if (!body || !sig || !sameText(sig, mac(body))) return null;
    try { const j = JSON.parse(Buffer.from(body, 'base64url').toString()); return typeof j.e === 'string' && j.x > Date.now() ? j.e : null; } catch { return null; }
  };

  const reviewEmail = () => normEmail(process.env.REVIEW_EMAIL || '');
  const reviewOtp = () => (/^\d{6}$/.test(process.env.REVIEW_OTP || '') ? String(process.env.REVIEW_OTP) : '');
  const isReview = (email: string) => !!reviewEmail() && !!reviewOtp() && email === reviewEmail();
  const loginEnabled = () => process.env.EMAIL_OTP_ENABLED === '1' && (mailConfigured() || (!!reviewEmail() && !!reviewOtp()));

  async function issue(userId: number, email: string, purpose: 'verify' | 'login') {
    run("UPDATE email_codes SET used=1 WHERE email=? AND purpose=? AND used=0", email, purpose);
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    run('INSERT INTO email_codes(email,user_id,purpose,code_hash,expires_at) VALUES(?,?,?,?,?)', email, userId, purpose, hash(email, code).toString('hex'), Date.now() + WINDOW);
    const subject = purpose === 'verify' ? 'Verify your email for Shaadi OS' : 'Your Shaadi OS sign-in code';
    const { text, html } = compose(subject, [`Your code is ${code}.`, 'It is valid for 10 minutes. If you did not ask for it, you can ignore this email.'], undefined, 'Never share this code. Shaadi OS will never ask you for it.');
    return sendMail({ to: email, subject, text, html, template: `otp-${purpose}` });
  }

  /** Checks a code and spends it. Every attempt counts, right or wrong. userId 0 = no account yet (sign-up). */
  function check(email: string, purpose: string, code: string, userId?: number) {
    const row = one("SELECT * FROM email_codes WHERE email=? AND purpose=? AND used=0 ORDER BY id DESC LIMIT 1", email, purpose);
    if (!row || row.expires_at < Date.now() || row.attempts >= 5 || (userId && row.user_id !== userId)) return null;
    run('UPDATE email_codes SET attempts=attempts+1 WHERE id=?', row.id);
    if (!/^\d{6}$/.test(code) || !same(hash(email, code), Buffer.from(row.code_hash, 'hex'))) return null;
    run('UPDATE email_codes SET used=1 WHERE id=?', row.id);
    return row;
  }

  const createUser = (email: string, p: { role: string; name: string }) => {
    if (one('SELECT 1 x FROM users WHERE email=? AND email_verified=1', email)) throw d.fail(409, 'An account with this email already exists. Sign in instead.');
    const id = Number(run('INSERT INTO users(phone,name,role,email,email_verified) VALUES(NULL,?,?,?,1)', p.name, p.role, email).lastInsertRowid);
    // A new account starts only after the person accepted the Terms and Privacy Policy; the acceptance is logged with its version.
    for (const purpose of ['terms', 'privacy_notice']) run('INSERT INTO consents(user_id,purpose,granted) VALUES(?,?,1)', id, `${purpose}:${POLICY_VERSION}`);
    return one('SELECT * FROM users WHERE id=?', id);
  };

  app.post('/api/me/email', d.auth, d.wrap(async (req: any, res: any) => {
    const { email } = z.object({ email: emailSchema }).parse(req.body);
    if (!mailConfigured()) throw d.fail(503, 'Email is not set up on this server yet.');
    if (limited(`set:${req.user.id}`, 5, 3600000)) throw d.fail(429, 'Too many attempts. Try again later.');
    if (one('SELECT 1 x FROM users WHERE email=? AND email_verified=1 AND id!=?', email, req.user.id)) throw d.fail(409, 'That email is already linked to another account.');
    run('UPDATE users SET email=?, email_verified=0 WHERE id=?', email, req.user.id);
    const r = await issue(req.user.id, email, 'verify');
    if (r.status === 'failed' || r.status === 'limited') throw d.fail(503, 'We could not send the code right now. Please try again shortly.');
    res.json({ ok: true });
  }));

  app.post('/api/me/email/verify', d.auth, d.wrap((req: any, res: any) => {
    const { code } = z.object({ code: z.string().trim().length(6) }).parse(req.body);
    const u = one('SELECT email FROM users WHERE id=?', req.user.id);
    if (!u?.email) throw d.fail(400, 'Add your email first.');
    if (!check(u.email, 'verify', code, req.user.id)) throw d.fail(400, 'That code is not right or has expired.');
    run('UPDATE users SET email_verified=1 WHERE id=?', req.user.id);
    res.json({ ok: true, email: u.email });
  }));

  app.post('/api/auth/email-otp', d.wrap(async (req: any, res: any) => {
    if (!loginEnabled()) throw d.fail(503, 'Email sign-in is not available.');
    const { email } = z.object({ email: emailSchema }).parse(req.body);
    if (limited(`otp:${email}`, 5) || limited(`otpip:${req.ip}`, 30)) throw d.fail(429, 'Too many codes requested. Try again in a few minutes.');
    if (isReview(email)) return res.json({ ok: true }); // demo address for App Review: no mail is sent
    if (!mailConfigured()) throw d.fail(503, 'Email sign-in is not available.');
    // Known and new addresses get the same answer; admins never sign in by email.
    const u = one('SELECT * FROM users WHERE email=? AND email_verified=1', email);
    if (!(u && adminPhones().includes(u.phone))) await issue(u ? u.id : 0, email, 'login');
    res.json({ ok: true });
  }));

  app.post('/api/auth/email-verify', d.wrap((req: any, res: any) => {
    if (!loginEnabled()) throw d.fail(503, 'Email sign-in is not available.');
    const b = z.object({ email: emailSchema, otp: z.string().trim().length(6), role: profile.role.optional(), name: profile.name.optional(), accept_terms: z.boolean().optional() }).parse(req.body);
    if (limited(`ver:${b.email}`, 10) || limited(`verip:${req.ip}`, 60)) throw d.fail(429, 'Too many attempts. Try again in a few minutes.');
    const bad = () => d.fail(401, 'That code is not right or has expired.');
    if (isReview(b.email)) { if (!sameText(b.otp, reviewOtp())) throw bad(); }
    else if (!check(b.email, 'login', b.otp)) throw bad();
    const u = one('SELECT * FROM users WHERE email=? AND email_verified=1', b.email);
    if (u) { if (adminPhones().includes(u.phone)) throw bad(); return res.json({ token: d.sign(u), user: u }); }
    // New email: create the account now if the profile came with the code, otherwise hand back a ticket to finish sign-up.
    if (b.role && b.name) {
      if (b.accept_terms !== true) throw d.fail(400, 'Please accept the Terms and Privacy Policy to create an account.');
      const created = createUser(b.email, { role: b.role, name: b.name }); return res.json({ token: d.sign(created), user: created });
    }
    res.json({ needsProfile: true, ticket: makeTicket(b.email) });
  }));

  app.post('/api/auth/email-signup', d.wrap((req: any, res: any) => {
    if (!loginEnabled()) throw d.fail(503, 'Email sign-in is not available.');
    const b = z.object({ ticket: z.string().min(20).max(600), ...profile }).parse(req.body);
    const email = readTicket(b.ticket);
    if (!email) throw d.fail(401, 'This sign-up link has expired. Please request a new code.');
    if (limited(`signup:${email}`, 5)) throw d.fail(429, 'Too many attempts. Try again in a few minutes.');
    const u = createUser(email, { role: b.role, name: b.name }); // 409 if the account already exists, so a ticket cannot be replayed to sign in
    res.json({ token: d.sign(u), user: u });
  }));
}
