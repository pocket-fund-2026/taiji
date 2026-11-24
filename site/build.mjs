// Builds the static site: landing page, privacy policy and support page.
//   node build.mjs --preview   fills missing operator details with a visible marker and writes dist-preview/
//   node build.mjs             production: stops until every required detail is filled in config.json
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(here, 'config.json'), 'utf8'));
const preview = process.argv.includes('--preview');
const out = join(here, preview ? 'dist-preview' : 'dist');
const op = cfg.operator;

const REQUIRED = ['legalName', 'registeredAddress', 'supportEmail', 'grievanceOfficerName', 'grievanceOfficerEmail'];
const missing = REQUIRED.filter(k => !String(op[k] || '').trim());
if (missing.length && !preview) {
  console.error('Cannot build for production. Fill these in site/config.json under "operator":\n  - ' + missing.join('\n  - '));
  console.error('\nUse "node build.mjs --preview" to see the pages with the gaps marked.');
  process.exit(1);
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const val = (k, wrap = esc) => String(op[k] || '').trim() ? wrap(op[k]) : '<mark class="todo">[to be filled]</mark>';
const mail = k => String(op[k] || '').trim() ? `<a href="mailto:${esc(op[k])}">${esc(op[k])}</a>` : '<mark class="todo">[to be filled]</mark>';
const base = cfg.basePath.replace(/\/$/, '');
const name = esc(cfg.appName);

const css = `
:root{--primary:#74263F;--dark:#4D192C;--gold:#E8C877;--gold-soft:#F3E8D1;--bg:#FAF7F2;--card:#FFFEFC;--ink:#2C2024;--mute:#6B5B61;--line:#EADCD3}
@media (prefers-color-scheme:dark){:root{--bg:#1E1418;--card:#2A1C22;--ink:#F4ECE6;--mute:#C2B0B7;--line:#43303A;--gold-soft:#3A2A1C}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
h1,h2,h3{font-family:"Fraunces",Georgia,"Times New Roman",serif;font-weight:600;line-height:1.2;margin:0 0 .5em}
a{color:var(--primary)}@media (prefers-color-scheme:dark){a{color:var(--gold)}}
.wrap{max-width:760px;margin:0 auto;padding:0 20px}
header.top{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;max-width:960px;margin:0 auto}
header.top a.brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--ink);font-family:"Fraunces",Georgia,serif;font-weight:600;font-size:20px}
header.top img{width:36px;height:36px;border-radius:9px}
nav a{margin-left:18px;text-decoration:none;font-size:15px}
.hero{background:var(--primary);color:#FFFEFC;padding:56px 20px 64px;text-align:center;border-radius:0 0 36px 36px;position:relative;overflow:hidden}
.hero:before,.hero:after{content:"";position:absolute;border:2px solid rgba(232,200,119,.22);border-radius:50%;pointer-events:none}
.hero:before{width:420px;height:420px;right:-120px;top:-170px}.hero:after{width:300px;height:300px;left:-100px;bottom:-190px}
.hero h1{font-size:clamp(30px,6vw,46px);color:#FFFEFC;max-width:640px;margin:0 auto .4em}
.hero p{max-width:540px;margin:0 auto 24px;color:rgba(255,254,252,.86);font-size:18px}
.eyebrow{letter-spacing:.2em;text-transform:uppercase;font-size:12px;font-weight:700;color:var(--gold);margin-bottom:14px}
.btn{display:inline-block;background:var(--gold);color:#3b1424;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:14px;margin:6px}
.btn.ghost{background:transparent;color:#FFFEFC;border:2px solid rgba(255,254,252,.5)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin:36px 0}
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:20px}
.card h3{font-size:19px}.card p{margin:0;color:var(--mute);font-size:15px}
section{margin:44px 0}
.cities{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.cities span{background:var(--gold-soft);border-radius:999px;padding:6px 14px;font-size:14px}
main.doc{padding:28px 0 60px}main.doc h1{font-size:34px}main.doc h2{font-size:22px;margin-top:2em}
main.doc ul{padding-left:1.2em}main.doc li{margin:.3em 0}
table{border-collapse:collapse;width:100%;font-size:15px;margin:12px 0;display:block;overflow-x:auto}td,th{border-bottom:1px solid var(--line);padding:10px 8px;text-align:left;vertical-align:top}
.meta{color:var(--mute);font-size:14px}
mark.todo{background:#FFE9A8;color:#5a3b00;padding:1px 6px;border-radius:6px}
details{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:4px 16px;margin:10px 0}
summary{cursor:pointer;font-weight:600;padding:12px 0}details p{margin:0 0 14px;color:var(--mute)}
footer{border-top:1px solid var(--line);padding:28px 20px 40px;text-align:center;color:var(--mute);font-size:14px}
footer a{margin:0 10px}
@media (max-width:520px){nav a{margin-left:12px}}
`;

const shell = (title, desc, bodyHtml, path) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(cfg.siteUrl + base + path)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${esc(cfg.siteUrl + base)}/og-image.png"><meta name="theme-color" content="#74263F">
<link rel="icon" href="${base}/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@600&display=swap" rel="stylesheet">
<style>${css}</style></head><body>
<header class="top"><a class="brand" href="${base}/"><img src="${base}/icon.png" alt="" width="36" height="36">${name}</a>
<nav><a href="${base}/privacy">Privacy</a><a href="${base}/support">Support</a></nav></header>
${bodyHtml}
<footer><a href="${base}/">Home</a><a href="${base}/privacy">Privacy Policy</a><a href="${base}/support">Support</a>
<p>${val('legalName')}${String(op.registeredAddress || '').trim() ? ' · ' + esc(op.registeredAddress) : ''}</p></footer></body></html>`;

const stores = [['appStore', 'Download on the App Store'], ['playStore', 'Get it on Google Play']].filter(([k]) => cfg.storeLinks[k])
  .map(([k, l]) => `<a class="btn" href="${esc(cfg.storeLinks[k])}">${l}</a>`).join('');

const landing = shell(`${cfg.appName}: Indian wedding planner`, 'Plan your Indian wedding with a checklist timed to your date, a budget split, a guest list and real wedding vendors across India. No account needed to start.', `
<div class="hero"><div class="eyebrow">${name}</div><h1>${esc(cfg.tagline)}</h1>
<p>A checklist timed to your date, your budget split across services, a guest list and real wedding vendors. Start in two minutes, with no account.</p>
${stores}<a class="btn ${stores ? 'ghost' : ''}" href="${esc(cfg.webAppUrl)}">Open the web app</a></div>
<div class="wrap">
<div class="grid">
<div class="card"><h3>A checklist for your date</h3><p>Tasks are timed back from your wedding day, with ceremonies for your tradition.</p></div>
<div class="card"><h3>Your budget, split</h3><p>See what each service should cost and track what you have spent.</p></div>
<div class="card"><h3>Guests and families</h3><p>Keep a guest list by family and count everyone for each ceremony.</p></div>
<div class="card"><h3>Real vendors</h3><p>Browse venues, caterers, photographers, makeup, mehndi, decor, DJs and pandits.</p></div></div>
<section><h2>Plan first, sign up later</h2><p>You can build your whole plan without an account. It stays on your phone. Create a free account when you want to back it up, share it with family or ask vendors for quotes. Everything you entered moves across.</p></section>
<section><h2>Vendors across India</h2><p>Listings so far cover these cities, and the planner works in every city in India.</p>
<div class="cities">${['Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Kolkata', 'Lucknow', 'Pune', 'Nagpur', 'Nashik'].map(c => `<span>${c}</span>`).join('')}</div>
<p class="meta">Many listings are businesses that have not joined ${name}. They are labelled, link to the business's own website, and can be removed or corrected on request.</p></section>
</div>`, '/');

const row = (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`;
const privacy = shell(`Privacy Policy | ${cfg.appName}`, `What ${cfg.appName} collects, why, how long we keep it, who we share it with and how to use your rights under India's DPDP Act.`, `
<div class="wrap"><main class="doc"><h1>Privacy Policy</h1>
<p class="meta">Effective ${esc(cfg.effectiveDate)}. This policy covers the ${name} mobile apps and website.</p>
<p>${name} is operated by ${val('legalName')}, ${val('registeredAddress')} ("we", "us"). We are the data fiduciary for the personal data described here. We follow India's Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000 and its rules.</p>

<h2>The short version</h2>
<ul><li>You can plan a wedding in the app without an account. That plan stays on your phone and we do not receive it.</li>
<li>If you create an account we store the details you give us so the planning, vendor and guest tools work.</li>
<li>We do not sell your data, show ads or use advertising or analytics trackers in the app.</li>
<li>You can export or delete your data inside the app, and you can contact us any time.</li></ul>

<h2>What we collect and why</h2>
<table><tr><th>What</th><th>Why</th><th>When</th></tr>
${row('Name and email address (or mobile number)', 'To create your account, sign you in with a one-time code, and show your name to vendors you contact.', 'Only if you create an account')}
${row('Wedding details: date, city, tradition, budget, guest estimate', 'To build your checklist, ceremonies and budget split.', 'Kept on your phone if you have no account; stored with your account if you do')}
${row('Checklist, budget entries, notes and expenses', 'To run the planning tools.', 'As above')}
${row('Guest list: names, family size, and optionally phone, email, meal preference and RSVP', 'To run your guest list and send invitations you choose to send. These are other people\'s details, so only add guests you are allowed to share.', 'As above')}
${row('Enquiries, quotes, messages, bookings and reviews', 'To connect you with vendors and keep a record of the booking.', 'When you use these features with an account')}
${row('Vendor business details: name, services, prices, area, contact, optional legal name, address and GSTIN, and portfolio photos you upload', 'To show couples who they are dealing with.', 'Only if you register as a vendor')}
${row('Records of your agreement to this policy and our Terms, with the version', 'To show that you agreed.', 'When you create an account')}
${row('Security and delivery records: your IP address is used briefly to limit abuse and is not stored with your profile; an email delivery log keeps recipient, subject and outcome, never the message body; audit logs record security-relevant actions', 'To keep the service secure, limit abuse and fix problems.', 'Automatically, for a limited time')}
</table>
<p>The answers you give in first-run setup (city, services, timing) are stored on your device to personalise the app and are not sent to us.</p>

<h2>Listings of businesses that have not joined</h2>
<p>We show wedding businesses found on their own public websites, with the public business contact details they publish and a link to the source. They are labelled "Not on ${name} yet". If you own or appear in a listing you can ask us to correct it, remove it or hand it over to you, using the form on our <a href="${esc(cfg.apiUrl)}/remove-listing">removal page</a> or by email below.</p>

<h2>Who we share data with</h2>
<ul><li><strong>Vendors</strong> see what you choose to put in an enquiry. Phone numbers and UPI IDs stay hidden in chat until a booking exists.</li>
<li><strong>Family members</strong> you invite see only the parts of your plan you share with them.</li>
<li><strong>Service providers</strong> that run the service for us: a hosting provider for our servers (currently in Germany) and an email delivery provider that sends your sign-in codes and notifications. They may only use the data to provide those services to us.</li>
<li><strong>Authorities</strong> where the law requires it.</li></ul>
<p>We do not sell personal data and we do not share it with advertisers.</p>

<h2>Notifications</h2>
<p>Reminders for tasks and payments are scheduled on your device. You can turn them off in your phone settings. We send emails only for sign-in codes, account notices and things you ask for. Marketing messages are off unless you choose them.</p>

<h2>How long we keep it</h2>
<p>We keep account and plan data until you delete your account. Booking, invoice and payment records are kept for as long as tax and accounting law requires, even after your profile is deleted. Security logs are kept for a limited period. Data held only on your phone is removed when you delete the app.</p>

<h2>Where it is stored</h2>
<p>Our servers are currently in Germany. Your data may be processed outside India as the DPDP Act allows. We protect it with HTTPS in transit, access controls, rate limits and audit logs.</p>

<h2>Your rights and choices</h2>
<ul><li><strong>Access and export:</strong> in the app, go to Profile, then Privacy, then export your data.</li>
<li><strong>Correct:</strong> edit your details in the app, or write to us.</li>
<li><strong>Delete:</strong> in the app, go to Profile, then Privacy, then delete my data. This removes your account and your wedding plan. Records we must keep by law stay for the legal period.</li>
<li><strong>Withdraw consent:</strong> turn off marketing in your profile, or delete your account.</li>
<li><strong>Nominate someone</strong> to exercise these rights for you by writing to us.</li>
<li><strong>Complain</strong> to us first using the details below. You may also approach the Data Protection Board of India.</li></ul>

<h2>Children</h2>
<p>${name} is for adults planning a wedding. It is not directed at children under 18, and we do not knowingly collect their data.</p>

<h2>Security incidents</h2>
<p>If a personal data breach affects you we will tell you and the Data Protection Board as the law requires, and report cyber incidents to CERT-In within the required time.</p>

<h2>Changes to this policy</h2>
<p>If we change this policy in a way that matters we will tell you in the app or by email before it takes effect, and update the date above.</p>

<h2>Contact and Grievance Officer</h2>
<table>
${row('Operator', val('legalName'))}${row('Registered office', val('registeredAddress'))}
${row('Support', mail('supportEmail'))}
${row('Grievance Officer', `${val('grievanceOfficerName')}${String(op.grievanceOfficerTitle || '').trim() ? ', ' + esc(op.grievanceOfficerTitle) : ''}`)}
${row('Grievance email', mail('grievanceOfficerEmail'))}
${String(op.grievanceOfficerPhone || '').trim() ? row('Grievance phone', esc(op.grievanceOfficerPhone)) : ''}
</table>
<p>You can also use the <a href="${esc(cfg.apiUrl)}/grievance">grievance form</a>. We acknowledge complaints within 48 hours and aim to resolve them within one month.</p>
</main></div>`, '/privacy');

const faq = [
  ['Do I need an account?', 'No. You can build a full wedding plan on your phone without one. Create a free account when you want to back it up, share it with family or contact vendors.'],
  ['I did not get my sign-in code.', 'Check your spam folder and wait a minute. Codes last 10 minutes. Request a new one with "Resend code". If it still does not arrive, write to us at the support email below.'],
  ['How do I delete my account and data?', 'In the app: Profile, then Privacy, then delete my data. This removes your account and wedding plan. If you cannot sign in, email us from the address on your account.'],
  ['How do I export my data?', 'In the app: Profile, then Privacy, then export my data.'],
  ['My plan disappeared.', 'A plan made without an account lives on that phone only. Deleting the app or clearing its data removes it. Create an account to keep a backup.'],
  ['A vendor listing is wrong, or it is my business and I want it removed.', `Use the <a href="${esc(cfg.apiUrl)}/remove-listing">removal page</a> or write to us. We act on requests quickly.`],
  ['Can I book and pay vendors in the app?', 'Not yet. You can browse vendors, compare them and send enquiries. Payments will be added later and we will tell you when they are live.'],
  ['The city I want has no vendors.', 'The planner works in every city in India. We are adding vendors city by city. Tell us from the Discover tab and we will prioritise it.'],
];
const support = shell(`Support | ${cfg.appName}`, `Get help with ${cfg.appName}: sign-in codes, deleting your data, vendor listings and contacting us.`, `
<div class="wrap"><main class="doc"><h1>Support</h1>
<p>We are happy to help. Write to us and include the email or phone number on your account and what you were trying to do.</p>
<div class="card"><h3>Contact us</h3>
<p>Email: ${mail('supportEmail')}<br>Hours: ${esc(op.supportHours)}<br>We aim to reply within two working days.</p></div>
<h2>Common questions</h2>
${faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${a}</p></details>`).join('')}
<h2>Complaints and privacy requests</h2>
<p>For a complaint or a request about your personal data, use the <a href="${esc(cfg.apiUrl)}/grievance">grievance form</a> or see the contact details in the <a href="${base}/privacy">Privacy Policy</a>.</p>
</main></div>`, '/support');

rmSync(out, { recursive: true, force: true });
const site = join(out, base);
for (const [p, html] of [['index.html', landing], ['privacy/index.html', privacy], ['support/index.html', support]]) {
  mkdirSync(dirname(join(site, p)), { recursive: true }); writeFileSync(join(site, p), html);
}
copyFileSync(join(here, '..', 'app', 'assets', 'icon.png'), join(site, 'icon.png'));
copyFileSync(join(here, '..', 'api', 'public', 'favicon.png'), join(site, 'favicon.png'));
copyFileSync(join(here, '..', 'api', 'public', 'og-image.png'), join(site, 'og-image.png'));
console.log(`Built ${out}${preview ? ' (preview: gaps are marked)' : ''}${missing.length ? '\nStill to fill in config.json: ' + missing.join(', ') : ''}`);
