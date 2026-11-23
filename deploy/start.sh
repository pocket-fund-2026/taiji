#!/bin/sh
# Starts the API with the settings in /root/shaadi-os/api/.env (see deploy/legal.env.example). Stop the old process by PID first (never pkill: the host is shared).
cd /root/shaadi-os/api || exit 1
set -a; [ -f .env ] && . ./.env; set +a
PORT="${PORT:-4600}" setsid nohup npx tsx src/server.ts >> /root/shaadi-os/api.log 2>&1 < /dev/null &
