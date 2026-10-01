#!/usr/bin/env bash
# Livegang ronde 2 (spec §17b). Op de server draaien NA de merge van de sales-dashboard-PR
# en van facturatiecontrole koppeling-kanaal. Idempotent, met reservekopieën.
set -euo pipefail
AP=~/appportal
FC=~/facturatiecontrole
STEMPEL=$(date +%Y%m%d-%H%M%S)

echo "1. Facturatiecontrole bijwerken (kanaal bij elk gat)"
(cd "$FC" && git pull --ff-only && docker compose up -d --force-recreate)

echo "2. app-sales krijgt het agendatoken (meetings per deal)"
for v in GOOGLE_AGENDA_CLIENT_ID GOOGLE_AGENDA_CLIENT_SECRET GOOGLE_AGENDA_REFRESH_TOKEN; do
  grep -q "^$v=" "$AP/.env" || { echo "   $v ontbreekt in $AP/.env"; exit 1; }
done
if ! grep -q 'GOOGLE_AGENDA_REFRESH_TOKEN' "$AP/docker-compose.override.yml"; then
  cp "$AP/docker-compose.override.yml" "$AP/docker-compose.override.yml.bak-$STEMPEL-ronde2"
  python3 - "$AP/docker-compose.override.yml" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
anker = "      FACTURATIE_URL: ${FACTURATIE_URL:-}\n"
assert s.count(anker) == 1, "anker FACTURATIE_URL niet (uniek) gevonden"
extra = ("      # Meetings per deal (spec §17b): leest de agenda's, schrijft er niet in.\n"
         "      GOOGLE_AGENDA_CLIENT_ID: ${GOOGLE_AGENDA_CLIENT_ID:-}\n"
         "      GOOGLE_AGENDA_CLIENT_SECRET: ${GOOGLE_AGENDA_CLIENT_SECRET:-}\n"
         "      GOOGLE_AGENDA_REFRESH_TOKEN: ${GOOGLE_AGENDA_REFRESH_TOKEN:-}\n")
open(p, "w").write(s.replace(anker, anker + extra))
PY
fi
(cd "$AP" && docker compose up -d app-sales)
sleep 8

echo "3. Eerste lezing van de agenda (de personen komen bij de volgende sync)"
docker exec appportal-app-sales-1 node -e 'console.log("   GOOGLE_AGENDA gezet:", !!process.env.GOOGLE_AGENDA_REFRESH_TOKEN)'
echo
echo "Klaar. De volgende uurlijkse sync leest de contactpersonen (naam, e-mail) van de vier"
echo "accounts en koppelt daarna de agenda-afspraken aan deals."
