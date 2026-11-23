// Outbound email for Shaadi OS. Safe by default: with no SMTP settings it sends nothing and nothing breaks.
// Settings (all read at send time, so they can be added later without code changes):
//   SMTP_HOST, SMTP_PORT (587), SMTP_SECURE ("true" for port 465), SMTP_USER, SMTP_PASS, MAIL_FROM ("Shaadi OS <no-reply@example.com>")
// Message bodies are never stored (they can hold one-time codes); only recipient, subject, template and outcome are logged.
import nodemailer from 'nodemailer';
import { db, q, one, run } from './db.ts';

db.exec(`
CREATE TABLE IF NOT EXISTS email_outbox(id INTEGER PRIMARY KEY, to_addr TEXT NOT NULL, subject TEXT NOT NULL, template TEXT, status TEXT NOT NULL DEFAULT 'queued', error TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, sent_at TEXT);
CREATE TABLE IF NOT EXISTS email_codes(id INTEGER PRIMARY KEY, email TEXT NOT NULL, user_id INT NOT NULL, purpose TEXT NOT NULL, code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, attempts INT NOT NULL DEFAULT 0, used INT NOT NULL DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);
for (const [table, column, type] of [['users', 'email', 'TEXT'], ['users', 'email_verified', 'INT DEFAULT 0'], ['guests', 'email', 'TEXT'], ['guests', 'email_invited_at', 'TEXT']]) {
  if (!q(`PRAGMA table_info(${table})`).some((c: any) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}
run("DELETE FROM email_outbox WHERE created_at < datetime('now','-90 days')");
run("DELETE FROM email_codes WHERE created_at < datetime('now','-1 day')");

export const isEmail = (s: unknown): s is string => typeof s === 'string' && s.length <= 254 && /^[^@\s,;<>]+@[^@\s,;<>]+\.[^@\s,;<>]{2,}$/.test(s.trim());
export const normEmail = (s: string) => s.trim().toLowerCase();
const clean = (s: string, max = 150) => String(s).replace(/[\r\n]+/g, ' ').trim().slice(0, max);
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
export const siteUrl = () => (process.env.SITE_URL || 'https://46-225-26-58.sslip.io').replace(/\/$/, '');
export const rupees = (paise: number) => '₹' + (Number(paise || 0) / 100).toLocaleString('en-IN');

let override: any = null;
/** Tests inject a fake transport here. Pass null to restore the real one. */
export const setTransport = (t: any) => { override = t; };
export const mailConfigured = () => !!override || !!(process.env.SMTP_HOST && process.env.MAIL_FROM);

let cached: { key: string; t: any } | null = null;
function transport() {
  if (override) return override;
  const e = process.env; const key = [e.SMTP_HOST, e.SMTP_PORT, e.SMTP_SECURE, e.SMTP_USER].join('|');
  if (!cached || cached.key !== key) {
    cached = { key, t: nodemailer.createTransport({ host: e.SMTP_HOST, port: Number(e.SMTP_PORT) || 587, secure: e.SMTP_SECURE === 'true', auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASS } : undefined, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000 }) };
  }
  return cached.t;
}

export type Mail = { to: string; subject: string; text: string; html?: string; template: string };
export type MailResult = { status: 'sent' | 'skipped' | 'invalid' | 'limited' | 'failed' };

/** Never throws. Per-recipient cap (8 an hour) stops the app being used to flood someone's inbox. */
export async function sendMail(m: Mail): Promise<MailResult> {
  const to = normEmail(String(m.to || ''));
  if (!isEmail(to)) return { status: 'invalid' };
  if (!mailConfigured()) return { status: 'skipped' };
  if (one("SELECT COUNT(*) n FROM email_outbox WHERE to_addr=? AND status IN ('sent','queued') AND created_at > datetime('now','-1 hour')", to).n >= 8) return { status: 'limited' };
  const subject = clean(m.subject);
  const id = Number(run('INSERT INTO email_outbox(to_addr,subject,template) VALUES(?,?,?)', to, subject, m.template).lastInsertRowid);
  try {
    await transport().sendMail({ from: process.env.MAIL_FROM, to, subject, text: m.text, html: m.html });
    run("UPDATE email_outbox SET status='sent', sent_at=datetime('now') WHERE id=?", id);
    return { status: 'sent' };
  } catch (e: any) {
    run("UPDATE email_outbox SET status='failed', error=? WHERE id=?", clean(e?.message || 'send failed', 200), id);
    console.warn('email failed:', m.template, clean(e?.message || '', 120));
    return { status: 'failed' };
  }
}
/** Fire and forget: a mail problem must never fail the request that triggered it. */
export const notify = (m: Mail) => { void sendMail(m).catch(() => {}); };

/** Builds the plain-text and HTML bodies from short paragraphs and an optional button. */
export function compose(heading: string, lines: string[], cta?: { label: string; url: string }, footer = 'You are receiving this because of activity on your Shaadi OS account.') {
  const text = [heading, '', ...lines, ...(cta ? ['', `${cta.label}: ${cta.url}`] : []), '', '--', footer].join('\n');
  const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#222"><h2 style="color:#8B1E3F;margin:0 0 16px">${esc(heading)}</h2>${lines.map(l => `<p style="line-height:1.5">${esc(l)}</p>`).join('')}${cta ? `<p style="margin:24px 0"><a href="${esc(cta.url)}" style="background:#8B1E3F;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">${esc(cta.label)}</a></p>` : ''}<hr style="border:none;border-top:1px solid #eee;margin:24px 0"><p style="font-size:12px;color:#777">${esc(footer)}</p></div>`;
  return { text, html };
}

/** Email an account holder, but only at an address they have verified. */
export function mailUser(userId: number | null | undefined, template: string, subject: string, lines: string[], cta?: { label: string; url: string }) {
  if (!userId) return;
  const u = one('SELECT email, email_verified FROM users WHERE id=?', userId);
  if (!u || !u.email || !u.email_verified) return;
  const { text, html } = compose(subject, lines, cta);
  notify({ to: u.email, subject, text, html, template });
}
