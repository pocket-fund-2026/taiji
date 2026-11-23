# Security, breach and data-handling runbook

Working draft, 23 November 2026. Have counsel and a CA confirm the legal timelines marked *verify*.

## Server settings (set in the host environment, never in the app)

| Variable | Purpose | Live demo now |
|---|---|---|
| `ADMIN_PHONES` | Comma-separated admin mobile numbers. **There is no default admin.** Unset means nobody is admin | unset: admin disabled |
| `ADMIN_OTP` | Private sign-in code for the admin numbers (long and random). The public demo code never works for an admin number | unset |
| `JWT_SECRET` | Signing secret. If unset the server creates one once and keeps it in a private `.jwt-secret` file beside the database, so restarts keep sessions | auto-created file |
| `CORS_ORIGINS` | Extra browser origins allowed to call the API (apps send no Origin and always work; localhost is always allowed) | unset |
| `SHOW_OTP_HINT` | Set to `1` only in a private demo to return the demo code from `/api/auth/otp` | unset |
| `GRIEVANCE_OFFICER_NAME`, `GRIEVANCE_OFFICER_EMAIL`, `COMPANY_NAME`, `COMPANY_ADDRESS` | Shown on the policy pages. Until set, the pages say these will be published before launch | unset |

To enable an admin: set `ADMIN_PHONES=<your number>` and a long random `ADMIN_OTP=<secret>`, restart, then sign in with that number and the secret as the code.

## Incident response

1. **Contain:** stop the API process for the affected service (by PID, not `pkill`, because the host is shared), rotate `JWT_SECRET` by deleting `.jwt-secret` and restarting (this signs everyone out), and rotate `ADMIN_OTP`.
2. **Record:** write down when it was noticed, what data and which accounts, and keep `api.log` and the `audit` table.
3. **Report:** CERT-In within six hours of noticing a reportable incident (*verify*); the Data Protection Board and affected people as the DPDP Rules require once they commence (*verify*).
4. **Fix and review:** patch, restore from backup if needed, and add a regression test.

## Backups

Before any deploy, copy `shaadi.db` and `shaadi.db-wal` to `/root/backups/` (see `DEPLOY.md`). Test a restore before real customer data goes in. Keep backups no longer than needed and delete them with the data when retention ends.

## Retention (matches the privacy policy)

Account and plan data until the person deletes it; booking, invoice and payment records as tax law requires (*CA to confirm, up to eight years*); audit and security logs 180 days; grievances three years. Deleted accounts keep only records the law requires.

## Processors

Hosting (Hetzner, Germany). Not yet connected: SMS or WhatsApp sign-in provider and a licensed payment provider. A written data-processing agreement is needed with each before it receives personal data.

## Moderation

Reports, grievances and listing requests land in the admin inbox. Targets: acknowledge within 48 hours, resolve grievances within one month, act on unlawful-content notices promptly. Listing removals are permanent and recorded so a re-import cannot bring a business back.
