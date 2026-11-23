# Email

Shaadi OS sends mail through any SMTP server (Resend, SES, Postmark, SendGrid and Gmail/Workspace all offer SMTP).
Settings are in `deploy/mail.env.example`. With no settings the app sends nothing and nothing breaks.

## What is sent
| Email | Trigger | To |
|---|---|---|
| Grievance / listing-removal alert | public form submitted | `GRIEVANCE_OFFICER_EMAIL` |
| Acknowledgement with reference | same, when the sender gave an email | the sender |
| New enquiry | couple sends an enquiry | vendor (verified email only) |
| New quote | vendor sends a quote | couple (verified email only) |
| Booking confirmed / new booking | quote accepted | couple and vendor |
| Payment held / payout released | escrow milestone paid / released | vendor |
| Wedding invitation with RSVP link | `POST /api/guests/:id/email-invite` or `POST /api/invite/email-all` | guest (max once a day each) |
| Verify your email | `POST /api/me/email` | the address being added |
| Sign-in code | `POST /api/auth/email-otp` (only if `EMAIL_OTP_ENABLED=1`) | verified account email |

## Safety rules built in
- Account notifications go only to an address the user has verified with a one-time code.
- Codes: 6 digits, stored only as a salted hash, valid 10 minutes, single use, dead after 5 wrong tries.
- Email sign-in returns the same answer for known and unknown addresses, never works for admin numbers, and is off by default.
- At most 8 emails an hour to any one recipient. The mail log (`email_outbox`) keeps recipient, subject, template and outcome, never the body.
- A mail failure never fails the request that triggered it.

## App changes still needed (iOS / Android release)
The API accepts `email` on guests (`POST /api/guests`, `PATCH /api/guests/:id`) and has the verify endpoints above, but the app screens
to enter and verify an email, and the "email invite" buttons, are not built yet.
