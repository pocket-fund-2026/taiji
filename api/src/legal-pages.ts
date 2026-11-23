// Public legal pages and the two public forms (grievance, listing removal or claim). The text is a working draft written from what the
// product actually does; it still needs review by an Indian lawyer, and the banner on every page says so until it is removed on purpose.
import { POLICY_VERSION } from './config.ts';

const esc = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const env = (k: string) => (process.env[k] || '').trim();
const draft = `<p class="note" style="background:#F3E9E0;padding:10px 14px;border-radius:8px">Working draft, version ${POLICY_VERSION}. Pending review by counsel before public launch. This is a demo build: payments, sign-in codes and WhatsApp are simulated.</p>`;

// Every detail the Consumer Protection (E-Commerce) Rules and the IT Rules expect on the page: the operating company, its registered address,
// registration numbers, and the named Grievance Officer with a way to reach them. Values come from the environment; unset ones say so plainly.
function officer() {
  const e = (k: string) => esc(env(k)); const has = (k: string) => !!env(k);
  const pending = '<em>to be published before public launch</em>';
  const rows: [string, string][] = [
    ['Operating company', has('COMPANY_NAME') ? e('COMPANY_NAME') : pending],
    ['Registered office', has('COMPANY_ADDRESS') ? e('COMPANY_ADDRESS') : pending],
    ['CIN / LLPIN', has('COMPANY_CIN') ? e('COMPANY_CIN') : pending],
    ['GSTIN', has('COMPANY_GSTIN') ? e('COMPANY_GSTIN') : pending],
    ['Grievance Officer', has('GRIEVANCE_OFFICER_NAME') ? `${e('GRIEVANCE_OFFICER_NAME')}${has('GRIEVANCE_OFFICER_TITLE') ? ', ' + e('GRIEVANCE_OFFICER_TITLE') : ''}` : pending],
    ['Officer email', has('GRIEVANCE_OFFICER_EMAIL') ? `<a href="mailto:${e('GRIEVANCE_OFFICER_EMAIL')}">${e('GRIEVANCE_OFFICER_EMAIL')}</a>` : pending],
    ['Officer phone and hours', has('GRIEVANCE_OFFICER_PHONE') ? e('GRIEVANCE_OFFICER_PHONE') : pending],
  ];
  return `<h2>Who we are and who to contact</h2>
  <table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px;max-width:640px">${rows.map(([k, v]) => `<tr><th style="text-align:left;padding:6px 16px 6px 0;vertical-align:top;color:#75656B;font-weight:600">${k}</th><td style="padding:6px 0">${v}</td></tr>`).join('')}</table>
  <p>You can always use the <a href="/grievance">grievance form</a>: it works today, gives you a reference number, and we acknowledge within 48 hours and resolve within one month.</p>`;
}

const form = (id: string, fields: string, endpoint: string, extra = '') => `<form id="${id}" class="planning-form" style="grid-template-columns:1fr;max-width:560px" novalidate>${fields}<input type="text" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true"><button type="submit">Send</button><p id="${id}-out" role="status" class="note"></p></form>
<script>document.getElementById('${id}').addEventListener('submit',async function(e){e.preventDefault();var f=e.target,o=document.getElementById('${id}-out'),b={};new FormData(f).forEach(function(v,k){if(v!=='')b[k]=v});${extra}o.textContent='Sending…';try{var r=await fetch('${endpoint}',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});var d=await r.json();o.textContent=r.ok?'Received. Your reference is '+d.reference+'. '+d.note:(d.error||'Something went wrong. Please check the form.');if(r.ok)f.reset()}catch(x){o.textContent='Could not reach the server. Please try again.'}});</script>`;
const lbl = (name: string, label: string, type = 'text', req = true) => `<label>${label}<input name="${name}" type="${type}" ${req ? 'required' : ''} maxlength="200"></label>`;

export function mountLegalPages(app: any, page: (title: string, description: string, body: string) => string) {
  app.get('/privacy', (_q: any, r: any) => r.send(page('Privacy Policy | Shaadi OS', 'What data Shaadi OS collects, why, how long we keep it and your rights under India’s DPDP Act.', `<h1>Privacy Policy</h1>${draft}
  <h2>What we collect and why</h2>
  <ul><li><strong>Account:</strong> mobile number and name, to sign you in and show your name to vendors you contact. We ask for your agreement to this policy and the Terms before we create an account, and we record that agreement with its version.</li>
  <li><strong>Wedding plan:</strong> date, city, community or tradition (optional), budget, guest list, tasks, events and notes you enter, to run the planning tools. Treat the community and family details you add as optional.</li>
  <li><strong>Vendor activity:</strong> enquiries, quotes, messages, bookings, reviews and payment records, to run the booking between you and a vendor.</li>
  <li><strong>Vendors:</strong> business name, contact, services, prices, photos you permit us to publish, and optional legal name, address and GSTIN, shown to couples so they know who they are dealing with.</li>
  <li><strong>On your phone only:</strong> the answers you give during first-run setup (city, services, timing) are stored on the device to personalise the home screen and are not sent to us.</li></ul>
  <h2>Listings of businesses that have not joined</h2>
  <p>We list businesses found on their own public websites, with their public contact details and a link to the source. They are labelled "Not on Shaadi OS yet". If you own or appear in a listing you can <a href="/remove-listing">ask us to remove, correct or hand over</a> the listing; we act within 48 hours and will not list you again.</p>
  <h2>Who sees your data</h2>
  <p>Vendors see what you share in an enquiry. Phone numbers and UPI IDs stay hidden in chat until a booking exists. Your family members see only what you share with them. We use hosting, and (when switched on) a sign-in message provider and a licensed payment provider, as processors under written terms. We do not sell your data and do not use it for advertising profiles. We do not knowingly target children; guest lists you enter may include minors and you are responsible for entering them only for your own family event.</p>
  <h2>How long we keep it</h2>
  <p>Account and plan data until you delete your account. Booking, invoice and payment records are kept as long as tax and accounting law requires (currently up to eight years, to be confirmed by our CA), even after deletion of your profile. Security and audit logs are kept for 180 days. Grievances are kept for three years.</p>
  <h2>Where it is stored</h2>
  <p>Our servers are currently in Germany. Data may be processed outside India as the DPDP Act allows.</p>
  <h2>Your rights</h2>
  <p>In the app go to Profile → Privacy to export or delete your data, correct it by editing it, and withdraw marketing consent. You may nominate someone to exercise your rights on your behalf by writing to us. To complain, use the grievance form below; you may also approach the Data Protection Board of India.</p>
  <h2>Security and breaches</h2>
  <p>We use access controls, rate limits and audit logs. If a breach affects you we will tell you and the Board as the law requires, and report incidents to CERT-In within six hours of noticing them.</p>
  ${officer()}`)));

  app.get('/terms', (_q: any, r: any) => r.send(page('Terms of Use | Shaadi OS', 'The terms for using Shaadi OS to discover, plan and book wedding vendors.', `<h1>Terms of Use</h1>${draft}
  <h2>What Shaadi OS is</h2>
  <p>Shaadi OS is an intermediary: it helps couples and families find independent wedding vendors, plan the wedding and communicate with vendors. Vendors, not Shaadi OS, supply and are responsible for their services. Listings of businesses that have not joined are shown for information only and do not imply any relationship or endorsement.</p>
  <h2>Accounts</h2>
  <p>You must give your real name and a mobile number you control. You are responsible for activity on your account. Do not use the app to harass, defraud, circumvent in-app terms, upload unlawful content or infringe anyone's rights; we may remove content, suspend accounts and act on reports.</p>
  <h2>Payments</h2>
  <p>In this demo build, payment screens are simulated and no money moves. When real payments are introduced they will be processed by a licensed payment provider, and these Terms and the <a href="/refunds">Cancellation and Refund Policy</a> will be updated before then. Commission and any taxes will be shown to you before you confirm a booking.</p>
  <h2>Reviews and verification</h2>
  <p>Reviews come from people who booked the vendor. A "Verified" badge means we checked the documents or details recorded on the vendor's profile at the time shown; it is not a guarantee of quality.</p>
  <h2>Reports, removal and grievances</h2>
  <p>You can report a vendor, review or message in the app. Complaints go through the <a href="/grievance">grievance form</a>. Requests about a listing go through <a href="/remove-listing">this form</a>.</p>
  <h2>Liability and law</h2>
  <p>To the extent the law allows, Shaadi OS is not liable for a vendor's services or for losses from a vendor's acts. These Terms are governed by Indian law; disputes go to the courts at the company's registered city, subject to any rights you have under consumer law. Final wording to be settled by counsel.</p>
  ${officer()}`)));

  app.get('/refunds', (_q: any, r: any) => r.send(page('Cancellation and Refund Policy | Shaadi OS', 'How cancellations, refunds and disputes work for bookings made through Shaadi OS.', `<h1>Cancellation and Refund Policy</h1>${draft}
  <p>Each vendor sets its own cancellation terms in its quote, and you see them before you accept. They apply to your booking. If a vendor does not deliver the agreed service you can raise a dispute from the booking; our team reviews both sides and records a decision. The decision is recorded in the app. In the current demo no real money is held or moved, so no real refund can arise.</p>
  <p>When real payments launch, this page will state refund timelines, how amounts are returned to the original payment method through our licensed payment provider, and what share of any commission is returned. Contact us through the <a href="/grievance">grievance form</a> for any booking problem.</p>`)));

  app.get('/vendor-terms', (_q: any, r: any) => r.send(page('Vendor Terms | Shaadi OS', 'Terms for wedding vendors using Shaadi OS.', `<h1>Vendor Terms</h1>${draft}
  <p>You list your own business or have the owner's permission to do so. You are an independent business: you set your prices and deliver your services. You promise that the details, photos and links you publish are accurate and that you have the right to publish them. You must keep your legal name, address and GSTIN (if registered) up to date; these are shown to couples.</p>
  <p>Commission, taxes and payout timing will be shown to you before real payments begin, and we will deduct only taxes the law requires. You must issue the tax invoice for your own service. You agree not to take bookings made on Shaadi OS off the platform to avoid commission, and not to contact people from the listings or enquiry data for unrelated marketing. We may suspend a profile for misleading content, repeated disputes or breach of these terms.</p>
  <p>If a business is listed here without having joined, it can <a href="/remove-listing">ask for removal or claim the listing</a> at any time.</p>`)));

  app.get('/grievance', (_q: any, r: any) => r.send(page('Grievance Redressal | Shaadi OS', 'Raise a complaint with Shaadi OS. We acknowledge within 48 hours and resolve within a month.', `<h1>Grievance redressal</h1>${draft}
  <p>Use this form for any complaint about an account, booking, payment, vendor, content or your data. We acknowledge it within 48 hours and resolve it within one month.</p>
  ${form('g', lbl('name', 'Your name') + lbl('contact', 'Phone or email') + `<label>What is it about?<select name="category" required><option value="booking">A booking</option><option value="vendor">A vendor</option><option value="payment">A payment</option><option value="content">Content or a review</option><option value="privacy">My data or privacy</option><option value="other">Something else</option></select></label><label>Tell us what happened<textarea name="message" required minlength="10" maxlength="2000" rows="5"></textarea></label>`, '/api/grievances')}
  ${officer()}`)));

  app.get('/remove-listing', (_q: any, r: any) => r.send(page('Remove, correct or claim a listing | Shaadi OS', 'Ask Shaadi OS to remove, correct or hand over a business listing.', `<h1>Remove, correct or claim a listing</h1>${draft}
  <p>Some businesses are listed from their own public websites before they join. If that is you, or you act for the business, tell us what you want. We acknowledge within 48 hours. A removal is permanent and we will not list the business again.</p>
  ${form('l', lbl('name', 'Your name') + lbl('contact', 'Phone or email') + lbl('vendor_id', 'Listing number (from the listing page address, optional)', 'number', false) + `<label>What do you want?<select name="kind" required><option value="remove">Remove the listing</option><option value="correct">Correct details</option><option value="claim">Claim it as the owner</option></select></label><label>Business name and city<textarea name="message" rows="3" maxlength="1000"></textarea></label>`, '/api/listing-requests', "if(b.vendor_id)b.vendor_id=Number(b.vendor_id);")}`)));
}
