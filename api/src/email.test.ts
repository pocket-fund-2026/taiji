import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'local-test-secret';
delete process.env.SMTP_HOST; delete process.env.MAIL_FROM; delete process.env.EMAIL_OTP_ENABLED; delete process.env.GRIEVANCE_OFFICER_EMAIL;
const { app } = await import('./server.ts');
const { db, one } = await import('./db.ts');
const { setTransport, mailConfigured } = await import('./mailer.ts');

const server = http.createServer(app as any);
await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${(server.address() as any).port}`;
async function request(path: string, token = '', method = 'GET', body?: unknown): Promise<{ status: number; data: any }> {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let data: any; try { data = JSON.parse(text); } catch { data = text; } return { status: r.status, data };
}
const login = async (phone: string, role = 'couple') => { const r = await request('/api/auth/verify', '', 'POST', { phone, otp: '123456', role, name: 'Test ' + role, accept_terms: true }); assert.equal(r.status, 200); return r.data.token as string; };
const sent: any[] = [];
const fake = { sendMail: async (m: any) => { sent.push(m); } };
const codeIn = (m: any) => (m.text.match(/code is (\d{6})/) || [])[1] as string;
const wait = () => new Promise(r => setTimeout(r, 30));

let couple: string; let vendor: string;
before(async () => { couple = await login('9812400001'); vendor = await login('9000000001', 'vendor'); });
after(() => { setTransport(null); server.closeAllConnections(); server.close(); db.close(); });

test('with no mail settings nothing is sent and nothing breaks', async () => {
  assert.equal(mailConfigured(), false);
  const g = await request('/api/grievances', '', 'POST', { name: 'Asha', contact: 'asha@example.com', category: 'booking', message: 'The vendor did not reply for a week' });
  assert.equal(g.status, 201);
  assert.equal((await request('/api/me/email', couple, 'POST', { email: 'c@example.com' })).status, 503);
  assert.equal((await request('/api/auth/email-otp', '', 'POST', { email: 'c@example.com' })).status, 503);
  assert.equal(one('SELECT COUNT(*) n FROM email_outbox').n, 0);
});

test('grievances and listing requests notify the officer and acknowledge the sender', async () => {
  setTransport(fake); process.env.GRIEVANCE_OFFICER_EMAIL = 'officer@example.com'; sent.length = 0;
  const g = await request('/api/grievances', '', 'POST', { name: 'Asha', contact: 'asha@example.com', category: 'booking', message: 'The vendor did not reply for a week' });
  assert.equal(g.status, 201); await wait();
  assert.deepEqual(sent.map(m => m.to).sort(), ['asha@example.com', 'officer@example.com']);
  assert.ok(sent.every(m => m.subject.includes(g.data.reference) || m.subject.includes('received')));
  sent.length = 0;
  await request('/api/grievances', '', 'POST', { name: 'Ravi', contact: '9812300555', category: 'other', message: 'A phone-only complaint here' }); await wait();
  assert.deepEqual(sent.map(m => m.to), ['officer@example.com'], 'a phone contact gets no acknowledgement email');
});

test('email must be verified before it receives anything, and codes are single use with limited tries', async () => {
  setTransport(fake); sent.length = 0;
  assert.equal((await request('/api/me/email', couple, 'POST', { email: 'not-an-email' })).status, 400);
  assert.equal((await request('/api/me/email', couple, 'POST', { email: 'Couple@Example.com' })).status, 200); await wait();
  assert.equal(sent.length, 1); const code = codeIn(sent[0]); assert.match(code, /^\d{6}$/);
  assert.equal(one("SELECT email, email_verified FROM users WHERE phone='9812400001'").email, 'couple@example.com');
  // unverified: a vendor enquiry from this couple must not be emailed to anyone else, and the couple gets no mail yet
  assert.equal((await request('/api/me/email/verify', couple, 'POST', { code: code === '000000' ? '111111' : '000000' })).status, 400);
  assert.equal((await request('/api/me/email/verify', couple, 'POST', { code })).status, 200);
  assert.equal((await request('/api/me/email/verify', couple, 'POST', { code })).status, 400, 'code cannot be reused');
  assert.equal(one("SELECT email_verified v FROM users WHERE phone='9812400001'").v, 1);
  // five wrong tries burn a fresh code
  await request('/api/me/email', couple, 'POST', { email: 'couple@example.com' }); await wait(); const fresh = codeIn(sent[sent.length - 1]);
  for (let i = 0; i < 5; i++) await request('/api/me/email/verify', couple, 'POST', { code: '999999' === fresh ? '888888' : '999999' });
  assert.equal((await request('/api/me/email/verify', couple, 'POST', { code: fresh })).status, 400, 'code is dead after 5 wrong tries');
  assert.equal(JSON.stringify(sent).includes('local-test-secret'), false);
});

test('enquiries, quotes and bookings email only verified account holders', async () => {
  setTransport(fake);
  one("SELECT 1"); db.prepare("UPDATE users SET email='couple@example.com', email_verified=1 WHERE phone='9812400001'").run();
  db.prepare("UPDATE users SET email='vendor@example.com', email_verified=0 WHERE phone='9000000001'").run();
  assert.equal((await request('/api/wedding', couple, 'POST', { title: 'A & B', date: '2027-02-20', city: 'Pune', budget_paise: 150000000, guests_est: 200 })).status, 200);
  const vid = one("SELECT id FROM vendors WHERE user_id=(SELECT id FROM users WHERE phone='9000000001')").id;
  sent.length = 0;
  const e = await request('/api/enquiries', couple, 'POST', { vendor_id: vid, event_date: '2027-02-20', guests: 200, budget_paise: 5000000 }); assert.equal(e.status, 200); await wait();
  assert.equal(sent.length, 0, 'unverified vendor address gets nothing');
  db.prepare("UPDATE users SET email_verified=1 WHERE phone='9000000001'").run();
  const e2 = await request('/api/enquiries', couple, 'POST', { vendor_id: vid, event_date: '2027-02-21', guests: 100, budget_paise: 2500000 }); await wait();
  assert.deepEqual(sent.map(m => m.to), ['vendor@example.com']); assert.match(sent[0].subject, /New enquiry/);
  sent.length = 0;
  const qr = await request(`/api/enquiries/${e2.data.id}/quotes`, vendor, 'POST', { items: [{ label: 'Photography', amount_paise: 4000000 }] }); assert.equal(qr.status, 200); await wait();
  assert.deepEqual(sent.map(m => m.to), ['couple@example.com']); assert.match(sent[0].text, /₹40,000/);
});

test('guest invitations: validated address, RSVP link, once a day, bulk skips replied guests', async () => {
  setTransport(fake); sent.length = 0;
  assert.equal((await request('/api/guests', couple, 'POST', { name: 'Bad', email: 'nope' })).status, 400);
  const a = await request('/api/guests', couple, 'POST', { name: 'Meera Aunty', email: 'Meera@Example.com', side: 'bride' }); assert.equal(a.status, 200);
  const b = await request('/api/guests', couple, 'POST', { name: 'No Email', side: 'groom' }); assert.equal(b.status, 200);
  assert.equal((await request(`/api/guests/${b.data.id}/email-invite`, couple, 'POST')).status, 400);
  assert.equal((await request(`/api/guests/${a.data.id}/email-invite`, vendor, 'POST')).status, 400, 'a vendor with no wedding cannot invite');
  assert.equal((await request(`/api/guests/${a.data.id}/email-invite`, couple, 'POST')).status, 200); await wait();
  assert.equal(sent.length, 1); assert.equal(sent[0].to, 'meera@example.com');
  const token = one('SELECT token FROM guests WHERE id=?', a.data.id).token; assert.ok(sent[0].text.includes('/rsvp/' + token));
  assert.equal((await request(`/api/guests/${a.data.id}/email-invite`, couple, 'POST')).status, 429);
  await request('/api/guests', couple, 'POST', { name: 'Second', email: 'second@example.com' });
  const all = await request('/api/invite/email-all', couple, 'POST'); assert.equal(all.data.queued, 1, 'only the not-yet-invited guest');
  const edit = await request(`/api/guests/${b.data.id}`, couple, 'PATCH', { email: 'later@example.com' }); assert.equal(edit.status, 200); assert.equal(edit.data.email, 'later@example.com');
});

test('email sign-in: off by default, real one-time codes, no account guessing, admins excluded', async () => {
  setTransport(fake); sent.length = 0;
  assert.equal((await request('/api/auth/email-otp', '', 'POST', { email: 'couple@example.com' })).status, 503, 'disabled unless EMAIL_OTP_ENABLED=1');
  process.env.EMAIL_OTP_ENABLED = '1';
  const known = await request('/api/auth/email-otp', '', 'POST', { email: 'couple@example.com' });
  const unknown = await request('/api/auth/email-otp', '', 'POST', { email: 'nobody@example.com' });
  assert.deepEqual(known, unknown, 'identical response either way'); await wait();
  assert.equal(sent.length, 1); assert.equal(sent[0].to, 'couple@example.com'); const code = codeIn(sent[0]);
  assert.equal((await request('/api/auth/email-verify', '', 'POST', { email: 'couple@example.com', otp: code === '123456' ? '654321' : '123456' })).status, 401);
  const ok = await request('/api/auth/email-verify', '', 'POST', { email: 'couple@example.com', otp: code });
  assert.equal(ok.status, 200); assert.ok(ok.data.token); assert.equal(ok.data.user.phone, '9812400001');
  assert.equal((await request('/api/me', ok.data.token)).status, 200, 'the issued token works');
  assert.equal((await request('/api/auth/email-verify', '', 'POST', { email: 'couple@example.com', otp: code })).status, 401, 'single use');
  process.env.ADMIN_PHONES = '9812400001'; sent.length = 0;
  await request('/api/auth/email-otp', '', 'POST', { email: 'couple@example.com' }); await wait();
  assert.equal(sent.length, 0, 'an admin number never gets an email sign-in code'); delete process.env.ADMIN_PHONES;
  delete process.env.EMAIL_OTP_ENABLED;
});

test('email front door: new address creates an account after the code, known address signs in, codes are single use', async () => {
  setTransport(fake); sent.length = 0; process.env.EMAIL_OTP_ENABLED = '1';
  assert.deepEqual((await request('/api/auth/methods')).data, { email: true, phone: true });
  assert.equal((await request('/api/auth/email/start', '', 'POST', { email: 'brandnew@example.com' })).status, 200); await wait();
  assert.equal(sent.length, 1); assert.equal(sent[0].to, 'brandnew@example.com'); const code = codeIn(sent[0]);
  assert.equal((await request('/api/auth/email/signin', '', 'POST', { email: 'brandnew@example.com', otp: code === '111111' ? '222222' : '111111' })).status, 401, 'wrong code');
  const peek = await request('/api/auth/email/signin', '', 'POST', { email: 'brandnew@example.com', otp: code });
  assert.equal(peek.status, 200); assert.equal(peek.data.needsProfile, true); assert.equal(peek.data.token, undefined);
  assert.equal((await request('/api/auth/email/signin', '', 'POST', { email: 'brandnew@example.com', otp: code, role: 'couple', name: 'Asha Rao' })).status, 400, 'terms must be accepted');
  const made = await request('/api/auth/email/signin', '', 'POST', { email: 'brandnew@example.com', otp: code, role: 'couple', name: 'Asha Rao', accept_terms: true });
  assert.equal(made.status, 200); assert.ok(made.data.token); assert.equal(made.data.user.email, 'brandnew@example.com'); assert.equal(made.data.user.phone, null);
  const me = await request('/api/me', made.data.token); assert.equal(me.status, 200); assert.equal(me.data.consent_current, true);
  assert.equal((await request('/api/auth/email/signin', '', 'POST', { email: 'brandnew@example.com', otp: code })).status, 401, 'single use');
  sent.length = 0; await request('/api/auth/email/start', '', 'POST', { email: 'brandnew@example.com' }); await wait();
  const again = await request('/api/auth/email/signin', '', 'POST', { email: 'brandnew@example.com', otp: codeIn(sent[0]) });
  assert.equal(again.status, 200); assert.equal(again.data.user.id, made.data.user.id, 'returning person gets the same account');
  process.env.PHONE_LOGIN = 'off';
  assert.equal((await request('/api/auth/otp', '', 'POST', { phone: '9812400009' })).status, 503, 'phone login can be switched off');
  delete process.env.PHONE_LOGIN; delete process.env.EMAIL_OTP_ENABLED;
});

test('review account: one demo address signs in with a fixed code and no mail is sent', async () => {
  setTransport(fake); sent.length = 0; process.env.EMAIL_OTP_ENABLED = '1'; process.env.REVIEW_EMAIL = 'Review@Example.com'; process.env.REVIEW_OTP = '482915';
  assert.equal((await request('/api/auth/email/start', '', 'POST', { email: 'review@example.com' })).status, 200); await wait(); assert.equal(sent.length, 0, 'no mail for the review address');
  assert.equal((await request('/api/auth/email/signin', '', 'POST', { email: 'review@example.com', otp: '000000' })).status, 401);
  assert.equal((await request('/api/auth/email/signin', '', 'POST', { email: 'review@example.com', otp: '482915' })).data.needsProfile, true);
  const made = await request('/api/auth/email/signin', '', 'POST', { email: 'review@example.com', otp: '482915', role: 'couple', name: 'App Reviewer', accept_terms: true });
  assert.equal(made.status, 200); assert.ok(made.data.token);
  const back = await request('/api/auth/email/signin', '', 'POST', { email: 'review@example.com', otp: '482915' }); assert.equal(back.status, 200); assert.equal(back.data.user.id, made.data.user.id);
  assert.equal((await request('/api/auth/email/signin', '', 'POST', { email: 'other@example.com', otp: '482915' })).status, 401, 'the fixed code works for no other address');
  delete process.env.REVIEW_EMAIL; delete process.env.REVIEW_OTP; delete process.env.EMAIL_OTP_ENABLED;
});

test('a mail server failure never breaks the request and is recorded', async () => {
  setTransport({ sendMail: async () => { throw new Error('smtp down'); } });
  const g = await request('/api/grievances', '', 'POST', { name: 'Asha', contact: 'asha2@example.com', category: 'other', message: 'Testing a failing mail server' });
  assert.equal(g.status, 201); await wait();
  assert.equal(one("SELECT status FROM email_outbox WHERE to_addr='asha2@example.com'").status, 'failed');
});

test('outbox keeps no message bodies and caps mail per recipient', async () => {
  setTransport(fake); sent.length = 0; const { sendMail } = await import('./mailer.ts');
  const cols = db.prepare('PRAGMA table_info(email_outbox)').all().map((c: any) => c.name);
  assert.ok(!cols.includes('body') && !cols.includes('text'));
  const results = []; for (let i = 0; i < 10; i++) results.push((await sendMail({ to: 'flood@example.com', subject: 'x', text: 'x', template: 't' })).status);
  assert.equal(results.filter(s => s === 'sent').length, 8); assert.equal(results.filter(s => s === 'limited').length, 2);
});

test('plan preview: public, computes checklist, ceremonies and budget split without storing anything', async () => {
  const before = (await request('/api/vendors')).status;
  const r = await request('/api/plan/preview', '', 'POST', { date: '2027-12-05', city: 'Pune', community: 'Marathi', guests_est: 300, budget_paise: 2_000_000_00 });
  assert.equal(r.status, 200); assert.ok(r.data.tasks.length >= 8); assert.ok(r.data.events.length >= 2); assert.ok(r.data.suggestions.length > 5);
  assert.equal(r.data.budget.reduce((n: number, x: any) => n + x.allocated_paise, 0), 2_000_000_00, 'split adds up to the budget');
  assert.equal(r.data.tasks.find((t: any) => t.title === 'Set wedding date & budget').done, true);
  assert.equal((await request('/api/plan/preview', '', 'POST', { date: '2027-02-30', city: 'Pune', budget_paise: 100 })).status, 400, 'bad date rejected');
  assert.equal(before, 200);
});

test('india-wide: listed cities, city interest counts, and regional traditions', async () => {
  const cities = await request('/api/vendors/cities'); assert.equal(cities.status, 200); assert.ok(Array.isArray(cities.data));
  assert.equal((await request('/api/city-interest', '', 'POST', { city: 'Jaipur', category: 'venue' })).status, 200);
  assert.equal((await request('/api/city-interest', '', 'POST', { city: 'J' })).status, 400, 'too short is rejected');
  const t = await request('/api/plan/preview', '', 'POST', { date: '2027-12-05', city: 'Chennai', community: 'Tamil', budget_paise: 100000000 });
  assert.deepEqual(t.data.events.map((e: any) => e.name), ['Nichayathartham', 'Nalangu', 'Muhurtham', 'Reception']);
  const unknown = await request('/api/plan/preview', '', 'POST', { date: '2027-12-05', city: 'Imphal', community: 'Something else', budget_paise: 100000000 });
  assert.equal(unknown.status, 200, 'any city and unknown tradition still produce a plan');
});
