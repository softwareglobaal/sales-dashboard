# Concurrentiemonitor aanzetten

De module draait al zonder externe koppelingen: de sitecrawl van alle 360 domeinen
werkt en heeft niets nodig. Drie bronnen maken het beeld compleet. Alle drie zijn
gratis; de enige stappen die overblijven kan alleen jij zetten, omdat er ergens
ingelogd moet worden.

Op de pagina `/energy/concurrentie` staat bovenaan een rij met vier bolletjes:
groen = gekoppeld, grijs = ontbreekt nog. Daar zie je altijd de actuele stand.

---

## 1. Zoekvolume — Google Ads Keyword Planner

**Wat het oplevert:** hoeveel mensen er per maand op elke term zoeken. Zonder dit
weet je niet of "EPB verslaggever Genk" tien of duizend keer per maand gezocht wordt.

**Wat er nodig is:** niets nieuws. De koppeling gebruikt dezelfde OAuth-client als
de advertentiesync. Vereist wel dat `GOOGLE_ADS_LOGIN_CUSTOMER_ID` gevuld is
(of `GOOGLE_ADS_KEYWORD_CUSTOMER_ID` als je een ander account wil gebruiken).

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
3. Bij de OAuth-client moet `urn:ietf:wg:oauth:2.0:oob` of `http://localhost` als
   redirect toegestaan zijn.

**Toegang verlenen** (eenmalig, duurt een minuut):

```
node scripts/gsc-auth.mjs
```

Het script toont een link, jij logt in bij Google en plakt de code terug. Je krijgt
een `GSC_REFRESH_TOKEN`. Zet die zelf in `.env.local` en in `~/appportal/.env` op de
server. **Geef dat token aan niemand door, ook niet in een chat.**

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
curl "http://localhost:3008/api/zoekwoorden?posities=1"
```

Daarna wekelijks (maandag) via de cron.

**Alternatief:** DataForSEO is per zoekopdracht goedkoper (0,0006 dollar, dus 12
dollarcent per maand voor onze lijst) maar vraagt 50 dollar vooruitbetaling. Werkt ook:
zet dan `DATAFORSEO_LOGIN` en `DATAFORSEO_PASSWORD`. Staat er een SerpApi-sleutel, dan
krijgt die voorrang.

---

## Ritme

`scripts/concurrentie-cron.sh` regelt alles:

| Wat | Wanneer |
|---|---|
| 90 concurrentsites hercrawlen | dagelijks (volledige lijst elke 4 dagen rond) |
| Search Console ophalen | dagelijks |
| Posities meten | maandag |
| Zoekvolumes ophalen | de eerste van de maand |

Crontab op de server:

```
30 5 * * * /home/ubuntu/appportal/sales/scripts/concurrentie-cron.sh >> /home/ubuntu/concurrentie.log 2>&1
```
