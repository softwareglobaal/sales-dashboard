# Concurrentiemonitor aanzetten

De module draait al zonder externe koppelingen: de sitecrawl werkt en heeft niets
nodig. Drie bronnen maken het beeld compleet. Alle drie zijn gratis; de enige
stappen die overblijven kan alleen jij zetten, omdat er ergens ingelogd moet worden.

Op de pagina's `/energy/concurrentie`, `/engineering/concurrentie` en
`/h-architects/concurrentie` staat bovenaan een rij met vier bolletjes:
groen = gekoppeld, grijs = ontbreekt nog. Daar zie je altijd de actuele stand.

**Drie markten, één motor.** Energie (EPB, ventilatie), Engineering (stabiliteit) en
Architectuur (H-Architects) delen de crawl en de koppelingen. Wat per markt verschilt
zijn de zoektermen (`config/zoekwoorden-<markt>.json`) en de vraag welke bedrijven
meespelen. De API-routes nemen daarvoor `?markt=energie`, `?markt=engineering` of
`?markt=architectuur`.

**Twee registers.** Energie steunt op het VEKA-register
(`data-bronnen/verslaggevers-2026-08.json`, 792 erkenningen), Architectuur op het
ledenregister van de Orde van Architecten
(`data-bronnen/architecten-orde-2026-09.json`, 11.965 inschrijvingen — zie
`data-bronnen/README-architecten.md`). Engineering heeft er geen en wordt van onderaf
opgebouwd. Allebei die registers lees je in met
`/api/concurrentie?import=1&limiet=0`; verversen doe je met de hand, want ze komen niet
uit een API die wij mogen bevragen.

---

## 1. Zoekvolume — Google Ads Keyword Planner

**Wat het oplevert:** hoeveel mensen er per maand op elke term zoeken. Zonder dit
weet je niet of "EPB verslaggever Genk" tien of duizend keer per maand gezocht wordt,
of "architect Diest" bestaat als zoekopdracht.

**Wat er nodig is:** niets nieuws. De koppeling gebruikt dezelfde OAuth-client als
de advertentiesync, en valt voor het klantnummer terug op het eerste account uit
`config/ads.json` (UNABO). `GOOGLE_ADS_LOGIN_CUSTOMER_ID` is namelijk leeg op de
server -- ook de advertentiesync draait op het nummer uit dat configbestand.
Wil je een ander account gebruiken, zet dan `GOOGLE_ADS_KEYWORD_CUSTOMER_ID`.

**Status:** getest en werkend op 26/08/2026. Google normaliseert nauwe varianten
("EPB verslaggever" valt samen met "EPB verslaggeving") en geeft geen volume terug
voor termen onder de meetdrempel; 24 van de 48 termen hebben daardoor een cijfer.

**Uitvoeren:** op de server, waar de Google-sleutels staan:

```
curl "http://localhost:3008/api/zoekwoorden?volumes=1"
```

Daarna maandelijks automatisch via de cron.

**Let op:** Google trekt API-versies na ongeveer een jaar in. Een ingetrokken versie
geeft HTML in plaats van JSON. Dat heeft de advertentiesync twaalf dagen stilgelegd
zonder foutmelding. Bij zo'n fout: `GOOGLE_ADS_API_VERSION` ophogen.

---

## 2. Onze eigen posities — Google Search Console

**Wat het oplevert:** de echte cijfers van Google zelf over onze sites: gemiddelde
positie, vertoningen en klikken per zoekterm. Dit is geen schatting maar registratie,
en het is gratis. Beperking: alleen onze eigen domeinen.

**Voorwaarden:**
1. Eigenaarschap van `energie-efficient.be` en `unabo.be` bevestigd in Search Console.
2. De Search Console API aan in hetzelfde Google Cloud-project als de Ads-koppeling.
3. Bij de OAuth-client in Google Cloud (APIs & Services → Credentials):
   - is de client van het type **Desktop app**, dan werkt elke localhost-poort meteen;
   - is het een **Web application**, voeg dan deze exacte redirect-URI toe:
     `http://localhost:53682/oauth2callback`

**Toegang verlenen** (eenmalig, duurt een minuut):

```
node scripts/gsc-auth.mjs
```

Het script start kort een webservertje op localhost, toont een Google-link en vangt de
code zelf op zodra je bevestigt — je hoeft niets over te typen. Je krijgt een
`GSC_REFRESH_TOKEN`. Zet die zelf in `.env.local` en in `~/appportal/.env` op de server.
**Geef dat token aan niemand door, ook niet in een chat.**

> Werkte dit eerder niet? Google heeft de oude methode waarbij je een code moest
> overtypen (`urn:ietf:wg:oauth:2.0:oob`) op 31 januari 2023 uitgeschakeld. Die geeft
> sindsdien altijd "Error 400: invalid_request". Het script gebruikt nu de
> loopback-methode die Google wél ondersteunt.

**Controleren:**

```
curl "http://localhost:3008/api/searchconsole?check=1"
```

Zie je je properties in de lijst, dan is het klaar. Daarna dagelijks via de cron.

---

## 3. Posities van concurrenten — SerpApi

**Wat het oplevert:** de echte top 10 in Google per zoekterm. Dat is het leaderboard
bovenaan de pagina: wie staat er boven ons, en op welke termen.

**Waarom niet rechtstreeks bij Google:** Google verbiedt automatisch uitlezen van
zoekresultaten en blokkeert het ook. Dat is dezelfde muur waar onze eigen crawler bij
Macobo en Impact-SB tegenaan loopt. Wij omzeilen zulke blokkades niet.

**Wat er nodig is:** een gratis SerpApi-account. Het gratis maandquotum (100 à 250
zoekopdrachten) volstaat voor onze 48 termen. Wekelijks meten komt op ongeveer 207
zoekopdrachten per maand; past dat niet in het quotum, zet de meting dan op maandelijks.

**Instellen:** zet de sleutel in `.env.local` en in `~/appportal/.env`:

```
SERPAPI_KEY=...
```

**Uitvoeren:**

```
curl "http://localhost:3008/api/zoekwoorden?markt=energie&posities=1&limiet=30"
curl "http://localhost:3008/api/zoekwoorden?markt=engineering&posities=1&limiet=15"
curl "http://localhost:3008/api/zoekwoorden?markt=architectuur&posities=1&limiet=15"
```

Daarna via de cron: Energie elke maandag, Engineering de maandag van de even weken,
Architectuur de maandag van de oneven weken. Het gratis quotum is 250 zoekopdrachten per
maand **voor alle drie de markten samen** — vandaar de limieten. Samen komt dat op
ongeveer 190 per maand, met marge voor een handmatige meting tussendoor. Wie er meer uit
wil halen, verhoogt niet de limiet maar schrapt termen die toch niets opleveren (zie de
intentie `vacature`).

**Alternatief:** DataForSEO is per zoekopdracht goedkoper (0,0006 dollar, dus 12
dollarcent per maand voor onze lijst) maar vraagt 50 dollar vooruitbetaling. Werkt ook:
zet dan `DATAFORSEO_LOGIN` en `DATAFORSEO_PASSWORD`. Staat er een SerpApi-sleutel, dan
krijgt die voorrang.

---

## Ritme

`scripts/concurrentie-cron.sh` regelt alles:

| Wat | Wanneer |
|---|---|
| 250 concurrentsites hercrawlen | dagelijks (volledige lijst in ruim een week rond) |
| Search Console ophalen | dagelijks |
| Posities meten — Energie (30 termen) | maandag |
| Posities meten — Engineering (15 termen) | maandag van de even weken |
| Posities meten — Architectuur (15 termen) | maandag van de oneven weken |
| Zoekvolumes ophalen (alle markten) | de eerste van de maand |

Waarom 250 en niet 90: met het architectenregister erbij staan er een paar duizend
domeinen in de lijst in plaats van 360. Op 90 per dag zou een site nog maar een paar keer
per jaar gemeten worden, en dan meet je geen verandering meer.

Na een crawl of een herberekening deelt de app de domeinen zelf opnieuw in bij een markt.
Handmatig kan dat met `/api/concurrentie?markten=1`; `?herbereken=1` leidt bovendien de
pagina-tellingen opnieuw af uit de opgeslagen URL's, zonder één site te bezoeken.

Crontab op de server:

```
30 5 * * * /home/ubuntu/appportal/sales/scripts/concurrentie-cron.sh >> /home/ubuntu/concurrentie.log 2>&1
```

Het script roept de routes aan met `docker exec`, niet met `curl`. De app luistert
op poort 3008 *binnen* de container en die poort is niet naar de host gepubliceerd —
nginx praat via het docker-netwerk. Vanaf de host is `http://localhost:3008` dus
onbereikbaar.
