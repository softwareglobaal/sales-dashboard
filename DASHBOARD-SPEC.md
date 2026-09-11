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
  (In Pipedrive heet die pipeline `UNABO - Engineering`, mét spaties. De code vergelijkt daarom
  met de spaties weggenormaliseerd — een letterlijke vergelijking matchte nooit en liet de
  productloze leads stilzwijgend wegvallen. Zelfde verhaal voor `UNABO - Energy`.)
  (Reden: 134 UNABO-Engineering-leads hebben nog géén product — dit zijn "plannen op aanvraag" en
  MOETEN als lead meetellen.)
- **Omzet-scope (waarde/diensten/afdelingen)** = product-gebaseerd: UNABO ENGINEERING-productregels
  + alle TKN-productregels. **Omzet = product-prijs** (som van regels), niet deal value.
- **Gecombineerd Engineering-overzicht** = UNABO Engineering-productomzet + TKN-Buro-omzet.
- **Bundel vs. los:** los = engineering enige afdeling op de deal; bundel = engineering samen met
  andere afdelingen. Bij bundels **zowel deal value als engineering-product value** tonen, verschil
  expliciet. UNABO ~160 los / ~75 bundel; TKN vrijwel altijd los.
- Beide scopes negeren de pipelines uit §7.

## 6b. Energy-afbakening (`/energy`, uitgewerkt sept 2026)
- **Lead-scope** = UNABO-deals met een ENERGY-product **óf** in de pipeline `UNABO - Energy`
  (spaties weggenormaliseerd, zie §6). Zit in `lib/energyQueries.ts` als `LEAD_SCOPE`; de
  concurrentiemonitor gebruikt exact dezelfde constante.
- **Omzet-scope** = UNABO ENERGY-productregels, omzet = product-prijs. De omzet-KPI is dus enkel het
  **Energy-aandeel**, ook bij bundels.
- **Bundels zijn hier de regel, niet de uitzondering:** ~40% van de gewonnen Energy-deals zit in de
  pipeline `UNABO - Bundel` (EPB + ventilatie + engineering in één offerte). Daarom toont de tab los
  vs. bundel mét de volledige deal value van de bundels naast het Energy-aandeel.
- **Trechter per fase** per pipeline (`UNABO - Energy`, `UNABO - Bundel`): "bereikt" is afgeleid uit de
  huidige fase (gewonnen = einde bereikt; open/verloren staan in hun fase). Geen volledige
  fase-historiek — dat staat er ook bij. Tijd in huidige fase via `stage_change_time`.
- Offertes, regio, verliesmotivatie (Invloedbaar door UNABO? + onderliggende oorzaak), projecttype:
  zelfde definities als Engineering, maar op de Energy-scope. `deal_flow` wordt sinds sept 2026 ook
  voor Energy-leads gevuld (`lib/sync.ts`), zodat "gem. aanvraag → offerte" exact wordt na de
  volgende sync.
- AI-analyse: `/api/analyse` met `afd: "energy"` — eigen aggregaten en systeemprompt, verder dezelfde
  regels (enkel geaggregeerde cijfers, geen namen).
- Jaardoel: sleutel `energy` in `config/targets.json`.

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
- **Algemeen** (`/`), **Engineering** (`/engineering`), **Energy** (`/energy`, met
  `/energy/concurrentie` en `/energy/register`) — volledig uitgewerkt.
- **Onder constructie** (nette placeholder, exacte tekst
  "Under construction — Siyan is doing his best to finish this as soon as possible."):
  3D Scanning, Safety, Plaatsbeschrijving, Meetstaten, H-Architects. Onder
  H-Architects hangt wél al `/h-architects/concurrentie` (zie §13).
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

## 10. Concurrentiemonitor Energie (augustus 2026)

Aparte module onder `/energy/concurrentie`, gevraagd in de salesmeeting van 25/08/2026.
Doel: weten wie de markt van EPB- en ventilatieverslaggeving bezet, wat zij aanbieden,
en wat er verandert — zonder dat iemand daarvoor handmatig websites moet openen.

**Bronnen**
- `data-bronnen/verslaggevers-2026-08.json` — export van het VEKA-register
  (energiesparen.be/energiekaart), 792 erkenningen, 613 personen. Handmatig ververst.
- Eigen crawl van de bedrijfssites: alleen `robots.txt`, sitemap en homepage. Publiek
  materiaal, uitsluitend lezen.

**Harde regels voor deze module**
- **Alleen lezen.** Geen formulieren, geen accounts, geen contact via de site van een ander.
- **Eerlijke crawler.** Eigen User-Agent, geen omzeiling van blokkades. Een site die met
  403 antwoordt wordt geregistreerd als "blokkeert crawlers", niet alsnog binnengedrongen.
- **Feit en schatting uit elkaar houden.** `lastmod` uit een sitemap is géén publicatiedatum;
  bij een sitemigratie krijgen alle artikels dezelfde datum. De kolom heet daarom
  "laatste post" met een expliciete waarschuwing eronder. Uitgaven aan SEA schatten we niet.
- **Geen sitemap = onbekend, niet nul.** `heeft_sitemap = 0` toont "geen sitemap" in plaats
  van "0 pagina's", anders lijkt een site kleiner dan hij is.
- **Eerste meting geeft geen signalen.** Anders levert de startcrawl honderden meldingen op
  over pagina's die al jaren bestaan.
- **Persoonsgegevens.** Naam, e-mail en telefoon komen uit een openbaar register, maar blijven
  persoonsgegevens: intern gebruik achter Authentik, niet exporteren, niet doorverkopen,
  niet verrijken met gegevens van buiten dat register.

**Indeling**
- `categorie = concurrent` bij twee of meer erkende verslaggevers op hetzelfde e-maildomein;
  bij één verslaggever `prospect`. Dat is een vuistregel, geen waarheid — handmatig te corrigeren
  in de tabel `concurrenten`.
- Wie erkend is maar nauwelijks online staat, is geen bedreiging maar een kandidaat voor
  onderaanneming. Die lijst voedt de Onderaanneming-tab van energie-efficient.be.

**Classificatie van pagina's.** De deel-sitemap is leidend, niet het URL-pad: WordPress
splitst `post-sitemap` van `page-sitemap`, en mijnepb.be publiceert artikels op
`/artikel-titel/` zonder `/blog/` ervoor. Op het pad alleen telde die site 9 artikels
in plaats van 356. Categorie-, tag- en paginatiepagina's tellen niet als artikel.

**Omvang meten we in ONZE markt.** `epb_paginas` telt pagina's over EPB, energie of
ventilatie. Rangschikken op het totale aantal pagina's zet Arcadis en Sweco bovenaan —
reuzen met één EPB'er in dienst. Rangschikken op aantal verslaggevers zet mijnEPB
onderaan, terwijl dat de sterkste speler is. Beide lenzen staan naast elkaar op de pagina.

**Gehackte sites.** `spam_verdacht` telt URL's met gok-, adult- of farmatermen.
vestingbvba.be bleek 2993 zulke pagina's te hebben. Zonder die telling lijkt zo'n site
de actiefste blogger van de markt.

## 11. Zoekwoorden en posities

- Zoekwoordenlijst in `config/zoekwoorden-energie.json` — aanpasbaar zonder code, zodat
  Mukesh en Jean termen kunnen toevoegen. Per term: thema en intentie
  (dienst / probleem / kennis / lokaal).
- **Zoekvolume** via Google Ads Keyword Planner, op dezelfde OAuth-koppeling als de
  advertentiesync. Vraagt `GOOGLE_ADS_KEYWORD_CUSTOMER_ID` of een gevulde
  `GOOGLE_ADS_LOGIN_CUSTOMER_ID`. Let op dezelfde valkuil als bij de advertentiesync:
  een ingetrokken API-versie geeft HTML in plaats van JSON.
- **Posities** via een betaalde SERP-bron (DataForSEO-implementatie aanwezig, aan te
  zetten met `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD`). Google rechtstreeks uitlezen
  doen we niet. Zonder bron blijven de positiekolommen leeg — geen geraden getallen.
- **Advertenties**: we tonen wél wie er adverteert, **nooit** een geschat budget.
- **Onze eigen posities** via Google Search Console (`lib/searchConsole.ts`): gratis, en de
  enige bron die geen schatting is — het is wat Google zelf registreert. Vraagt een eigen
  refresh-token, want Search Console gebruikt een andere scope dan Google Ads; op te halen
  met `scripts/gsc-auth.mjs`. Werkt alleen voor domeinen waarvan het eigenaarschap bevestigd is.
- Bovenaan de pagina staat een **bronnenstatus**: welke koppeling leeft, en wat er ontbreekt.
  Zie `SETUP-CONCURRENTIE.md` voor de stappen.
- Search Console geeft **alle** properties van het account terug, dus ook `contrax.be`,
  `h-architects.be` en `highdesignstudio.in`. De Energie-pagina filtert op onze eigen
  energiedomeinen en kiest per domein de `sc-domain:`-property boven de URL-prefix,
  omdat die www en non-www samen dekt.

**Ritme**
`scripts/concurrentie-cron.sh` controleert dagelijks de 250 langst niet gemeten domeinen.
Dat was 90 zolang er ~360 domeinen waren; met het architectenregister erbij staan er een
paar duizend in de lijst, en op 90 per dag zou een site nog maar een paar keer per jaar
gemeten worden. Op 250 is de hele lijst in ruim een week rond. Nieuwe URL's worden
signalen. Posities wekelijks op maandag (Energie 30 termen, Engineering 15 termen in de
even weken, Architectuur en Regularisatie elk 15 termen in de oneven weken), zoekvolumes
maandelijks op de eerste voor alle vier de markten.

## 12. Concurrentiemonitor Engineering (september 2026)

Tweede markt op dezelfde motor, onder `/engineering/concurrentie`. Onderwerp:
**stabiliteitsstudies** (UNABO Engineering + TKN-Buro), plus de meetstaten van TKN.

**Eén crawl, vier markten.** De crawler is marktloos: hij meet elk domein één keer en
telt de omvang apart per markt (`epb_paginas`, `eng_paginas`, `arch_paginas`, `reg_paginas`). Welke
markten een domein bedient staat in de koppeltabel `concurrent_markt` — een koppeltabel
en geen kolom, want een bureau kan in meerdere markten zitten. Zoekwoorden dragen een
`markt`-kolom en staan in `config/zoekwoorden-<markt>.json`.

**Geen register.** Voor EPB bestaat het VEKA-register; voor stabiliteit bestaat niets
vergelijkbaars. Deze markt wordt van onderaf opgebouwd uit twee bronnen, en de pagina zegt
dat ook met zoveel woorden:
- **zoekresultaten** — wie op onze zoektermen in de top 10 staat, hoort in de markt;
- **de crawl zelf** — een site telt mee bij minstens 3 stabiliteitspagina's *én* minstens
  1% van de site. Beide grenzen zijn nodig: de absolute grens houdt losse vermeldingen
  buiten, de verhouding houdt de reuzen buiten. Zonder die tweede grens belandden Sweco,
  een isolatiefabrikant, een scoutsfederatie en een politieke partij in de lijst.
  Een indeling uit de crawl wordt bij elke run herzien; wat uit het register, de SERP of
  onze eigen lijst komt blijft staan.

**Jobsites zijn een aparte categorie.** `stabiliteitsingenieur` is met 1.000 zoekopdrachten
per maand de grootste term van deze markt, maar de hele top 10 bestaat uit vacaturesites:
dat zijn werkzoekenden, geen klanten. Categorie `vacature` staat daarom naast `overheid` en
`portaal` in `GEEN_CONCURRENT`, en de zoekwoordenlijst kent de intentie `vacature`.

**Wat Search Console meteen liet zien.** unabo.be staat **#1 op "stabiliteitsstudie"**
(278 vertoningen) en #1,5 op "stabiliteitsstudie prijs", maar laat termen liggen waarop het
al vertoningen haalt: "stabiliteitsstudie verplicht" (#11), "stabiliteitsonderzoek" (#30),
"meetstaat opmaken" (#4,6). Die staan nu als eigen thema in de zoekwoordenlijst.

**Afbakening.** Sloopopvolging hoort hier niet (dat gaat over afval), meetstaten wel
(TKN-Buro valt onder Engineering). unabo.be draagt beide markten; de Engineering-pagina
filtert de Search Console-termen op stabiliteitswoorden, zodat de EPB-termen van datzelfde
domein op de Energie-pagina blijven.

## 13. Concurrentiemonitor Architectuur (september 2026)

Derde markt op dezelfde motor, onder `/h-architects/concurrentie`. Onderwerp: het
ontwerpwerk van **H-Architects** voor particuliere bouwheren — verbouwing, nieuwbouw,
regularisatie en aankoopbegeleiding. Werkgebied heel Vlaanderen, zwaartepunt Leuven en
Antwerpen. Eigen sites: `h-architects.be` en de proefomgeving `h-architects.globaal.be`.

**Wél een register, en een groot.** Anders dan bij stabiliteit bestaat hier een volledig
register: niemand mag in België architect zijn zonder inschrijving bij de Orde van
Architecten, en de Vlaamse Raad publiceert dat op vind.architect.be. Bron:
`data-bronnen/architecten-orde-2026-09.json`, opgehaald uit de eigen sitemap van die site
(11.965 profielpagina's) — niet uit hun zoektool, want die geeft er hard drie per
zoekopdracht terug. Methode, gedragsregels en beperkingen staan in
`data-bronnen/README-architecten.md`; het script in `scripts/architecten-register.py`.

**De architect is hier de concurrent, niet de klant.** Dat is het spiegelbeeld van
Engineering. Daar staat `architect` in `GEEN_CONCURRENT` omdat een architect
stabiliteitswerk uitbesteedt; hier is hij precies degene die om dezelfde bouwheer vecht.
`geenConcurrentVoor(markt)` regelt dat verschil. Voor architectuur blijven alleen
overheid, portalen, jobsites, buitenland en fabrikanten buiten de markt — aannemers níét:
een sleutel-op-de-deurbouwer neemt een particuliere bouwheer net zo goed weg.

**De crawl deelt hier niemand in.** Bij Engineering bouwt de crawl de marktlijst zelf op,
want daar bestaat geen register. Hier wel, dus `bepaalMarkten` laat de architectuurmarkt
met rust: de lijst komt uit het register en uit de zoekresultaten. Zou de crawl het toch
doen, dan sleept hij de halve EPB-lijst mee — "omgevingsvergunning" en "bouwaanvraag"
staan op elke verslaggeverssite, en drie zulke pagina's maken van een EPB-bureau geen
architect. `arch_paginas` wordt nog steeds voor élk domein geteld; dat cijfer meet de
omvang, niet het lidmaatschap.

**Niet alles wordt gecrawld, en dat staat op de pagina.** Het register is vijf keer zo
groot als dat van VEKA. Een domein wordt gevolgd als de architect zelf een website
opgaf, of als er meerdere inschrijvingen op dat domein staan. De rest is een domein dat
we uit een e-mailadres afleidden bij één inschrijving; daarvan weten we niet eens of er
een site achter zit. Die staan wél in het register en in de marktlijst, met `volgen = 0`
en een teller op de pagina — anders lijkt de gemeten markt de hele markt.

**Omvang meten we in ONZE markt**, net als elders: `arch_paginas` telt pagina's over
ontwerpwerk. De regex is bewust strak. Kaal "renovatie", "verbouwing" en "nieuwbouw"
staan er níét in: die woorden staan op elke aannemers-, keuken- en isolatiesite in
Vlaanderen. Wat er wél in staat is het vak zelf (architect, ontwerp, omgevingsvergunning)
of een projectsoort die een bouwheer bij een architect brengt en niet bij een aannemer —
een regularisatie, een uitbouw, een dakkapel, aankoopbegeleiding.

**Regio is hier een filter, geen kolom.** Duizenden inschrijvingen over heel Vlaanderen
zeggen niets: een bouwheer zoekt zijn architect in zijn eigen streek. De pagina filtert
daarom op provincie en gemeente uit het register (`RegioFilter`), en de gemeentelijst
volgt de gekozen provincie. Twee dingen die die cijfers níét zeggen: de provincie is de
tabel waarop iemand ingeschreven staat en niet waar hij werkt, en Google-posities gelden
voor heel Vlaanderen en zijn dus niet per gemeente te filteren — met een regio gekozen
toont de pagina daarom de eigen meting in plaats van het Google-leaderboard.

**Inschrijvingen zijn geen bureaus.** Een bureau met drie vennoten en een BV staat vier
keer in het register. Wie de markt in bureaus telt, telt domeinen; dat is ook wat de
crawler doet. Beide getallen staan naast elkaar op de pagina, net als de twee lenzen bij
Energie.

## 14. Concurrentiemonitor Regularisatie (september 2026)

Vierde markt op dezelfde motor, onder `/regularisatie/concurrentie`. Onderwerp:
**bouwovertredingen regulariseren**. Drie eigen sites spelen hier mee, met drie rollen en
bewust zonder link naar elkaar (doorway-beleid, zie de contentstrategie regularisatie):
`regulariseren.be` (de specialist, uitgever UNABO, uitvoerder H-Architects),
`mijnregularisatie.be` (de zelfcheck) en `h-architects.be` (het moederbureau, met acht
eigen regularisatiepagina's). regulariseren.be is de maat op de pagina; in het leaderboard
telt de hele groep als "wij" — twee eigen sites in één top 5 is geen dubbele winst maar een
teken dat ze elkaar beconcurreren.

**Geen register, wel een startlijst.** Iedere architect mag regulariseren en niet alleen
architecten doen het, dus een register bestaat niet. De markt begint daarom bij het
concurrentieonderzoek van 11 augustus 2026 (`marketing/seo/firmas/Regulariseren/onderzoek/`):
zes gespecialiseerde regularisatiemerken (vergund.be, onvergund.be, regulant.be, ...), acht
architectenbureaus met een eigen regularisatiepagina, en drie spelers ernaast (een
advocatenkantoor omgevingsrecht, een offerteplatform, een vastgoeddata-site). Die lijst staat
als `REGULARISATIE_ONDERZOEK` in `lib/concurrentie.ts` en komt met bron `onderzoek` in
`concurrent_markt`. Daarna groeit de markt zoals bij Engineering: uit de zoekresultaten en
uit de crawl (minstens 3 regularisatiepagina's én 1% van de site).

**De architect is concurrent, de aannemer niet.** Een architect dient hetzelfde
regularisatiedossier in; een aannemer bouwt en regulariseert niet. `GEEN_CONCURRENT_REGULARISATIE`
sluit daarom overheid, portalen, jobsites, buitenland, fabrikanten én aannemers uit. Een
advocaat valt onder "onbekend" en telt mee — terecht: hij vecht op dezelfde zoekvragen om
dezelfde eigenaar, en schrijft als enige over boete, dwangsom en meerwaardeheffing.

**Omvang meten we in ONZE markt**: `reg_paginas` telt pagina's over het probleem
(bouwovertreding, bouwmisdrijf, onvergund, zonder vergunning), het traject (regulariseren,
regularisatievergunning, vermoeden van vergunning, planologisch attest) en het gevolg
(maatregelenregister, herstelvordering, dwangsom, meerwaardeheffing). Bewust zónder
"omgevingsvergunning" en "bouwaanvraag": die staan op elke architecten- en verslaggeverssite.
Op een domein dat het onderwerp zelf in zijn naam draagt (regulariseren.be, vergund.be,
onvergund.be) telt elke pagina mee — anders scoort de specialist nul in zijn eigen markt.
Een bureau met één dienstenpagina haalt zo één; een specialist die per situatie en per
doelgroep schrijft haalt er tien. Dat verschil is de markt.

**Wat de dienstendekking moet bewaken.** Vijf nieuwe dienstpatronen: Maatregelenregister,
Haalbaarheidsstudie, Prijscalculator, Juridisch advies bouwrecht en Vermoeden van vergunning.
In augustus 2026 noemde geen enkele concurrent het maatregelenregister (notarissen en
makelaars moeten het sinds 1 april 2026 bij elke overdracht raadplegen) en hadden er twee een
prijscalculator. Zodra die balken groeien, is het onderzoek verouderd — dat is wat de pagina
zichtbaar maakt.

**Zoekwoorden.** `config/zoekwoorden-regularisatie.json`, 53 termen in negen thema's:
kern, kostprijs, kopen en verkopen, maatregelenregister, boete en gevolgen, procedure,
situaties (veranda, tuinhuis, carport, ... zonder vergunning), regio en "uit Search
Console" (termen waarop h-architects.be al vertoningen haalt). De vier
regularisatietermen die tot dan in de architectuurlijst stonden zijn hierheen verhuisd: een
term hoort bij één markt (de term is de sleutel van de tabel). De intentie `probleem` is hier
de waardevolste: wie "huis kopen met bouwovertreding" intikt, heeft het probleem al.

**Search Console.** h-architects.be levert ontwerp- én regularisatietermen; de
Regularisatie-pagina filtert op regularisatiewoorden (`REG_TERMWOORDEN`), zoals de
Engineering-pagina dat met stabiliteitswoorden doet. Of regulariseren.be en
mijnregularisatie.be een eigen property hebben, toont de bollenrij bovenaan.

**Toegang.** Route `regularisatie` = afdeling `regularisatie`, Authentik-groep
`wp-regularisatie` (bestaat al sinds de Watch Tower-opzet). De afdelingspagina `/regularisatie`
zelf staat op "in aanbouw": regularisatiedossiers lopen nog door de H-Architects-pipeline
zonder eigen label, dus er is nog geen salesbron.

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

## Layout / huisstijl (Glas, september 2026)

Sinds 11 september 2026 volgt het dashboard de vaste huisstijl voor alle platformen van Siyan:
`~/Claude/platform-huisstijl/HUISSTIJL.md` (glaslook, Newsreader + Instrument Sans, één accent).
`app/glas.css` is een ongewijzigde kopie van het gedeelde stylesheet; `app/globals.css` zet de
Tailwind-tokens (zinc, blue, emerald, red, amber, radii, schaduwen) op die standaard, zodat de
bestaande utility-klassen in de pagina's de juiste kleuren en vormen krijgen zonder dat de markup
of de dataregels veranderen. De zijbalk (`components/Sidebar.tsx`) is de glazen rail van de standaard,
176px breed omdat het menu groepen en subniveaus heeft. De paragraaf hieronder beschrijft de vorige
vormgeving en blijft staan als geschiedenis.

## Layout / huisstijl (design-pass, juli 2026, vervangen)
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
- `config/zoekwoorden-energie.json` / `-engineering.json` / `-architectuur.json` / `-regularisatie.json` — de zoektermen per markt.
- `config/themes.json` — thema → match-regels (productkeywords/afdelingen).
- `config/lossReasons.json` — variant → genormaliseerde verlies-reden.
- `config/customFields.json` — per account: vriendelijke naam → Pipedrive-veld-key (custom_json).
- `lib/hiddenPipelines.ts` — verborgen pipelines (Algemeen).
