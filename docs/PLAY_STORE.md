# Google Play release notes

Everything needed to submit Shaadi OS to Google Play. Facts here match the code at the time of writing; re-check anything that changed.

## Build
- Package: `com.shaadios.app`. Upload an **Android App Bundle** (`.aab`), not the `.apk`.
- Build on the server (see the build guide): `npx expo prebuild -p android --clean`, `python3 scripts/android-post-prebuild.py`, then `cd android && ./gradlew bundleRelease`.
- Output: `android/app/build/outputs/bundle/release/app-release.aab`.
- Every upload needs a higher `android.versionCode` in `app/app.json` than the last one.
- Turn on **Play App Signing** in the console and use the project's `release.jks` as the **upload key**. Back the keystore and its password up somewhere other than the server.
- Permissions are limited to internet and vibrate. Overlay, storage, camera and microphone are blocked in `app.json`.
- Only `arm64-v8a` is built. That covers current phones; 32-bit-only devices are not supported.

## Store listing (draft)
**App name:** Shaadi OS: Wedding Planner
**Short description (80):** Plan your Indian wedding: checklist, budget, guests and vendors in one place.
**Full description:**
Shaadi OS helps Indian couples and families plan a wedding in one place, with no account needed to start.

PLAN WITHOUT AN ACCOUNT
- Enter your date, city, budget and traditions to get a checklist timed to your wedding day
- See your budget split across venue, catering, photography, decor and more, and track what you have spent
- Keep a guest list with the number of people in each family
- Your plan stays on your phone. Create a free account later to back it up and share it with family

FIND VENDORS
- Browse photographers, makeup artists, mehndi artists, decor, venues, caterers, DJs and pandits in Mumbai, Pune, Nashik and Nagpur
- Compare vendors side by side and see starting prices
- Send enquiries and get quotes (with an account)

FOR VENDORS
- Set up a storefront, manage enquiries and quotes, and keep your calendar

Available in English, Hindi, Marathi, Tamil, Telugu, Bengali, Gujarati, Punjabi, Kannada and Malayalam (some newer screens are still English only).

## Graphics still to make
- App icon 512x512 (use `app/assets/brand-icon-v3.png`)
- Feature graphic 1024x500
- At least 4 phone screenshots (welcome, Discover, vendor, plan checklist)

## Data safety form (answers)
- **Data collected, only when the person creates an account:** name, email address, phone number (optional), and the wedding details, guest list and messages they enter.
- **Collected without an account:** none. The no-account planner stays on the device.
- **Shared with third parties:** none. Email is sent through the mail provider purely to deliver sign-in codes.
- **Encrypted in transit:** yes (HTTPS).
- **Users can request deletion:** yes, inside the app (Profile, privacy, delete my data) and through the grievance page.
- **Ads / advertising ID:** none.

## Other console forms
- Privacy policy URL: `https://46-225-26-58.sslip.io/privacy` (move to a real domain before launch).
- Content rating: no violence, no gambling, no user-to-user public content. Answer the questionnaire as a lifestyle/planning app.
- Target audience: 18 and over.
- **App access:** give Google a test login. Set `REVIEW_EMAIL` and a 6-digit `REVIEW_OTP` on the server so the reviewer signs in with that email and code and no mail is sent.
- Financial features: payments and escrow are **not live**. Do not describe them in the listing.

## Before you submit
- Real sign-in must be on (Resend set up, `EMAIL_OTP_ENABLED=1`). Phone sign-in accepts a fixed demo code; set `PHONE_LOGIN=off` once email works and existing phone users have added an email.
- Listings: 139 are sample entries and 12 are real businesses that have not joined. Decide how to present both, or Play may flag the listing as misleading.
- Move off the `sslip.io` address to a domain you own.
- Get the legal pages (terms, privacy, refunds) reviewed.
