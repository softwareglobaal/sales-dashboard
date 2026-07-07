# DASHBOARD-SPEC — leidende specificatie

> **Bij twijfel: deze spec is leidend. Wijk niet af zonder overleg.**
> Elke sessie leest dit bestand eerst. Het legt de definities, datum-regels en scope vast die de
> vorige fouten veroorzaakten. Zie ook `PROJECT-OVERZICHT.md` voor de bredere context.

## Scope-grenzen (harde regels)
- **Geen schrijf-acties naar Pipedrive.** Alleen lezen/synchroniseren en visualiseren.
- **Geen AI-auto-labeling / tag-automatisering** (aparte fase met test-Pipedrive).
- **Geen projecttype-conclusies** (nieuwbouw/renovatie, een-/meergezins): velden ~6–8% gevuld →
  toon als "Onbekend / nog niet betrouwbaar", bouw er geen cijfers op.
- Lege/nauwelijks gevulde velden: toon "Nog niet gevuld" of laat sectie weg; **nooit** de pagina
  breken; geen percentages/conclusies op grotendeels lege velden ("onbetrouwbaar — te weinig data").
- Componenten tonen automatisch méér naarmate de vulgraad stijgt, zonder code-aanpassing.

## 1. Databronnen
Accounts (tokens in `.env.local`, niet loggen): H-Architects (`h-architects`), UNABO (`unabo`),
TKN-Buro (`tkn-buro-tekenwerk`), Energie Efficiënt (`energieefficient`). Alles EUR.
HarmonieBOUW/Contrax niet opnemen. "Data verversen" (knop + `/api/sync`) moet betrouwbaar de laatste
stand herladen na elke Pipedrive-opschoning.

## 2. Data dictionary (LEIDEND)
| Term | Definitie |
|---|---|
| **Lead / aanvraag** | Elke inkomende aanvraag voor offerte/dienst — **ook "plannen op aanvraag"**. NIET het aantal verstuurde offertes. Geteld op `add_time`. |
| **Valse lead** | Aanvraag die stilviel/irrelevant. Apart als % (indien betrouwbaar afleidbaar uit lost-reden). |
| **Geen reactie** | Lead zonder antwoord. Apart als % (uit lost-reden). |
| **Offerte** | Daadwerkelijk verstuurde offerte (≠ lead). Indicatief afgeleid uit stage (offerte-verzonden-fase); label "indicatief". |
| **Gewonnen / Verloren / Open** | status won / lost / open. |

**QA:** "aanvragen" mag NOOIT offertes/productregels tellen. Oude bug: juni "4 aanvragen / 12 verkocht"
kwam doordat aanvragen productregels/offertes telde. Aanvragen = **deals (leads) op `add_time`**.

## 3. Datum-toewijzing (elk zijn eigen gebeurtenisdatum)
- Leads/aanvragen & open → `add_time`.
- Gewonnen (aantal, waarde, afdeling, engineering) → `won_time`.
- Verloren → `lost_time`.
Grafiek "aanvragen vs. omzet per maand": expliciet labelen dat aanvragen op `add_time` en omzet op
`won_time` staan (niet dezelfde deals).

## 4. Filters & tijdweergave
- Periodeknoppen: Laatste 12 maanden · Dit jaar · Vorig jaar · Alle tijd. **Standaard = Dit jaar.**
- Maand-keuzelijst (2026, jan→huidige maand). Week-keuzelijst (2026, ISO, ma–zo).
- Toggle Per maand / Per week voor tijdgrafieken.
- **Thema-filter** (EPB, EPC, stabiliteit, …) op Algemeen én Engineering. Config-driven
  (`config/themes.json`), match op productnaam/afdeling. Graceful bij geen match.

## 5. Kanaalmodel (label = bron/kanaal)
- **Deal-label = uitsluitend source/kanaal.** Rol-velden (behandeld door / prijs bepaald door /
  offerte opgemaakt door) komen uit **custom fields**, niet uit labels.
- Mapping in `config/engineering.json` (niet hoofdletter-gevoelig; meerdere labels → één kanaal).
  Genegeerde labels: `test`, `setup`, `test deal`. Geen label → "Geen label".
- **Tweelaags: hoofdkanaal → subkanaal.** Toekomstig labelformaat is `Categorie, Naam`
  (bv. `Architect, Jan`); dan hoofd = vóór komma, sub = erna. **Huidige data staat nog niet in dat
  formaat** → daarom config-gedreven groepering (`channelGroups`): een label wijst naar een
  hoofdkanaal (Website, Architect/ARC, EPB, Studiebureau, Energie-efficiënt, …). Toon hoofdkanaal-
  totalen met inklap/uitklap naar subkanaal. Werkt automatisch mee zodra labels migreren.

## 6. Engineering-afbakening
- **Lead-scope (aantallen: aanvragen/gewonnen/verloren/open)** = alle TKN-Buro-deals **+** UNABO-deals
  die een ENGINEERING-product hebben **óf** in de pipeline `UNABO-Engineering` zitten.
  (Reden: 134 UNABO-Engineering-leads hebben nog géén product — dit zijn "plannen op aanvraag" en
  MOETEN als lead meetellen.)
- **Omzet-scope (waarde/diensten/afdelingen)** = product-gebaseerd: UNABO ENGINEERING-productregels
  + alle TKN-productregels. **Omzet = product-prijs** (som van regels), niet deal value.
- **Gecombineerd Engineering-overzicht** = UNABO Engineering-productomzet + TKN-Buro-omzet.
- **Bundel vs. los:** los = engineering enige afdeling op de deal; bundel = engineering samen met
  andere afdelingen. Bij bundels **zowel deal value als engineering-product value** tonen, verschil
  expliciet. UNABO ~160 los / ~75 bundel; TKN vrijwel altijd los.
- Beide scopes negeren de pipelines uit §7.

## 7. Afdelingen, verborgen pipelines, verlies-redenen
- **Afdeling (UNABO)** = tekst vóór eerste dubbele punt in productnaam (ENERGY, ENGINEERING, SAFETY,
  3D-SCANNING, PERMIT, DRAFTING, CONTRACTOR SUPPORT, …). Geen prefix → "Niet toegewezen" (rood).
- **Verborgen pipelines:** Algemeen via `lib/hiddenPipelines.ts` (SETUP, OUD…, ARCHIVE, Archive,
  B2B: 3D Scan onderzoek (OUD)). Engineering negeert bovendien via `config/engineering.json`:
  `B2B: UNABO`, `Setup`, `B2B: EPB Campaigne [NEW]`. Verbergen ≠ verwijderen.
- **Verlies-redenen (Engineering) = GECOMBINEERD** over UNABO Engineering + TKN-Buro, **opgeteld per
  genormaliseerde reden** (via `config/lossReasons.json`; case-insensitief; varianten/oude namen
  samenvoegen — bv. "geen reactie / contact verloren" + "geen reactie / niet teruggekoppeld" →
  **"Geen reactie"**). Headline = som (één regel per reden). Optionele drill-down UNABO vs TKN.
  Enkel 2026-data (periode vóór 2026 → toon niets).
- **Motivatie/oorzaak (UNABO-only custom fields):** "Invloedbaar door UNABO?" (100% gevuld) en
  "Onderliggende lost oorzaak" (~81%) meenemen als secundaire breakdown (label als UNABO-data;
  TKN heeft deze velden niet). "Toelichting lost deal" (~14%) als optionele tekst.

## 8. Tab-structuur (platform)
- **Algemeen** (`/`), **Engineering** (`/engineering`) — volledig uitgewerkt.
- **Onder constructie** (nette placeholder, exacte tekst
  "Under construction — Siyan is doing his best to finish this as soon as possible."):
  Energy, 3D Scanning, Safety, Plaatsbeschrijving, Meetstaten, H-Architects, SEO/SEA.
  SEO/SEA = afdeling (Google Ads + zoekdata), geen Pipedrive-account.
- Nieuwe afdelings-tab moet met minimale moeite toegevoegd kunnen worden (Engineering als template).

## 9. UI/UX & kwaliteit
- Professioneel, één kleurensysteem, consistente typografie/terminologie (altijd "offerte"),
  nette KPI-kaarten, witruimte, duidelijke hiërarchie, snel/responsive.
- **Trechter per fase:** conversie per fase **én** tijd-per-fase (waar zit de vertraging).
  Volledige stage-historiek vergt deal-flow (nog niet gesynct) → toon wat kan (bv. gem. dagen in
  huidige fase via `stage_change_time`), markeer de rest "nog niet beschikbaar".
- Sync-status (laatste ververs-moment) op elke pagina.
- Klein lokaal notities/to-do-paneel (samen bijhouden), lokaal opgeslagen.

## Aanvullingen (feedback-ronde)
- **Grafiek "aanvragen vs. direct gewonnen omzet (zelfde maand)"**: SAME-MONTH cohort — balken = leads
  binnengekomen die maand (add_time); lijn = omzet uit deals die in DIEZELFDE maand zijn aangemaakt ÉN gewonnen
  (add-maand == won-maand). Eerlijke "hoeveel win ik meteen"-vergelijking; deals die later winnen tellen in hún
  aanvraagmaand.
- **Verlies-redenen = 8 HOOFD-redenen** (Concurrent/bestaande samenwerking · Geen reactie/contact verloren ·
  Niet juiste fit/scope · Geen nood momenteel · Andere/administratief · Project uitgesteld · Geen (urgente)
  interesse · Prijs/budget). ALLE oude/rommelige redenen worden hieronder gemapt via `config/lossReasons.json`
  (normaliseren + samenvoegen). Nieuwe/onbekende redenen tonen onder eigen naam tot ze in de config staan.
  **Interactief** (components/LostReasonsTable.tsx): hover op een reden = preview van deal-titels + pipeline;
  klik = uitklappen van alle deals met **klikbare Pipedrive-link** (`https://{domain}.pipedrive.com/deal/{id}`).
- **Offerte** = deal die een offerte-fase bereikte (config `offerteStages` in engineering.json; incl. UNABO
  Openoproep-doorstuur "doorgestuurd naar H-A"). Bereikt = won OF huidige fase is offerte-fase OF stage_order ≥
  laagste offerte-fase-order van die pipeline. Tijd aanvraag→offerte: nu partieel (deals momenteel in offerte-fase,
  via stage_change_time); **volledige** timing vergt de deal-flow (per-deal API) — nog niet gesynct.
- **Custom fields** (read-only) via `config/customFields.json` → opgeslagen als `custom_json` (enum/set → labels).
  - **Motivatie bij verlies (UNABO):** "Invloedbaar door UNABO?" (verplicht, ~100%) + "Onderliggende lost oorzaak".
    Toon bij verlies-redenen als UNABO-breakdown (Wél/Niet/Onbekend beïnvloedbaar). TKN heeft deze velden niet.
  - **Projecttype (UNABO):** "Gebouwtype" (eengezins/meergezins) + "Type aanvraag/situatie" (nieuwbouw/renovatie).
    Toon MÉT "NIEUW / nog niet volledig gevuld"-badge + vulgraad; geen harde conclusies (nu ~8% gevuld).

## Layout / huisstijl (design-pass, juli 2026)
- **Naam:** "Sales dashboard" (geen ondertitel). App-shell = **linker zijbalk** (`components/Sidebar.tsx`,
  donker `#0f1522`, gegroepeerd: Overzicht · Afdelingen · Marketing · Team, met firma-accent-dots en
  "soon"-labels; footer met sync-status + `SyncButton variant="sidebar"`) + main-area.
- **Achtergrond** van de content is bewust donkerder (`#d7dde7`) zodat de witte kaarten "poppen".
- Per pagina een **sticky header** met titel + filters + **filter-chips** (periode/thema/weergave).
  Engineering heeft een **sub-navigatie** (anker-links: Overzicht/Kanalen/Verlies/Diensten/Projecttype;
  secties dragen `id` + `scroll-mt-40`).
- **KPI-hiërarchie:** primaire KPI (omzet) als donkere hero-kaart; KPI's tonen een **delta vs. de vorige,
  even lange periode** (`getEngineeringKpisWithDelta`). Delta's zijn het meest betekenisvol op maand/week.
- **Sales team-tab** (`/sales-team`): teamkaarten (Siyan Head, Joey, Shelton) + "dekking per firma/klant".
- Layout/huisstijl mag evolueren; de data-regels hierboven blijven leidend.

## Config-bestanden (aanpasbaar zonder code)
- `config/engineering.json` — label→kanaal + hoofdkanaal-groepen, genegeerde labels/pipelines, `offerteStages`.
- `config/themes.json` — thema → match-regels (productkeywords/afdelingen).
- `config/lossReasons.json` — variant → genormaliseerde verlies-reden.
- `config/customFields.json` — per account: vriendelijke naam → Pipedrive-veld-key (custom_json).
- `lib/hiddenPipelines.ts` — verborgen pipelines (Algemeen).
