export function readRuntimeConfig(env: Record<string, string | undefined> = process.env) {
  if (env.NODE_ENV === 'production') {
    throw new Error('Production startup is disabled: authentication uses a fixed demo OTP and payments are simulated. Implement and test real authentication, and disable or replace simulated payments before enabling production.');
  }
  if (env.SEED_DEMO_DATA !== undefined && !['true', 'false'].includes(env.SEED_DEMO_DATA)) {
    throw new Error('SEED_DEMO_DATA must be true or false.');
  }
  return { seedDemoData: env.SEED_DEMO_DATA !== 'false' };
}

import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';

// Version of the Terms and Privacy Policy a person agreed to; bump it whenever either text changes materially.
export const POLICY_VERSION = '2026-11-23';

// Admins come only from ADMIN_PHONES. There is no default admin: an unset variable means nobody is an admin.
// The test suite is the one exception so its fixtures keep a known admin.
export const adminPhones = (env: Record<string, string | undefined> = process.env) =>
  (env.ADMIN_PHONES ?? (env.NODE_ENV === 'test' ? '9999999999' : '')).split(',').map(s => s.trim()).filter(Boolean);

// A signing secret that survives restarts: JWT_SECRET if set, otherwise one generated once and kept in a 0600 file beside the database.
export function loadSecret(env: Record<string, string | undefined> = process.env) {
  if (env.JWT_SECRET) return env.JWT_SECRET;
  const dbPath = env.DB_PATH || 'shaadi.db';
  if (dbPath === ':memory:') return randomBytes(32).toString('hex');
  const file = join(dirname(dbPath), '.jwt-secret');
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  const secret = randomBytes(32).toString('hex');
  writeFileSync(file, secret, { mode: 0o600 }); try { chmodSync(file, 0o600); } catch { /* best effort */ }
  return secret;
}

// Browser origins allowed to call the API. Mobile apps send no Origin header and are always allowed.
export function corsOrigins(env: Record<string, string | undefined> = process.env) {
  const listed = (env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return (origin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) => {
    if (!origin || listed.includes(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
    cb(null, false);
  };
}
