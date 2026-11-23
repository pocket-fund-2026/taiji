# Shaadi OS: project context for Claude Code

Indian wedding marketplace + planning app (WedMeGood competitor). Couples book/pay vendors in-app with escrow milestones; vendors get free CRM/calendar/GST invoices; guests RSVP via link. Money is integer paise. Prices display in Indian format (₹4.5 L, ₹1.2 Cr).

## Layout
- `api/`  Node 22 + TypeScript, Express, `node:sqlite` (no native deps). `src/server.ts` (core), `src/extras.ts` (events, family, shortlist, calendar, CRM, invoices, disputes, admin, DPDP, invite site), `src/db.ts`, `src/seed.ts`. Serves the web build and APK from `api/public/`.
- `app/`  Expo (SDK 57) React Native + TypeScript. `App.tsx` navigation; `src/couple.tsx`, `src/vendor.tsx`, `src/more.tsx`, `src/auth.tsx`, `src/api.ts` (fetch + offline GET cache), `src/i18n.ts` (10 languages; `tr("English string")`), `src/ui.tsx`.
- The server address is set in `app/src/api.ts` (`DEFAULT_API`) and editable on the login screen. The demo API runs behind HTTPS (Caddy with a Let's Encrypt certificate); set the address at build time with `EXPO_PUBLIC_API_URL`. Plain HTTP is allowed only on the local network.

## Your task on this Mac: build and run the iOS app
1. `cd app && npm install`
2. `npx expo prebuild -p ios` (generates `ios/`, runs CocoaPods)
3. `open ios/*.xcworkspace`, then set Signing & Capabilities > Team to my Apple ID, and change bundle id `com.shaadios.app` if Xcode rejects it.
4. Build/run on my connected iPhone or simulator. From CLI: `npx expo run:ios --device`.
5. Fix any build errors you hit. The app talks HTTPS to the demo server; `app.json` allows plain HTTP only on the local network (`NSAllowsLocalNetworking`), and Android cleartext is off.

## Mocked on purpose (replace later, keep the interfaces)
- OTP is always `123456` (`/api/auth/verify`). Payments/escrow: `/api/milestones/:id/pay` and `/release`. WhatsApp = `wa.me` links. Do not wire real providers without my keys.
- Demo logins: any 10-digit number; vendor `9000000001`. There is no default admin: set `ADMIN_PHONES` and a private `ADMIN_OTP` (see `docs/SECURITY-RUNBOOK.md`).

## Rules
- Keep money in paise; never store card data. Flag GST/TCS/escrow/DPDP items for CA/lawyer review.
- Phone numbers/UPI IDs are blocked in chat until a booking exists (anti-leakage).
- Add UI strings through `tr()` and add translations in `i18n.ts`.
- Ask before adding paid third-party services. Keep changes small; run `npx tsc --noEmit` in `app/` before finishing.

## Not built yet
Vendor photos/video, AI search/budget, e-sign contracts, full admin dispute UI, guest gifting/albums, automated tests, HTTPS.
