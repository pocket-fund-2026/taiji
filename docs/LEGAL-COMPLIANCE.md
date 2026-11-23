# Shaadi OS: legal and compliance gap register

Prepared 23 November 2026 from a review of the code, the app and the live demo server. **This is an engineering gap analysis, not legal advice.** Statutes, rules and rates below are from memory of the law as at mid-2026 and each item marked *verify* must be confirmed by an Indian lawyer or CA before it is relied on. Nothing here was checked against a regulator's current text.

Stage key: **S1** before any real users, **S2** before real money moves, **S3** before App Store / Play submission.

## Status after the 23 November remediation

Engineering fixes now in the code and deployed: no default admin and a private admin code; persistent signing secret; no OTP hint from the API; wrong-code rate limit; restricted CORS and security headers; consent and notice at sign-up with version logging; full draft privacy, terms, refund, vendor-terms pages; grievance form with acknowledgement; listing remove, correct and claim requests with a no-re-import list; report and block; admin inbox; seller legal name, address and GSTIN on profiles; "escrow" wording removed from the app, site and terms; verification now requires a recorded basis. See `SECURITY-RUNBOOK.md`.

**Also done on 23 November:** HTTPS with a valid certificate at `https://46-225-26-58.sslip.io` (Caddy), cleartext removed from the apps, a one-time re-consent screen for accounts made before the current policy version, enforced retention purges (audit logs 180 days, resolved grievances three years, resolved reports and requests one year), data export and deletion cover blocks, reports and vendor legal details, and a privacy notice on invitation and RSVP pages.

**Still open because they need a person or a third party, not code:** your own domain in place of the sslip.io name (`deploy/Caddyfile`); counsel review of every policy page; the named Grievance Officer and company details (set the environment variables); trademark clearance for "Shaadi OS"; entity, GST registration and the CA's TCS/TDS/invoice treatment; a licensed payment aggregator before any real money; processor agreements; CERT-In log localisation decision; Apple and Google store forms. The original findings below are kept for reference; items 0.1, 0.2 and the engineering rows of sections 1, 4 and 5 are fixed.

## 0. Live issues on the demo server (original findings, now fixed except 0.3 and 0.4)

| # | Issue | Evidence | Fix |
|---|---|---|---|
| 0.1 | Anyone can become **admin**. `ADMIN_PHONES` is unset, so `9999999999` is admin, and the OTP is always `123456` | Live process has no `ADMIN_PHONES`; `/api/auth/otp` replies "Demo OTP is 123456". Admin endpoints list vendors, disputes, audit log and let the caller verify vendors and resolve disputes | Set `ADMIN_PHONES` to a number only you control and restart; better, stop returning the OTP hint |
| 0.2 | `JWT_SECRET` unset, so a random secret is generated at every start | `server.ts` line 9. All sessions die on each restart (the 23 Nov deploy did this); tokens last 30 days with no revocation | Set a long persistent secret in the host environment |
| 0.3 | Plain HTTP on an IP address, `cors()` open to every origin, ATS cleartext allowed in the iOS build | `app.json`, `server.ts` | Domain, TLS, restricted CORS (S1) |
| 0.4 | Server is in Nuremberg, Germany (Hetzner) | `hostname ubuntu-8gb-nbg1-1` | See 1.7 on log and data location |

## 1. Data protection (DPDP Act 2023, DPDP Rules 2025, IT Act s.43A / SPDI Rules 2011)

The DPDP Rules were notified in November 2025 with most duties phased in about 18 months later, so roughly **May 2027** (*verify exact dates*). SPDI Rules stay in force until the DPDP repeal provision commences (*verify*). Build to DPDP now.

| # | Requirement | Status | Stage |
|---|---|---|---|
| 1.1 | Itemised notice and free, specific consent **before** collecting data, in plain language (and Eighth Schedule languages on request) | **Gap.** Sign-in collects phone and name with no notice or consent step. Only a post-login marketing toggle exists | S1 |
| 1.2 | Real privacy policy | **Gap.** `/privacy` is a labelled placeholder; grievance address is `grievance@shaadios.example` (also shown in-app) | S1 |
| 1.3 | Grievance officer / contact and response times | **Gap.** Placeholder only | S1 |
| 1.4 | Withdraw consent, access, correct, erase | **Partial.** Export and delete exist (`/api/export`, deletion keeps bookings with money due). No correction flow beyond editing, no nominee right, no stated retention periods | S1 |
| 1.5 | Reasonable security safeguards, breach notice to the Board and each affected person | **Gap.** No TLS, open CORS, mock OTP, no breach runbook, no encryption at rest, no log redaction check | S1 |
| 1.6 | Children (under 18) need verifiable parental consent; no tracking or targeted ads | **Review.** Couples enter guest lists that may include minors. The couple's own personal or domestic use is exempt (*verify*), but the platform must not profile or message them | S1 |
| 1.7 | Cross-border transfer and log location | **Review.** Server in Germany. DPDP permits transfer except to restricted countries; CERT-In Directions 2022 want ICT logs kept in India for 180 days (*verify*) | S1 |
| 1.8 | Data processor contracts (hosting, SMS or WhatsApp provider, payment gateway) | **Gap.** None signed | S1 |
| 1.9 | Sensitive-by-nature data: community, religion, family details and wedding dates in the traditions features | **Review.** Keep optional, never use for ads or ranking, state purpose in notice | S1 |

### Unclaimed vendor listings (the 139 real businesses)

These are real businesses with public website contact details, imported with a source URL and a "Not on Shaadi OS yet" tag.
- Business data about a company is not personal data, but sole proprietors (a pandit, a mehndi artist) are individuals. DPDP excludes personal data the person themselves made publicly available (*verify scope*), which fits contact details taken from their own site.
- **Gaps:** there is no "remove or claim my listing" route anywhere in the app or site, no record of when each source page was read, and Instagram-only profiles were found via search snippets. Add a takedown/claim form and a 48-hour removal commitment; do not imply endorsement; keep `source_url` and a `fetched_at` date. Instagram and WhatsApp numbers must not be bulk-contacted from this list (see 5.1).

## 2. Payments and escrow (RBI)

- Collecting customer money and releasing it to vendors on milestones is a payment-aggregation or escrow activity. Under the RBI Payment Aggregator directions (*verify the 2025 update*) that needs an RBI authorisation or, far more practically, a **licensed PA's marketplace product** (for example Razorpay Route, Cashfree, PayU) with the PA holding funds in its escrow/nodal account.
- **Current state is simulated** (`/api/milestones/:id/pay` and `/release` only update rows), which is fine for a demo. **Gap (S2):** the app, terms and website still say "escrow" and "escrow-style payments". Do not use that word publicly, or show money as "held", until a licensed provider is live.
- Never store card, UPI PIN or bank credentials (correct today). Vendor KYC (PAN, bank verification) is done through the PA, not stored by Shaadi OS. Refunds, chargebacks and settlement timelines must follow the PA's rules (*verify*).
- Dispute resolution (the new admin screen) is an operational process; it must not move money itself, and the screen says so.

## 3. Tax (flag for a CA, all *verify*)

| # | Item | Status |
|---|---|---|
| 3.1 | Platform GST registration and GST (18%) on the commission, correct SAC (code `998599` is a draft) and a proper tax invoice (Rule 46) | Draft invoice only; carries "Draft for CA review" |
| 3.2 | **GST TCS under s.52 CGST** if the platform collects consideration for vendors' supplies (rate reduced to 0.5% in 2024, *verify*) and monthly GSTR-8 filing | Not applied |
| 3.3 | **Income-tax TDS on e-commerce participants (s.194-O)** on vendor payouts (rate reduced to 0.1% in 2024, *verify*) | Not applied |
| 3.4 | Whether wedding services fall under s.9(5) (platform liable for GST) | Likely not, but confirm |
| 3.5 | Vendor invoices to couples: vendors below the GST threshold need no GST, others do; the platform should not issue invoices for services it does not supply | Design question |
| 3.6 | Commission disclosure to couples and vendors before booking | Shown in the booking flow, needs terms wording |

## 4. Consumer protection and e-commerce

- **Consumer Protection (E-Commerce) Rules 2020** (marketplace duties, *verify applicability to services*): show each seller's legal name, address and contact; appoint a grievance officer (acknowledge within 48 hours, resolve within a month); no unfair trade practices; clear cancellation and refund terms; honest ratings and sort order. **Gap:** no seller legal details, refund/cancellation policy or grievance officer. Unclaimed listings show only public details, which is acceptable if labelled.
- **CCPA Dark Patterns Guidelines 2023:** avoid false urgency, forced consent and hidden costs. The new onboarding has none; keep it that way when adding offers.
- **Advertising and reviews (CCPA and ASCI):** "Verified" must mean something documented. Today `verified` is set by an admin click; define the check and record it. Reviews must come from real bookings and not be removed for being negative.
- Samples are labelled "Sample listing". Remove the fictional vendors before public launch (they are 12 of 151 in the live directory).
- Terms must state who contracts with whom: vendors are independent, Shaadi OS is an intermediary and its liability for vendor performance is limited by the terms (*lawyer*).

## 5. Intermediary and communications rules

| # | Item | Status | Stage |
|---|---|---|---|
| 5.1 | **IT (Intermediary Guidelines) Rules 2021:** publish rules, privacy policy and user agreement; grievance officer in India; remove unlawful content on notice; chat and photos are user content | Placeholders only | S1 |
| 5.2 | **Copyright in vendor photos:** the app requires a permission checkbox for portfolio links. Add a takedown address and a repeat-infringer policy for s.79 safe harbour | Partial | S1 |
| 5.3 | **CERT-In** incident reporting within 6 hours, 180-day log retention (*verify*) | **Gap.** No runbook | S1 |
| 5.4 | **TRAI DLT** registration of sender and templates once a real SMS OTP provider is added; WhatsApp Business policy and opt-in for any marketing | Not applicable until a provider is chosen | S1 |
| 5.5 | **Anti-spam:** no cold outreach to scraped numbers by SMS or WhatsApp (TCCCPR 2018, DND, DPDP) | Rule to keep | S1 |
| 5.6 | App stores' UGC rules need report and block tools and moderation for chat and reviews | **Gap.** No report or block | S3 |

## 6. Wedding-specific points

- **Aadhaar:** private entities may not collect or store Aadhaar numbers except through authorised routes. The registration-documents list only names the documents; never add an upload or number field for it.
- Marriage registration, Special Marriage Act notice periods and religion-specific rules in the traditions and organiser features are guidance, not legal advice: keep a visible "check with your local registrar or priest" line and a last-reviewed date on that content.
- **Dowry Prohibition Act 1961:** the gift and shagun tracker is fine as a record of gifts; do not add suggestions, categories or wording that could read as dowry.

## 7. Brand, IP and corporate

- **Trademark:** "Shaadi" is a well-known matrimonial brand (Shaadi.com). Run a clearance search and take a lawyer's view on "Shaadi OS" and "ShaadiOS" in classes 35, 41 and 45 before spending on a launch. This is the biggest brand risk in this register.
- Incorporate an entity (the data fiduciary, GST registrant and contracting party), register for GST, and hold the domain, store accounts and API keys in the company name.
- Vendor agreement (commission, payout timing, cancellation, indemnity) and couple terms are needed; the current `/terms` page is a placeholder.
- Third-party licences: fonts (Fraunces, OFL), icons (drawn in-house), npm dependencies. Run a licence report before release. The onboarding style follows a described design system (colours and shapes); no third-party logo, mascot or font was copied.

## 8. App-store requirements (S3)

- **Apple:** privacy policy URL in the listing and app, nutrition labels, in-app account deletion (guideline 5.1.1), UGC tools (1.2), no arbitrary HTTP loads without justification (remove the ATS exception and use HTTPS), and "Sign in with Apple" is not required for phone-number sign-in.
- **Google Play:** Data Safety form, account-deletion URL, a current target API level.
- Real services booked outside the app's own digital goods do not need in-app purchase, but check Apple 3.1.3(e) wording before launch.

## 9. What is already in place

Consent log table and marketing consent toggle; data export and account deletion that keep records with money due; chat hides phone numbers and UPI IDs until a booking exists; no card data stored; samples and unclaimed listings clearly labelled; public contact details carry their source; vendor photos need a permission confirmation; the server refuses `NODE_ENV=production` while auth and payments are mocked; money kept in integer paise; draft invoices flagged for CA review.

## 10. Suggested order

1. **This week (engineering):** set `ADMIN_PHONES` and `JWT_SECRET` on the server, remove the OTP hint, take a database backup routine, add a takedown/claim route for listings, add notice and consent at sign-up, replace placeholder contact addresses.
2. **Before pilot users (counsel and CA):** privacy policy, terms, vendor agreement, grievance officer, entity and GST, trademark search, breach and CERT-In runbook, HTTPS domain, processor contracts.
3. **Before real money:** licensed PA integration, TCS/TDS treatment and invoices signed off by a CA, refund and cancellation policy, remove all "escrow" wording that the provider does not support.
4. **Before store submission:** report and block tools, in-app deletion verified on device, store forms, licence report.
