// Email verification and email sign-in (one-time codes). Additive: phone sign-in is untouched.
//   POST /api/me/email            (signed in) save an email address and send it a 6-digit code
//   POST /api/me/email/verify     (signed in) confirm the code; only verified addresses ever receive notifications
//   POST /api/auth/email-otp      ask for a sign-in code (off unless EMAIL_OTP_ENABLED=1 and email is configured)
//   POST /api/auth/email-verify   exchange the code for a session
// Codes: 6 digits, stored only as a salted hash, valid 10 minutes, single use, 5 wrong tries then dead.
import { z } from 'zod';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { q, one, run } from './db.ts';
import { adminPhones } from './config.ts';
import { sendMail, mailConfigured, compose, normEmail, isEmail } from './mailer.ts';

const WINDOW = 10 * 60 * 1000;
const hits = new Map<string, number[]>();
function limited(key: string, max: number, windowMs = WINDOW) {
  const now = Date.now(); const t = (hits.get(key) || []).filter(x => now - x < windowMs);
  if (t.length >= max) { hits.set(key, t); return true; }
  hits.set(key, [...t, now]); return false;
}

export function mountEmailAuth(app: any, d: { auth: any; wrap: any; fail: (s: number, m: string) => Error; secret: string; sign: (u: any) => string }) {
  const hash = (email: string, code: string) => createHash('sha256').update(`${email}:${code}:${d.secret}`).digest();
  const same = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);
  const emailSchema = z.string().trim().max(254).refine(isEmail, 'Enter a valid email address').transform(normEmail);

  async function issue(user: any, email: string, purpose: 'verify' | 'login') {
    run("UPDATE email_codes SET used=1 WHERE email=? AND purpose=? AND used=0", email, purpose);
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    run('INSERT INTO email_codes(email,user_id,purpose,code_hash,expires_at) VALUES(?,?,?,?,?)', email, user.id, purpose, hash(email, code).toString('hex'), Date.now() + WINDOW);
    const subject = purpose === 'verify' ? 'Verify your email for Shaadi OS' : 'Your Shaadi OS sign-in code';
    const { text, html } = compose(subject, [`Your code is ${code}.`, 'It is valid for 10 minutes. If you did not ask for it, you can ignore this email.'], undefined, 'Never share this code. Shaadi OS will never ask you for it.');
    return sendMail({ to: email, subject, text, html, template: `otp-${purpose}` });
  }

  /** Checks a code and spends it. Every attempt counts, right or wrong. */
  function check(email: string, purpose: string, code: string, userId?: number) {
    const row = one("SELECT * FROM email_codes WHERE email=? AND purpose=? AND used=0 ORDER BY id DESC LIMIT 1", email, purpose);
    if (!row || row.expires_at < Date.now() || row.attempts >= 5 || (userId && row.user_id !== userId)) return null;
    run('UPDATE email_codes SET attempts=attempts+1 WHERE id=?', row.id);
    if (!/^\d{6}$/.test(code) || !same(hash(email, code), Buffer.from(row.code_hash, 'hex'))) return null;
    run('UPDATE email_codes SET used=1 WHERE id=?', row.id);
    return row;
  }

  app.post('/api/me/email', d.auth, d.wrap(async (req: any, res: any) => {
    const { email } = z.object({ email: emailSchema }).parse(req.body);
    if (!mailConfigured()) throw d.fail(503, 'Email is not set up on this server yet.');
    if (limited(`set:${req.user.id}`, 5, 3600000)) throw d.fail(429, 'Too many attempts. Try again later.');
    if (one('SELECT 1 x FROM users WHERE email=? AND email_verified=1 AND id!=?', email, req.user.id)) throw d.fail(409, 'That email is already linked to another account.');
    run('UPDATE users SET email=?, email_verified=0 WHERE id=?', email, req.user.id);
    const r = await issue({ id: req.user.id }, email, 'verify');
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

  const loginEnabled = () => process.env.EMAIL_OTP_ENABLED === '1' && mailConfigured();

  app.post('/api/auth/email-otp', d.wrap(async (req: any, res: any) => {
    if (!loginEnabled()) throw d.fail(503, 'Email sign-in is not available.');
    const { email } = z.object({ email: emailSchema }).parse(req.body);
    if (limited(`otp:${email}`, 5) || limited(`otpip:${req.ip}`, 30)) throw d.fail(429, 'Too many codes requested. Try again in a few minutes.');
    const u = one('SELECT * FROM users WHERE email=? AND email_verified=1', email);
    // Same answer whether or not the address is known, and admins never sign in by email.
    if (u && !adminPhones().includes(u.phone)) await issue(u, email, 'login');
    res.json({ ok: true });
  }));

  app.post('/api/auth/email-verify', d.wrap((req: any, res: any) => {
    if (!loginEnabled()) throw d.fail(503, 'Email sign-in is not available.');
    const b = z.object({ email: emailSchema, otp: z.string().trim().length(6) }).parse(req.body);
    if (limited(`ver:${b.email}`, 10) || limited(`verip:${req.ip}`, 60)) throw d.fail(429, 'Too many attempts. Try again in a few minutes.');
    const row = check(b.email, 'login', b.otp);
    const u = row && one('SELECT * FROM users WHERE id=? AND email=? AND email_verified=1', row.user_id, b.email);
    if (!u || adminPhones().includes(u.phone)) throw d.fail(401, 'That code is not right or has expired.');
    res.json({ token: d.sign(u), user: u });
  }));
}
