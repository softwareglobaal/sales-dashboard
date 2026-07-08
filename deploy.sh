#!/bin/sh
# Auto-deploy Sales-dashboard (cron, elke 2 min):
#   */2 * * * * /home/ubuntu/appportal/sales/deploy.sh >> /home/ubuntu/deploy-sales.log 2>&1
# Nieuwe commits op main -> pull + rebuild van de compose-service.
set -eu
cd "$(dirname "$0")"

git fetch --quiet origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] && exit 0

git checkout -qf main
git reset --hard -q origin/main
cd ~/appportal
docker compose up -d --build app-sales
echo "$(date -Is) deployed $(git -C ~/appportal/sales rev-parse --short HEAD)"
