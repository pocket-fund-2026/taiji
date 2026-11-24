#!/bin/bash
# Turns on email sign-in codes for Shaadi OS using Resend. Run on the server: /root/shaadi-os/set-mail.sh
# The API key is typed hidden and written only to /root/shaadi-os/api/.env (readable by root only).
set -e
ENV=/root/shaadi-os/api/.env
touch "$ENV"
echo "Shaadi OS email setup (Resend)"
read -rsp "Resend API key (typing is hidden): " KEY; echo
[ -n "$KEY" ] || { echo "No key entered. Nothing changed."; exit 1; }
read -rp "Sender, e.g. Shaadi OS <no-reply@yourdomain.com> (Resend must have verified that domain): " FROM
[ -n "$FROM" ] || { echo "No sender entered. Nothing changed."; exit 1; }
read -rp "Review login email for App Store / Play review (leave blank to skip): " REV
OTP=""
if [ -n "$REV" ]; then OTP=$(printf '%06d' $((RANDOM*RANDOM % 1000000))); fi
cp "$ENV" "$ENV.bak.$(date +%Y%m%d-%H%M%S)"
grep -v -E '^(SMTP_HOST|SMTP_PORT|SMTP_SECURE|SMTP_USER|SMTP_PASS|MAIL_FROM|EMAIL_OTP_ENABLED|REVIEW_EMAIL|REVIEW_OTP)=' "$ENV" > "$ENV.new" || true
{ cat "$ENV.new"
  echo "SMTP_HOST=smtp.resend.com"; echo "SMTP_PORT=465"; echo "SMTP_SECURE=true"; echo "SMTP_USER=resend"
  echo "SMTP_PASS=$KEY"; echo "MAIL_FROM=$FROM"; echo "EMAIL_OTP_ENABLED=1"
  if [ -n "$REV" ]; then echo "REVIEW_EMAIL=$REV"; echo "REVIEW_OTP=$OTP"; fi
} > "$ENV"
rm -f "$ENV.new"; chmod 600 "$ENV"
systemctl restart shaadi-os; sleep 3
echo "Server: $(systemctl is-active shaadi-os)"
echo "Sign-in methods now: $(curl -s localhost:4600/api/auth/methods)"
if [ -n "$REV" ]; then echo; echo "App review login -> email: $REV   code: $OTP   (write this down; it is stored only in $ENV)"; fi
echo
read -rp "Send a test sign-in code to which email? (blank to skip): " TO
if [ -n "$TO" ]; then curl -s -X POST localhost:4600/api/auth/email/start -H 'content-type: application/json' -d "{\"email\":\"$TO\"}"; echo; echo "Check that inbox (and spam)."; fi
