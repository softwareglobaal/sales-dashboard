# Dashboard — Volledig projectoverzicht

Referentiedocument met alles wat we samen gebouwd, besproken en als regel vastgelegd hebben.
Bedoeld als basis om verder te brainstormen en het dashboard uit te breiden.

---

## 1. Wat het is & doel

Een intern dashboard dat de Pipedrive-data van meerdere firma's op één plek samenbrengt,
zodat je kan vergelijken en analyseren. Later koppelen we Google Ads erbij en een Claude-"brein"
voor SEO/SEA-advies.

## 2. Techniek & waar het staat

- **Map:** `/Users/siyanopenclaw/claude code_siyan/pipedrive-dashboard`
- **Stack:** Next.js 16 (React) + TypeScript + Tailwind CSS + Recharts (grafieken) + lokale SQLite-database (`better-sqlite3`).
- **Starten:** in Terminal `npm run dev` in de projectmap → openen op **http://localhost:3000**.
- **Data verversen:** knop "Data verversen" op de Algemeen-tab, of een sync-run via de API (`/api/sync`).
- **Draait nu lokaal** op de Mac (nog niet online).

## 3. Databronnen — 4 Pipedrive-accounts

| Account | Pipedrive-domein |
|---------|------------------|
| H-Architects | h-architects |
| UNABO | unabo |
| TKN-Buro | tkn-buro-tekenwerk |
| Energie Efficiënt | energieefficient |

- API-tokens staan lokaal in `.env.local` (niet gedeeld/online).
- HarmonieBOUW / Contrax Bv is bewust **niet** opgenomen (daar worden geen deals bijgehouden).
- Alle bedragen in EUR.

## 4. Structuur — twee dashboards (menu bovenaan)

- **Algemeen** (`/`) — alle sales over de 4 accounts samen.
- **Engineering** (`/engineering`) — enkel UNABO Engineering + TKN-Buro, met diepere analyse.
- Opzet is voorbereid om later meer afdelings-dashboards toe te voegen (Energy, Safety, …).

---

## 5. Kernregels & conventies (de "denkwijze")

Deze regels gelden door het hele dashboard en zijn bewust zo vastgelegd.

### 5.1 Datum-toewijzing (belangrijk)
Elke meting gebruikt zijn eigen gebeurtenisdatum, niet één vaste datum:
- **Leads / aanvragen & open deals** → op **aanmaakdatum** (`add_time`).
- **Gewonnen** (aantal, waarde, afdelingen, engineering) → op **win-datum** (`won_time`).
- **Verloren** → op **verlies-datum** (`lost_time`).

Voorbeeld: een deal aangemaakt in mei maar gewonnen in juni telt bij **juni** als gewonnen.

### 5.2 Periode-filters
- Knoppen: **Laatste 12 maanden · Dit jaar · Vorig jaar · Alle tijd**.
- Keuzelijst **Maand 2026** (jan–huidige maand).
- Keuzelijst **Week 2026** (maandag t/m zondag, ISO-weeknummers).
- Voor tijdgrafieken: schakelaar **Per maand / Per week**.

### 5.3 Verborgen / genegeerde pipelines
- **Algemeen dashboard** verbergt oude/test-pipelines (bestand `lib/hiddenPipelines.ts`), o.a.
  `SETUP`, `OUD: Architecten prospecties (niet gebruiken)`, `ARCHIVE`, `Archive`, `B2B: 3D Scan onderzoek (OUD)`.
  Verbergen ≠ verwijderen: in Pipedrive blijft alles staan.
- **Engineering-tab** negeert bovendien (via `config/engineering.json`):
  `B2B: UNABO`, `Setup`, `B2B: EPB Campaigne [NEW]`.

### 5.4 Deal-label = bron/kanaal van de lead (projectbrede conventie)
- Het **deal-label** geeft altijd de **source/het kanaal** aan (Website, H-Architects, Studiebureau Bouwerij, …).
- De vertaling **label → kanaal** staat in een onderhoudbaar bestand: `config/engineering.json`.
  - Niet hoofdletter-gevoelig; meerdere labels mogen naar één kanaal wijzen
    (bv. "Website" + "website" → **Website**; "Via-H-Architects" + " Via H-Architects" → **H-Architects**).
  - Labels toevoegen kan daar **zonder code aan te raken**.
- **Genegeerde labels:** `test`, `setup`, `test deal`.
- Deals zonder label vallen onder **"Geen label"**.

### 5.5 Engineering-afbakening
- **Scope Engineering-tab** = alle **TKN-Buro**-deals **+** alle **UNABO**-deals die een **ENGINEERING-product** bevatten.
- **Omzet wordt op PRODUCT-PRIJS berekend** (som van de productregels), **niet** op deal value —
  omdat één deal meerdere producten kan bevatten (deal value = som van alle productprijzen).
- **Gecombineerd Engineering-overzicht** = UNABO Engineering-productomzet **+** TKN-Buro-omzet
  (TKN runt de UNABO Engineering-afdeling).

### 5.6 Afdelingen uit productnaam (UNABO)
- Afdeling = het stuk **vóór de eerste dubbele punt** in de productnaam
  (`ENERGY`, `ENGINEERING`, `SAFETY`, `3D-SCANNING`, `PERMIT`, `DRAFTING`, `CONTRACTOR SUPPORT`, …).
- Producten zonder herkenbare afdeling → **"Niet toegewezen"** (rood gemarkeerd, zodat je ze in Pipedrive kan corrigeren).

### 5.7 Verlies-redenen = enkel 2026
- Het verlies-redenen-overzicht op de Engineering-tab toont **uitsluitend 2026-data**.
- Kies je een periode **vóór 2026** (bv. Vorig jaar), dan toont het **niets**.

---

## 6. Wat er nu op elke tab staat

### Algemeen-tab
- **KPI's:** nieuwe leads, open deals (aantal + waarde), gewonnen deals (aantal + waarde), win-ratio.
- **Leadinstroom per maand** (per account).
- **Open vs. gewonnen waarde per account.**
- **Vergelijkingstabel per account** (aantallen én waarde).
- **Instroom per pipeline** (bedoeld als brug naar Google Ads).
- **Verlies-redenen.**
- **UNABO — omzet per afdeling** (op product-prijs, met "Niet toegewezen").
- **Engineering-samenvattingskaart** met link naar het Engineering-dashboard.
- **Trechter per fase** (kies een pipeline → deals per fase).
- **Synchronisatiestatus.**

### Engineering-tab
- **KPI's:** Aanvragen, Verkocht, Omzet (op product-prijs), Gem. tijd tot verkoop (dagen).
- **Aanvragen per kanaal** — gestapelde balk (gewonnen/open/verloren) + tabel met aandeel (Fase 1).
- **Verlies-redenen (enkel 2026).**
- **Over tijd** — drie aparte grafieken in Pipedrive Insights-stijl (verticale kolommen):
  - Aanvragen per maand/week
  - Gewonnen per maand/week — met schakelaar **Aantal / Waarde**
  - Verloren per maand/week
  - Gemeenschappelijke schakelaar **Per maand / Per week**.
- **Aanvragen & omzet per maand** (trend: balken + omzetlijn).
- **Verdeling omzet** — UNABO Engineering + TKN-Buro + totaal.
- **Analyse per dienst** — sorteerbare tabel (aanvragen / verkocht / omzet / gem. dagen tot verkoop)
  met inzichten: *meest verkocht*, *snelst verkocht*, *meeste aanvragen*.

---

## 7. Belangrijke data-inzichten / aandachtspunten

- **Open deals hebben vaak geen bedrag ingevuld** → "open waarde" oogt laag; de meeste waarde zit in gewonnen/verloren deals.
- **Lead-herkomst zat vroeger niet in vaste velden** — daarom de label→kanaal-conventie (§5.4).
- **Grote opschoning in Pipedrive (± juni 2026):** UNABO ± 3.227 → ± 900 deals, TKN-Buro ± 1.044 → ± 620.
  → Na elke opschoning **opnieuw synchroniseren**.
- **Bijna-dubbele namen** (labels, productnamen met spaties/hoofdletters) worden zoveel mogelijk samengevoegd; de rest is zichtbaar om in Pipedrive op te schonen.

## 8. Fase 2 — onderzoek "type project" (resultaat)

Doel: kunnen we het projecttype afleiden (eengezins vs. meergezins; nieuwbouw vs. renovatie)?
- **Bevinding:** UNABO heeft er al de juiste velden voor — **`Gebouwtype`** en **`Type aanvraag / situatie`** —
  maar die zijn amper ingevuld (**±6–8%**). TKN-Buro heeft deze velden niet. Titels/producten geven <10%.
- **Conclusie:** nu **niet betrouwbaar** (~90% onbekend).
- **Aanbeveling:** consequent `Type aanvraag / situatie` (nieuwbouw/renovatie) en `Gebouwtype` (eengezins/meergezins) invullen;
  **dezelfde twee velden toevoegen aan TKN-Buro**. Zodra >±70% ingevuld is, kan de analyse er meteen op gebouwd worden.

## 9. Roadmap / openstaande fases

1. ✅ **Pipedrive-dashboard** — gebouwd, verfijnd, gesplitst in Algemeen + Engineering, met diepe Engineering-analyse.
2. ⏳ **Google Ads koppelen** — vereist een Google Ads developer-token (goedkeuring duurt dagen); interim via CSV.
3. ⏳ **Online zetten + login** — zodat het overal bereikbaar is en je **toegang per dashboard** kan geven
   (iemand ziet enkel bv. Engineering). Toegangscontrole heeft pas zin zodra het online staat.
4. ⏳ **Claude-"brein" (SEO/SEA)** — advies op basis van de gecombineerde data.
5. ⏳ **Projecttype-analyse** — zodra de velden uit §8 ingevuld worden.

## 10. Waar pas je wat aan (config, zonder diep in de code)

- `config/engineering.json` — label→kanaal-mapping, genegeerde labels, genegeerde pipelines (Engineering).
- `lib/hiddenPipelines.ts` — verborgen/oude pipelines (Algemeen).
- `.env.local` — de 4 API-tokens.

---

*Dit overzicht weerspiegelt de stand zoals samen opgebouwd. Gebruik het als vertrekpunt voor de brainstorm;
stuur daarna één prompt met de gewenste uitbreidingen en ik bouw ze in — in lijn met bovenstaande regels.*
