const { chromium } = require('playwright-core');
const URL = 'http://localhost:8083';
async function session(b, phone, role, name) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('onboarded', '1'); } catch (e) {} });
  const p = await ctx.newPage(); p.setDefaultTimeout(8000); const log = [];
  p.on('pageerror', e => log.push('PAGEERROR ' + e.message.slice(0, 160)));
  p.on('console', m => { if (m.type() === 'error' && !/DevTools|Running application|favicon/.test(m.text())) log.push('console ' + m.text().slice(0, 160)); });
  p.on('response', r => { if (r.status() >= 400 && r.url().includes(':4600')) log.push(`HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/.*:4600/, '')}`); });
  await p.goto(URL); await p.waitForTimeout(3500);
  await p.getByText('Profile', { exact: true }).last().click(); await p.waitForTimeout(600);
  await p.getByText('Sign in or create an account').first().click(); await p.waitForTimeout(600);
  await p.locator('input:visible').first().fill(phone); await p.getByText('Send code').click(); await p.waitForTimeout(1000);
  await p.locator('input:visible').first().fill('123456'); await p.waitForTimeout(2500);
  if (name) { await p.locator('input:visible').first().fill(name); await p.getByText(role === 'vendor' ? 'I’m a wedding vendor' : 'I’m planning a wedding').click(); await p.getByText('I agree to the Terms and Privacy Policy.', { exact: false }).click(); await p.getByText('Create account').click(); await p.waitForTimeout(3000); }
  if (await p.getByText('I agree', { exact: true }).count()) { await p.getByText('I agree', { exact: true }).click(); await p.waitForTimeout(3000); }
  return { p, log };
}
const step = async (s, label, fn) => { const before = s.log.length; try { await fn(); await s.p.waitForTimeout(1200); } catch (e) { s.log.push('STEP-FAIL ' + label + ': ' + e.message.split('\n')[0].slice(0, 140)); } console.log(`[${label}] ${s.log.length === before ? 'ok' : 'ISSUES'}`); s.log.slice(before).forEach(l => console.log('   ' + l)); };
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  console.log('=== COUPLE ===');
  const c = await session(b, '98123' + String(Date.now()).slice(-5), 'couple', 'Feature Tester');
  await c.p.screenshot({ path: '.qa/shots/f-couple-landing.png' });
  const tab = n => c.p.getByText(n, { exact: true }).last().click();
  await step(c, 'Discover tab', async () => { await tab('Discover'); await c.p.getByText('Find wedding vendors').first().waitFor({ timeout: 8000 }); });
  await step(c, 'Filter by category (Venues)', async () => { await c.p.locator('[aria-label^="Venues"]').first().click(); await c.p.waitForTimeout(1500); });
  await step(c, 'Open a vendor profile', async () => { await c.p.locator('[role=button]').filter({ hasText: /Not on Shaadi OS yet|Sample listing/ }).first().click(); await c.p.waitForTimeout(2000); await c.p.screenshot({ path: '.qa/shots/f-vendor.png' }); });
  await step(c, 'Report a listing opens', async () => { await c.p.getByText('Report this listing').first().click(); await c.p.getByText('What is wrong?').waitFor({ timeout: 4000 }); });
  await c.p.reload(); await c.p.waitForTimeout(3500);
  await step(c, 'Plan tab', async () => { await tab('Plan'); await c.p.waitForTimeout(1500); await c.p.screenshot({ path: '.qa/shots/f-plan.png' }); });
  await step(c, 'My vendors tab', async () => { await tab('My vendors'); });
  await step(c, 'Profile tab + privacy', async () => { await tab('Profile'); await c.p.getByText('Privacy and your data').first().click(); await c.p.getByText('Raise a grievance').waitFor({ timeout: 4000 }); await c.p.screenshot({ path: '.qa/shots/f-profile.png' }); });
  await step(c, 'Export my data', async () => { await c.p.getByText('Export my data').first().click(); });
  await c.p.context().close();
  console.log('=== VENDOR (demo 9000000001) ===');
  const v = await session(b, '9000000001', 'vendor', null);
  await v.p.screenshot({ path: '.qa/shots/f-vendor-landing.png' });
  const vt = n => v.p.getByText(n, { exact: true }).last().click();
  for (const n of ['Clients', 'Payouts', 'Business']) await step(v, n + ' tab', async () => { await vt(n); await v.p.waitForTimeout(1200); await v.p.screenshot({ path: `.qa/shots/f-vendor-${n}.png` }); });
  await step(v, 'Storefront has legal fields', async () => { await v.p.getByText('Legal name of the business').first().waitFor({ timeout: 5000 }); });
  await step(v, 'Calendar sub-tab', async () => { await v.p.getByText('Calendar', { exact: true }).last().click(); });
  await step(v, 'CRM sub-tab', async () => { await v.p.getByText('CRM', { exact: true }).last().click(); });
  await b.close();
})();
