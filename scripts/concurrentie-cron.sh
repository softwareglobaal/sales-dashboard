#!/bin/sh
# Concurrentiemonitor Energie — dagelijkse controle van de concurrentiesites.
#
# Crontab op de server (UTC), na de Pipedrive-sync en vóór de werkdag in Suriname:
#   30 5 * * * /home/ubuntu/appportal/sales/scripts/concurrentie-cron.sh >> /home/ubuntu/concurrentie.log 2>&1
#
# Per run worden de 90 domeinen gecontroleerd die het langst geleden gemeten zijn.
# Met ~360 domeinen is de hele lijst dus elke vier dagen rond, en blijft één run
# ruim binnen de tijdslimiet van de route.
set -eu

URL="${DASHBOARD_URL:-http://localhost:3008}/api/concurrentie?limiet=90"

antwoord=$(curl -sS --max-time 3000 "$URL" || echo '{"ok":false,"fout":"curl faalde"}')
echo "$(date -Is) $antwoord"

# Niet-nul afsluiten als de run mislukt is, zodat cron-mail/log het opmerkt.
echo "$antwoord" | grep -q '"ok":true' || exit 1
