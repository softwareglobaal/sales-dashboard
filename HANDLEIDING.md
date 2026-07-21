# Dashboard — Handleiding

Een dashboard dat de data van je 4 Pipedrive-accounts (H-Architects, UNABO, TKN-Buro, Energie Efficiënt) samenbrengt op één plek.

## Het dashboard openen

1. Open de **Terminal** (app op je Mac).
2. Plak deze regel en druk op Enter:
   ```
   cd "/Users/siyanopenclaw/claude code_siyan/pipedrive-dashboard" && npm run dev
   ```
3. Open je browser op **http://localhost:3000**

Het dashboard blijft draaien zolang de Terminal openstaat. Sluit je de Terminal, dan stopt het (gewoon stap 1-3 herhalen om opnieuw te starten).

> **Online versie:** het dashboard draait intussen ook op een server (VM), zodat het altijd
> bereikbaar is zonder je Mac. Vraag IT naar het adres. Nieuwe wijzigingen die naar de
> `main`-branch gaan, verschijnen daar automatisch (auto-deploy, binnen enkele minuten).

## Data verversen

Klik rechtsboven op **"↻ Data verversen"**. Dan haalt het de meest recente deals uit alle 4 de accounts op. De eerste keer of na lange tijd duurt dit ~20-30 seconden.

## Dashboards (menu links)

- **Algemeen** — alle sales over de 4 Pipedrive-accounts samen.
- **Engineering** — enkel UNABO Engineering + TKN-Buro, met analyse per dienst
  (meest verkocht, snelst verkocht, meeste aanvragen).
- **SEO / SEA** — de Google Ads-prestaties van UNABO (zie hieronder).

Later komen er meer afdelings-dashboards bij (Energy, Safety, …).

## SEO / SEA-tab (Google Ads)

Toont welke Google Ads-campagnes UNABO draait en hoe ze presteren, gekoppeld aan
de echte aanvragen in Pipedrive. Je vindt er:

- **Overzicht** — hoeveel je uitgeeft aan ads, klikken, doorklikratio (CTR), vertoningen
  en conversies (met kost per conversie).
- **Dekking & gap** — voor welke diensten je ads draait, en welke diensten **géén ads**
  hebben (handig om te zien waar je nog kan adverteren). UNABO adverteert nu voor
  **EPB (Energy)** en **Engineering (Stabiliteit)**.
- **Rendement** — presteren de ads? De advertentiekosten naast de **echte UNABO-leads en
  gewonnen deals**, met de **kost per lead** per dienst. (Enkel UNABO — TKN telt niet mee.)
- **Campagnes** — alle campagnes met kosten, klikken, CTR en een **klikbare link naar de
  landingspagina**, zodat je ziet wat de bezoeker te zien krijgt.

> De advertentiecijfers komen live uit Google Ads; de leads uit de UNABO-pipeline (Pipedrive).
> Met **"Data verversen"** haal je beide tegelijk op. Technische details (koppeling, credentials,
> server) staan in `docs/google-ads-koppeling.md`.

> **Toegang afschermen:** zolang dit lokaal op je Mac draait, ziet iedereen alles. Pas wanneer het
> dashboard online staat, kan een login worden toegevoegd zodat iemand enkel zijn eigen dashboard ziet.

## Wat zie je?

Bovenaan kies je een **periode** (laatste 12 maanden / dit jaar / vorig jaar / alle tijd),
of een **specifieke maand** of **specifieke week** in 2026 via de keuzelijsten.
Alle cijfers tonen dan de deals die **in die periode zijn aangemaakt** (binnengekomen leads).

- **KPI-kaarten**: nieuwe leads, open deals (+ waarde), gewonnen deals (+ waarde), win-ratio.
- **Leadinstroom per maand**: hoeveel leads er per maand binnenkwamen, per account.
- **Open vs. gewonnen waarde per account**: vergelijking tussen de 4 bedrijven.
- **Vergelijkingstabel**: alle cijfers (aantallen én waarde) naast elkaar.
- **Instroom per pipeline**: waar de leads binnenkomen — dit wordt straks de brug naar Google Ads.
- **Verlies-redenen**: waarom deals afvallen.
- **UNABO — omzet per afdeling**: omzet per afdeling (Energy, Engineering, Safety, Scanning…),
  berekend op **product-prijs** (niet deal value). Producten zonder herkenbare afdeling staan in het
  rood als "Niet toegewezen" — corrigeer hun naam in Pipedrive (voorvoegsel + dubbele punt).
- **Engineering (TKN-Buro + UNABO Engineering)**: de Engineering-omzet van UNABO opgeteld bij de
  volledige omzet van TKN-Buro (omdat TKN-Buro de UNABO Engineering-afdeling runt).
- **Trechter per fase**: kies een pipeline en zie hoeveel deals in welke fase zitten.
- **Synchronisatiestatus**: wanneer er voor het laatst ververst is.

## Pipelines verbergen

Oude of ongebruikte pipelines worden weggefilterd (niet verwijderd in Pipedrive).
De lijst staat in `lib/hiddenPipelines.ts`. Vraag gerust om er aan te passen.

## Belangrijk over je data

Bij veel **open deals is geen bedrag ingevuld** in Pipedrive. Daardoor lijkt de "open waarde" laag.
Als je wil dat de pipeline-waarde kloppender wordt, vul dan bij open deals een verwachte
waarde in. Het dashboard toont automatisch wat in Pipedrive staat.

## Je API-tokens

Die staan veilig in het bestand `.env.local` (wordt nooit gedeeld of online gezet).
Wil je een token vervangen? Pas dat bestand aan en ververs de data.

## Hulp nodig?

Vraag het gerust in Claude Code — alles is in gewone taal opgebouwd.
