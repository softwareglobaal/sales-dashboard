#!/usr/bin/env bash
# Livegang herinrichting sales-dashboard (spec §17). Draaien OP DE SERVER, na:
#   1. merge van sales-dashboard PR "Herinrichting per dienst" naar main (deploy.sh bouwt app-sales);
#   2. merge van facturatiecontrole PR #1 "Koppeling met het sales-dashboard".
# Idempotent: opnieuw draaien kan geen kwaad. Maakt van elk gewijzigd bestand een reservekopie.
set -euo pipefail

AP=~/appportal
FC=~/facturatiecontrole
STEMPEL=$(date +%Y%m%d-%H%M%S)

echo "0. Staat de nieuwe code er?"
cd "$FC" && git pull --ff-only
grep -q "api/koppeling/sales" "$FC/server.py" || { echo "   facturatiecontrole heeft de koppeling nog niet (PR #1 gemerged?)"; exit 1; }
[ -f "$AP/sales/config/afdelingen.json" ] || { echo "   sales-dashboard heeft config/afdelingen.json nog niet (PR gemerged? deploy.sh klaar?)"; exit 1; }

echo "1. Gedeeld geheim en adres in $AP/.env"
if ! grep -q '^KOPPELING_TOKEN=' "$AP/.env"; then
  echo "KOPPELING_TOKEN=$(openssl rand -hex 32)" >> "$AP/.env"
fi
grep -q '^FACTURATIE_URL=' "$AP/.env" || echo "FACTURATIE_URL=http://app-facturatiecontrole:8080" >> "$AP/.env"
grep -q '^MONDAY_API_TOKEN=' "$AP/.env" || { echo "   MONDAY_API_TOKEN ontbreekt in $AP/.env"; exit 1; }
TOKEN=$(grep '^KOPPELING_TOKEN=' "$AP/.env" | tail -1 | cut -d= -f2-)

echo "2. Zelfde geheim in $FC/.env (niet in git, niet in site/ dus niet te downloaden)"
umask 077
printf 'KOPPELING_TOKEN=%s\n' "$TOKEN" > "$FC/.env"

echo "3. app-sales krijgt MONDAY_API_TOKEN, KOPPELING_TOKEN en FACTURATIE_URL"
if ! grep -q 'KOPPELING_TOKEN' "$AP/docker-compose.override.yml"; then
  cp "$AP/docker-compose.override.yml" "$AP/docker-compose.override.yml.bak-$STEMPEL-herinrichting"
  python3 - "$AP/docker-compose.override.yml" <<'EOF'
import sys
p = sys.argv[1]
s = open(p).read()
anker = "      SALES_AGENT_TOKEN: ${SALES_AGENT_TOKEN:-}\n"
assert s.count(anker) == 1, "anker SALES_AGENT_TOKEN niet (uniek) gevonden in app-sales"
extra = (
    "      # Herinrichting (spec §17): Monday-bord Projects-EE en de koppeling met\n"
    "      # facturatiecontrole. Zelfde valkuil als Google Ads: wat hier niet staat,\n"
    "      # bereikt de app nooit.\n"
    "      MONDAY_API_TOKEN: ${MONDAY_API_TOKEN:-}\n"
    "      KOPPELING_TOKEN: ${KOPPELING_TOKEN:-}\n"
    "      FACTURATIE_URL: ${FACTURATIE_URL:-}\n"
)
open(p, "w").write(s.replace(anker, anker + extra))
EOF
fi

echo "4. app-facturatiecontrole krijgt KOPPELING_TOKEN"
if ! grep -q 'KOPPELING_TOKEN' "$FC/docker-compose.yml"; then
  cp "$FC/docker-compose.yml" "$FC/docker-compose.yml.bak-$STEMPEL-herinrichting"
  python3 - "$FC/docker-compose.yml" <<'EOF'
import sys
p = sys.argv[1]
s = open(p).read()
anker = '      PYTHONUNBUFFERED: "1"\n'
assert s.count(anker) == 1, "anker PYTHONUNBUFFERED niet (uniek) gevonden"
open(p, "w").write(s.replace(anker, anker + "      KOPPELING_TOKEN: ${KOPPELING_TOKEN:-}\n"))
EOF
fi

echo "5. Containers opnieuw starten"
(cd "$FC" && docker compose up -d)
(cd "$AP" && docker compose up -d app-sales)
sleep 8

echo "6. Controle"
docker exec appportal-app-sales-1 node -e '
fetch(process.env.FACTURATIE_URL + "/api/koppeling/sales", { headers: { "X-Koppeling-Token": process.env.KOPPELING_TOKEN } })
  .then(async (r) => { const j = await r.json(); console.log("   koppeling:", r.status, j.jaren || j.fout, (j.gaten || []).length + " gaten"); })
  .catch((e) => console.log("   koppeling faalt:", e.message));
console.log("   MONDAY_API_TOKEN gezet:", !!process.env.MONDAY_API_TOKEN);'
echo
echo "Watch Tower: de tegels van Architectuur, Regularisatie, 3D-Scanning, Plaatsbeschrijving, Safety"
echo "en Meetstaten staan lokaal op live. Vanaf de Mac: scp ~/Claude/watchtower/register.json ubuntu@54.80.98.233:~/watchtower/"
echo
echo "Klaar. De eerste sync (uurlijks, of de knop Data verversen) leest het Monday-bord en de"
echo "H-Architects-producten vanaf 2025 (~1.000 oproepen op het H-A-account, eenmalig)."
