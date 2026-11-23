# Browser walkthroughs

Playwright scripts that click through the real web build and report console errors and failed requests.
Run them against a local API (`cd api && PORT=4600 npx tsx src/server.ts`) and a served web export (`cd app && npx expo export --platform web --output-dir /tmp/web`, then serve that folder on the port the script expects). They use system Chrome and write screenshots to `shots/`. Install once with `npm i playwright-core` in this folder.

- `onboarding-walk.js`: first-run onboarding and the Discover home.
- `consent-walk.js`: sign-up with the Terms and Privacy checkbox.
- `features-walk.js`: couple and vendor tabs, report box, privacy section, storefront legal fields.
