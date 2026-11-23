# Deploying the demo server

Server: `root@46.225.26.58`, code in `/root/shaadi-os/api`, API on port 4600 (bare `tsx` process, no supervisor) behind Caddy, which serves `https://46-225-26-58.sslip.io` with an automatic Let's Encrypt certificate (`/etc/caddy/Caddyfile`, firewall allows 80 and 443). Start it with `sh /root/shaadi-os/start.sh`, which reads `/root/shaadi-os/api/.env` (see `deploy/legal.env.example`). Log at `/root/shaadi-os/api.log`. Replace the sslip.io name with your own domain when you have one (see `deploy/Caddyfile`). The server is shared with other projects: never use `pkill`; stop only this app's PIDs (`ss -ltnp | grep :4600`).

1. Back up: `ssh root@46.225.26.58 'cd /root && tar czf backups/shaadi-os-pre-deploy-$(date +%F-%H%M).tgz --exclude=node_modules shaadi-os'`
2. Sync code, never the database: `rsync -a --exclude node_modules --exclude 'shaadi.db*' --exclude public --exclude .DS_Store api/ root@46.225.26.58:/root/shaadi-os/api/` and the two vendor CSVs to `/root/shaadi-os/`.
3. Optionally smoke-test first on port 4601 with a copy of the DB (`DB_PATH=/tmp/stage.db PORT=4601`).
4. Import vendors (idempotent): `cd /root/shaadi-os/api && node src/import-listings.ts ../vendor-prospects.csv ../vendor-contacts.csv`
5. Restart: kill the old PIDs, then `PORT=4600 setsid nohup npx tsx src/server.ts >> /root/shaadi-os/api.log 2>&1 < /dev/null &`
6. Web app: `cd app && npx expo export --platform web --output-dir <tmp>` then `rsync -a --delete <tmp>/ root@46.225.26.58:/root/shaadi-os/api/public/app/`
7. iPhone: see IOS-INSTALL.md; build with `EXPO_PUBLIC_API_URL=http://46.225.26.58:4600` and `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`.
