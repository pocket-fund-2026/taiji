#!/bin/bash
# Turns on email sign-in codes for Shaadi OS using Resend. Run on the server.
#   Interactive (real terminal):  /root/shaadi-os/set-mail.sh
#   From your Mac without a terminal, key piped in so it never appears in a command line or chat:
#     pbpaste | ssh root@SERVER /root/shaadi-os/set-mail.sh --from "Shaadi OS <no-reply@yourdomain.com>" [--review you@example.com] [--test you@example.com]
# The API key is written only to /root/shaadi-os/api/.env (readable by root only).
set -e
ENV=/root/shaadi-os/api/.env
FROM=""; REV=""; TO=""
while [ $# -gt 0 ]; do case "$1" in
  --from) FROM="$2"; shift 2;; --review) REV="$2"; shift 2;; --test) TO="$2"; shift 2;; *) echo "Unknown option $1"; exit 2;; esac; done
if [ -t 0 ]; then
  read -rsp "Resend API key (typing is hidden): " KEY; echo
  [ -n "$FROM" ] || read -rp "Sender, e.g. Shaadi OS <no-reply@yourdomain.com>: " FROM
  [ -n "$REV" ] || read -rp "Review login email for app review (blank to skip): " REV
  [ -n "$TO" ] || read -rp "Send a test code to which email? (blank to skip): " TO
else
  IFS= read -r KEY || true
fi
KEY=$(printf '%s' "$KEY" | tr -d '[:space:]')
[ -n "$KEY" ] || { echo "No API key received. Nothing changed."; exit 1; }
case "$KEY" in re_*) ;; *) echo "That does not look like a Resend key (they start with re_). Nothing changed."; exit 1;; esac
[ -n "$FROM" ] || { echo "No sender given (--from). Nothing changed."; exit 1; }
OTP=""; if [ -n "$REV" ]; then OTP=$(printf '%06d' $(( (RANDOM*32768+RANDOM) % 1000000 ))); fi
touch "$ENV"; cp "$ENV" "$ENV.bak.$(date +%Y%m%d-%H%M%S)"
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
if [ -n "$REV" ]; then echo "App review login -> email: $REV   code: $OTP   (note it down; it is stored only in $ENV)"; fi
if [ -n "$TO" ]; then echo "Test code request: $(curl -s -X POST localhost:4600/api/auth/email/start -H 'content-type: application/json' -d "{\"email\":\"$TO\"}")"; echo "Check that inbox (and spam)."; fi
