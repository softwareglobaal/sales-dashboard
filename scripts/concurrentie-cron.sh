#!/bin/sh
# Concurrentiemonitor Energie — dagelijkse controle van de concurrentiesites.
#
# Crontab op de server:
#   30 5 * * * /home/ubuntu/appportal/sales/scripts/concurrentie-cron.sh >> /home/ubuntu/concurrentie.log 2>&1
#
# De app luistert op poort 3008 *binnen* de container; die poort is niet naar de
# host gepubliceerd (nginx praat via het docker-netwerk). Vanaf de host is
# http://localhost:3008 dus onbereikbaar, en daarom roepen we de routes aan met
# docker exec in plaats van met curl.
#
# Per run worden de 90 domeinen gecontroleerd die het langst geleden gemeten
# zijn; met ~360 domeinen is de hele lijst zo elke vier dagen rond.
set -eu

CONTAINER="${APPPORTAL_SALES_CONTAINER:-appportal-app-sales-1}"

roep() {
  docker exec -e PAD="$1" "$CONTAINER" node -e '
    fetch("http://127.0.0.1:3008" + process.env.PAD)
      .then(r => r.text())
      .then(t => console.log(t.slice(0, 600)))
      .catch(e => { console.log(JSON.stringify({ ok: false, fout: e.message })); process.exit(1); })
  '
}

echo "$(date -Is) crawl"
antwoord="$(roep '/api/concurrentie?limiet=90')" || antwoord='{"ok":false,"fout":"docker exec faalde"}'
echo "$antwoord"

# Search Console: dagelijks. Gratis, en de enige bron die geen schatting is.
echo "$(date -Is) search console"
roep '/api/searchconsole?dagen=28' || echo '{"ok":false}'

# Posities wekelijks (maandag), zoekvolumes maandelijks (de eerste).
# Beide zijn no-ops zolang de betreffende bron niet gekoppeld is.
if [ "$(date +%u)" = "1" ]; then
  echo "$(date -Is) posities"
  # Beperkt tot de 30 termen met het meeste volume: het gratis SerpApi-quotum is
  # 250 zoekopdrachten per maand, en 48 termen wekelijks zou daar overheen gaan.
  roep '/api/zoekwoorden?posities=1&limiet=30' || echo '{"ok":false}'
fi
if [ "$(date +%d)" = "01" ]; then
  echo "$(date -Is) zoekvolumes"
  roep '/api/zoekwoorden?volumes=1' || echo '{"ok":false}'
fi

# Niet-nul afsluiten als de crawl mislukte, zodat het opvalt in de log.
echo "$antwoord" | grep -q '"ok":true' || exit 1
exit 0
