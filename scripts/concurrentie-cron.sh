#!/bin/sh
# Concurrentiemonitor — dagelijkse controle van de concurrentiesites.
# Bedient beide markten: Energie (EPB) en Engineering (stabiliteit). De crawl is
# marktloos; alleen de positiemeting gaat per markt, omdat het SERP-quotum
# gedeeld wordt.
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
# Posities: het gratis SerpApi-quotum is 250 zoekopdrachten per maand voor beide
# markten samen. Energie wekelijks op 30 termen (~130 per maand), Engineering om
# de twee weken op 15 termen (~30 per maand). Samen blijft dat onder het quotum.
if [ "$(date +%u)" = "1" ]; then
  echo "$(date -Is) posities energie"
  roep '/api/zoekwoorden?markt=energie&posities=1&limiet=30' || echo '{"ok":false}'

  # Even weeknummer: dan is het om de twee weken.
  if [ "$(( $(date +%V) % 2 ))" = "0" ]; then
    echo "$(date -Is) posities engineering"
    roep '/api/zoekwoorden?markt=engineering&posities=1&limiet=15' || echo '{"ok":false}'
  fi
fi
if [ "$(date +%d)" = "01" ]; then
  echo "$(date -Is) zoekvolumes"
  roep '/api/zoekwoorden?markt=energie&volumes=1' || echo '{"ok":false}'
  roep '/api/zoekwoorden?markt=engineering&volumes=1' || echo '{"ok":false}'
fi

# Niet-nul afsluiten als de crawl mislukte, zodat het opvalt in de log.
echo "$antwoord" | grep -q '"ok":true' || exit 1
exit 0
