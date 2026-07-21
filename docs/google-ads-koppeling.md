# Google Ads-koppeling (SEO/SEA-tab)

Alles over de Google Ads-integratie: wat ze doet, hoe ze technisch werkt, welke
credentials nodig zijn en hoe je ze verkrijgt, en hoe je ze op de server (VM)
activeert. Opgezet in juli 2026.

---

## 1. Wat het doet

De **SEO/SEA-tab** (`/seo-sea`) toont de Google Ads-prestaties van **UNABO** naast
de echte aanvragen uit de UNABO-pipeline (Pipedrive). Concreet:

- **Overzicht** — advertentiekosten, klikken, CTR, gem. kost/klik, vertoningen,
  conversies + kost per conversie (periode-gefilterd).
- **Dekking & gap** — per dienst zichtbaar waar we ads draaien én welke diensten
  **géén ads** hebben (kandidaten voor een nieuwe campagne).
- **Rendement** — advertentiekosten & Google-conversies naast de **echte UNABO-leads
  en gewonnen deals**, met **kost per lead** per dienst.
- **Campagnes** — tabel met status, type, kosten, klikken, CTR, conversies en een
  **klikbare landingspagina** (final URL) per campagne.

> **Scope:** enkel **UNABO** adverteert momenteel (customer-id `1907613111`), voor
> **EPB (UNABO Energy)** en **Engineering (UNABO Stabiliteit)**. H-Architects heeft
> ook een Ads-account maar is bewust nog niet gekoppeld. TKN-Buro adverteert niet.
> Voor de lead-correlatie tellen **enkel UNABO-aanvragen** mee, niet TKN.

---

## 2. Architectuur (bestanden)

| Bestand | Rol |
|---------|-----|
| `lib/googleAds.ts` | Read-only Google Ads API-client: OAuth refresh-token → access-token, GAQL-search met paginering (API v21). |
| `lib/googleAdsConfig.ts` | Laadt `config/ads.json`; koppelt een campagne aan een dienst; checkt of alle env-variabelen aanwezig zijn (`adsConfigured()`). |
| `lib/adsSync.ts` | Haalt campagne-dimensies (+ landingspagina) en per-dag prestaties op naar SQLite. |
| `lib/adsQueries.ts` | Query's voor overzicht, campagnes, dekking en rendement (incl. lead-correlatie). |
| `config/ads.json` | Alle configuratie: account-koppeling, dienstencatalogus, matching-regels. |
| `app/seo-sea/page.tsx` | De SEO/SEA-tab. |
| `components/AdsCharts.tsx` | Grafieken (kost per dienst, kost per lead). |

**Database (nieuwe tabellen in `lib/db.ts`):**
- `ad_campaigns` — campagne-dimensies (naam, status, type, landingspagina, gekoppelde dienst).
- `ad_metrics_daily` — per-campagne, per-dag cijfers (kosten in micro's, klikken, vertoningen, conversies).

De sync draait mee met de gewone **"Data verversen"**-knop (side-effect in `lib/sync.ts`);
faalt de Google Ads-sync, dan blokkeert dat de Pipedrive-sync nooit.

---

## 3. De 5 credentials

Alle geheimen staan in `.env(.local)` (lokaal) of het env-bestand op de VM — **nooit in git**.

| Variabele | Wat | Waar vandaan |
|-----------|-----|--------------|
| `GOOGLE_ADS_CLIENT_ID` | OAuth-client | Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_ADS_CLIENT_SECRET` | OAuth-secret | idem |
| `GOOGLE_ADS_REFRESH_TOKEN` | Langlevende sleutel | eenmalige OAuth-login (zie §4) |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads API-token | Google Ads → Tools → API center (manager-account UNABO_Marketing) |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | Manager-id (**leeg laten**) | niet nodig: UNABO wordt rechtstreeks benaderd, niet via de manager |

> **Belangrijk:** `GOOGLE_ADS_LOGIN_CUSTOMER_ID` **leeg** laten. De accounts hangen
> niet als clients onder het manager-account; met een waarde erin faalt de API met
> `USER_PERMISSION_DENIED`. Zonder de header werkt de directe toegang wél.

---

## 4. Refresh token (opnieuw) verkrijgen

Nodig bij een nieuw account, ingetrokken toegang, of een verlopen token.

1. Zorg dat in Google Cloud Console de **Google Ads API** aanstaat en er een
   **OAuth-client van type "Desktop app"** bestaat (levert client-id + secret).
   Op het **OAuth consent screen** moet het Google-account (`unabo24@gmail.com`)
   als **test-user** staan.
2. Open in een browser (ingelogd als dat account) de login-link:
   ```
   https://accounts.google.com/o/oauth2/v2/auth?client_id=<CLIENT_ID>&redirect_uri=http://localhost&response_type=code&scope=https://www.googleapis.com/auth/adwords&access_type=offline&prompt=consent
   ```
3. Klik "Toestaan". De browser springt naar een pagina die **niet laadt**
   (`localhost geweigerd`) — dat is normaal. Kopieer de **`code=…`** uit de adresbalk.
4. Wissel de code om voor een refresh token:
   ```bash
   curl -s https://oauth2.googleapis.com/token \
     --data-urlencode "code=<CODE>" \
     --data-urlencode "client_id=<CLIENT_ID>" \
     --data-urlencode "client_secret=<CLIENT_SECRET>" \
     --data-urlencode "redirect_uri=http://localhost" \
     --data-urlencode "grant_type=authorization_code"
   ```
   De `refresh_token` in het antwoord is de waarde voor `GOOGLE_ADS_REFRESH_TOKEN`.

---

## 5. Configuratie — `config/ads.json`

Volledig config-gedreven; geen code nodig om diensten of koppelingen aan te passen.

- **`accounts`** — welk Pipedrive-account bij welk Google Ads customer-id hoort.
- **`catalog`** — alle diensten die UNABO aanbiedt (basis voor de gap-analyse). Per dienst:
  - `adMatch` / `urlMatch` — woorden om een **campagne** aan de dienst te koppelen
    (gedeeltelijke match op campagnenaam resp. landingspagina).
  - `pipelineMatch` — woorden om de **Pipedrive-leads** te vinden (gedeeltelijke match
    op de pipeline-naam). **Heeft voorrang** — betrouwbaarder dan producten.
  - `themeKey` — terugval als `pipelineMatch` leeg is: thema-match op de productnaam
    (verwijst naar `config/themes.json`).

**Voorbeeld — een dienst laten meetellen:** voeg een item toe aan `catalog` met de juiste
`pipelineMatch` (of `themeKey`) en `adMatch`. Draait er een campagne die op `adMatch` matcht,
dan verschijnt de dienst automatisch met zijn kosten en leads.

> **Te controleren op productie:** of de `pipelineMatch`-woorden (`"epb"`, `"engineering"`)
> exact overeenkomen met de échte UNABO-pipelinenamen. Zo niet: pas ze aan in dit bestand,
> geen code-wijziging nodig.

---

## 6. Op de server (VM) activeren

De VM draait als **docker-compose** stack in `~/appportal`; de app is de service
**`app-sales`**. Auto-deploy (`deploy.sh` via cron) pullt nieuwe commits van `main`
en herbouwt `app-sales`.

**Stappen:**
1. Zet de 5 `GOOGLE_ADS_*`-regels in het env-bestand op de VM — **hetzelfde bestand**
   waar de `PIPEDRIVE_TOKEN_*` en `ANTHROPIC_API_KEY` staan. `LOGIN_CUSTOMER_ID` leeg laten.
2. **Container opnieuw aanmaken** zodat hij het env-bestand herinleest (een gewone
   `restart` of "Data verversen" volstaat **niet**):
   ```bash
   cd ~/appportal
   docker compose up -d --force-recreate app-sales
   ```
   (Een nieuwe deploy van `main` doet dit ook automatisch.)
3. Verifiëren:
   ```bash
   docker compose exec app-sales printenv | grep GOOGLE_ADS   # moet 4 regels tonen
   ```
4. In het dashboard → **SEO/SEA-tab** → **"Data verversen"**.

---

## 7. Probleemoplossing

| Symptoom | Oorzaak / oplossing |
|----------|---------------------|
| "Google Ads nog niet gekoppeld" | Env-variabelen niet geladen. Het scherm toont per variabele ✓/✗. Zet ze in het juiste env-bestand en **maak de container opnieuw aan** (§6). |
| "Nog geen Google Ads-data" | Credentials oké, maar nog niet gesynct. Klik "Data verversen". |
| Rode foutbanner in de tab | Laatste sync gaf een API-fout; de melding staat erbij. |
| `USER_PERMISSION_DENIED` | `GOOGLE_ADS_LOGIN_CUSTOMER_ID` moet **leeg** zijn (§3). |
| Verlopen/ingetrokken token | Nieuw refresh token halen (§4). |

---

## 8. Beperkingen & aandachtspunten

- **Kost per lead** = advertentiekosten ÷ UNABO-leads voor die dienst in de periode.
  De lead-matching (pipeline/thema) is een eerste, configureerbare aanname — verifieer
  ze tegen de echte pipelinenamen na de eerste productie-sync.
- **Basic Access** op de developer-token volstaat voor dit rapportagegebruik; geen
  Standard Access nodig.
- **Ophaalvenster** van de sync: vanaf begin vorig jaar t/m vandaag (dekt alle periode-filters).
- **Landingspagina** per campagne = de final URL van de advertentie met de meeste vertoningen.
