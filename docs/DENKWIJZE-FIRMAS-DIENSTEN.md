# Denkwijze: firma's, diensten en splitsingen

> Overdrachtsdocument. Bedoeld om als één blok kennis aan een ander platform (AI-assistent, BI-tool,
> nieuw dashboard) te geven, zodat dat platform dezelfde definities hanteert als het sales-dashboard.
> Peildatum cijfers: **22 augustus 2026**. Bron: `DASHBOARD-SPEC.md`, `config/*.json`,
> `lib/queries.ts` en de Pipedrive-kennisbank (volledige API-doorlichting van alle accounts).

---

## 1. De groep in één alinea

Het is geen één bedrijf met afdelingen, maar **een groep merken die elkaar voeden**. Een particuliere
bouwheer komt binnen bij het architectenbureau; wat daar aan technische studies uitrolt, gaat naar het
technische merk; wat dat merk niet zelf tekent of berekent, gaat naar het tekenbureau. Daarnaast loopt
een koude B2B-tak die dezelfde prospectenlijst in meerdere merken bewerkt. Elk merk heeft zijn **eigen
Pipedrive-account**, dus "de groep" bestaat nergens in de data — die moet je zelf samenstellen.

## 2. De firma's en wat ze verkopen

| Firma | Pipedrive-domein | Markt | Wat het verkoopt |
|---|---|---|---|
| **H-Architects** | `h-architects` | B2C, inbound | Architectuur voor particuliere bouwheren: verbouwing, aanbouw, optopping, regularisatie. Leadbronnen: Homedeal, eigen website, Solvari. |
| **UNABO** | `unabo` | B2B + doorverwijzing | Bundel van bouwtechnische diensten: engineering/stabiliteit, EPB (Energy), 3D-scanning, veiligheidscoördinatie, tekenwerk, vergunningen, meetstaten, landmeetkunde, plaatsbeschrijving. |
| **TKN-Buro** (TKN-Tekenwerk) | `tkn-buro-tekenwerk` | B2B | Tekenwerk (≈ €40/u) en stabiliteitsstudies voor ingenieurs, studiebureaus en architecten. Runt in de praktijk de Engineering-afdeling van UNABO. |
| **Energie Efficiënt** | `energieefficient` | B2B outbound | EPB-verslaggeving in onderaanneming voor andere EPB-verslaggevers. |
| **HarmonieBOUW** (+ Contrax) | `harmoniebouw` | B2B | Uitvoering/aanneming. **Bewust buiten het dashboard**: er worden geen bruikbare deals bijgehouden (5 gewonnen op 2 029). |

Verhoudingen (peildatum): H-Architects is de motor — 6 363 deals en 74 % van alle gewonnen waarde —
en tegelijk de beste leadbron voor UNABO. UNABO is het gezonde middenstuk: 987 deals, 33 % winratio,
beste velddiscipline. TKN-Buro draait klein maar functioneel (634 deals, 12,9 %). Energie Efficiënt
ligt sinds juni 2026 stil.

**De belangrijkste stroom:** deals bij UNABO met het label `Via-H-Architects` halen **79,7 % winratio**
over 179 deals, tegenover 17,5 % voor website-leads. Interne doorverwijzing is verreweg het beste kanaal.

## 3. De drie assen waarop een dienst leeft

Dit is de kern van de denkwijze. Eén verkoop draagt drie verschillende "dienst"-signalen, en ze
betekenen **niet** hetzelfde:

1. **Pipeline** — het *proces* dat gevolgd wordt (`UNABO - Engineering`, `UNABO - Energy`,
   `TKN-Stabiliteitsstudie`, …). Betrouwbaar aanwezig op élke deal, ook als er nog niets verkocht is.
2. **Product op de deal** — wat er *werkelijk verkocht* is, met prijs per regel. Alleen aanwezig zodra
   iemand producten toevoegt; ontbreekt vaak bij open deals.
3. **Afdeling** — afgeleid uit de productnaam: **alles vóór de eerste dubbele punt**
   (`ENERGY:`, `ENGINEERING:`, `SAFETY:`, `3D-SCANNING:`, `PERMIT:`, `DRAFTING:`,
   `CONTRACTOR SUPPORT:`, …). Geen prefix → `Niet toegewezen`, en dat wordt bewust rood getoond zodat
   iemand het in Pipedrive gaat corrigeren.

Regel die daaruit volgt: **tel aantallen op de pipeline, tel geld op de producten.** Wie aantallen op
producten telt, verliest alle aanvragen die nog geen product hebben. Wie geld op de pipeline telt,
verliest de opsplitsing binnen een gebundelde deal.

## 4. De splitsingen, en waarom ze zo liggen

### 4.1 Firma-split (account)
Vier accounts worden gelezen, HarmonieBOUW niet. Alles in EUR. Een account is geen dienst en geen
afdeling — het is een merk met een eigen CRM. Vergelijkingen over accounts heen mogen alleen op
genormaliseerde begrippen (lead, gewonnen, verloren, omzet), nooit op ruwe fasenamen of labels, want
die verschillen per account.

### 4.2 De Engineering-split: twee scopes voor één tab
Dit is de splitsing die het vaakst fout gaat en daarom expliciet in twee is getrokken:

- **Lead-scope** (aanvragen, gewonnen, verloren, open — *aantallen*) =
  alle TKN-Buro-deals **+** UNABO-deals die óf een `ENGINEERING`-product hebben óf in de pipeline
  `UNABO - Engineering` zitten.
  *Reden:* 134 UNABO-Engineering-leads hebben helemaal geen product — dat zijn "plannen op aanvraag".
  Die zijn wél een aanvraag en moeten meetellen.
- **Omzet-scope** (waarde, diensten, afdelingen — *euro's*) = uitsluitend productgebaseerd:
  UNABO `ENGINEERING`-productregels + álle TKN-productregels.
  *Reden:* één deal kan producten uit meerdere afdelingen bevatten. Deal value zou dan energie- of
  scanning-omzet aan Engineering toeschrijven.

**Gecombineerd Engineering-overzicht** = UNABO Engineering-productomzet + TKN-Buro-omzet, omdat TKN
feitelijk de Engineering-afdeling van UNABO uitvoert.

*Valkuil uit de praktijk:* de pipeline heet in Pipedrive `UNABO - Engineering` **mét spaties rond het
streepje**. Een letterlijke stringvergelijking met `UNABO-Engineering` matcht nooit en laat stilzwijgend
alle productloze leads wegvallen. Normaliseer spaties weg vóór je vergelijkt. Zelfde verhaal voor
`UNABO - Energy`.

### 4.3 Bundel vs. los
- **Los** = engineering is de enige afdeling op de deal.
- **Bundel** = engineering staat samen met een andere afdeling op dezelfde deal.
Bij bundels toon je **zowel de deal value als de engineering-productwaarde**, met het verschil
expliciet — anders lijkt een bundeldeal een reuzeorder voor Engineering.
Orde van grootte: UNABO ≈ 160 los / 75 bundel; TKN vrijwel altijd los.

### 4.4 Kanaal-split (herkomst)
- **Het deal-label betekent uitsluitend één ding: de bron/het kanaal van de lead.** Nooit een rol,
  nooit een status. Rolvelden (behandeld door, prijs bepaald door, offerte opgemaakt door) horen in
  custom fields.
- De mapping label → kanaal staat in configuratie, niet in code, zodat een label toevoegen geen
  release vergt. Niet hoofdlettergevoelig; meerdere labels mogen naar één kanaal wijzen
  (`Via-H-Architects`, `via h-architects` → **H-Architects**).
- **Tweelaags: hoofdkanaal → subkanaal.** Hoofdkanalen zijn o.a. Website, H-Architects, TKN-Buro,
  Energie Efficiënt, Studiebureau, Architect (ARC), Qoppa, Open oproep Antwerpen. Studiebureaus
  (Bouwerij, Enpro, DMCO, M-gineers) en individuele architecten zijn subkanalen — anders bestaat het
  overzicht uit dertig staafjes van één deal.
- Toekomstig labelformaat is `Categorie, Naam` (bv. `Architect, Jan`): hoofdkanaal vóór de komma,
  subkanaal erna. Zolang de data nog niet migreerde, doet een configuratiebestand hetzelfde werk. Elk
  label dat met `arc-` begint valt automatisch onder hoofdkanaal *Architect (ARC)*.
- Genegeerd: `test`, `setup`, `test deal`. Geen label → `Geen label` (zichtbaar houden, niet wegmoffelen).

### 4.5 Thema-split (dwars over de firma's heen)
Naast de firma-as bestaat een **thema-filter**: EPB, EPC, Stabiliteit, Ventilatie, Veiligheid,
3D-Scanning, Plaatsbeschrijving, Meetstaten. Een deal hoort bij een thema als een productnaam een van
de matchwoorden bevat (`stabilit`, `ventilat`, `coördinat`, `meetstat`, …). Dit is de enige as waarop
je "hoeveel EPB doen we als groep" kan beantwoorden, want EPB zit bij UNABO in de pipeline
`UNABO - Energy` én bij Energie Efficiënt als volledige firma.

### 4.6 Tijd-split: elke meting zijn eigen datum
- Leads/aanvragen en open deals → **aanmaakdatum** (`add_time`)
- Gewonnen (aantal, waarde, afdeling) → **windatum** (`won_time`)
- Verloren → **verliesdatum** (`lost_time`)

Een deal die in mei binnenkwam en in juni won, telt als aanvraag in mei én als omzet in juni. Een
grafiek "aanvragen vs. omzet per maand" vergelijkt dus **niet dezelfde deals** en moet dat er ook bij
zeggen. Wil je wél een eerlijke "hoeveel win ik meteen"-vergelijking, gebruik dan een
**same-month cohort**: balken = leads aangemaakt die maand, lijn = omzet uit deals die in diezelfde
maand zijn aangemaakt én gewonnen.

### 4.7 Verlies-redenen: normaliseren en samenvoegen
Acht hoofdredenen: Concurrent/bestaande samenwerking · Geen reactie/contact verloren · Niet juiste
fit/scope · Geen nood momenteel · Andere/administratief · Project uitgesteld · Geen (urgente)
interesse · Prijs/budget. Alle historische varianten worden daarheen gemapt via configuratie
("geen reactie / contact verloren" + "geen reactie / niet teruggekoppeld" → **Geen reactie**).
Onbekende redenen tonen onder hun eigen naam tot iemand ze mapt — nooit stilletjes in "Andere" gooien.
Voor Engineering worden UNABO en TKN **opgeteld** tot één lijst, met optionele drill-down.

### 4.8 Verborgen ≠ verwijderd
Test-, setup- en archiefpipelines (`SETUP`, `ARCHIVE`, `OUD: …`, `B2B: 3D Scan onderzoek (OUD)`) worden
uit de cijfers gefilterd, maar blijven in Pipedrive bestaan. De Engineering-scope negeert bovendien
`B2B: UNABO`, `Setup` en `B2B: EPB Campaigne [NEW]` — dat zijn koude campagnes, geen aanvragen.

## 5. Definities waar niet van afgeweken mag worden

| Term | Definitie |
|---|---|
| **Lead / aanvraag** | Elke inkomende aanvraag voor een offerte of dienst, **inclusief "plannen op aanvraag"**. Geteld als **deal op `add_time`**. Nadrukkelijk níet het aantal verstuurde offertes en níet het aantal productregels. |
| **Offerte** | Een deal die een offertefase bereikt heeft (fasenaam bevat "offerte gestuurd/opgestuurd/uitgestuurd", "off. verzonden", of — voor de Antwerpse open oproep — "doorgestuurd naar H-A"). Altijd labelen als **indicatief**. |
| **Omzet** | Som van productregelprijzen, niet de deal value. |
| **Valse lead / Geen reactie** | Alleen als percentage, en alleen als het betrouwbaar uit de verliesreden af te leiden is. |
| **Gewonnen / Verloren / Open** | Pipedrive-status won / lost / open. |

Historische bug die deze tabel verklaart: "juni: 4 aanvragen / 12 verkocht" ontstond doordat
"aanvragen" productregels telde in plaats van deals.

## 6. Wat expliciet níet mag / niet kan

- **Nooit naar Pipedrive schrijven.** Lezen, synchroniseren, visualiseren. (Eén eenmalige, expliciet
  geautoriseerde uitzondering in juli 2026 om custom fields aan te maken.)
- **Geen euro-gewogen forecast.** `expected_close_date` is 0 % gevuld, bedrag op open deals 0,4–37 %,
  en 505 van de 555 fases staan op kans 100 % — kansweging staat dus effectief uit. Wil je toch
  vooruitkijken: win-ratio × aantal open deals × gemiddelde gewonnen dealwaarde.
- **Geen conclusies over projecttype** (nieuwbouw/renovatie, eengezins/meergezins): velden ~6–8 %
  gevuld. Tonen als "nog niet betrouwbaar", geen percentages op bouwen.
- **Geen prestaties per persoon.** Elk account heeft **één gedeelde login** (een functiepostbus met
  adminrechten), dus `user_id` is nooit een persoon. De enige attributie is de conventie waarmee het
  team zijn naam als prefix in notities zet (`Shelton: missed call`). Meet daarom op **teamniveau of
  per rol/fase** (wie deed eerste contact, wie maakte de offerte, wie sloot), niet per deal-owner.
- **Activiteiten zeggen niets.** Het team gebruikt ze niet: de pipelinefase ís de takenlijst
  (555 fases over 48 pipelines). "Rotting" staat aan op 1 396 van de 2 625 open deals en is daardoor
  betekenisloos.
- **Geen webhooks in geen enkel account.** Alle koppelingen zijn polling.

## 7. Datakwaliteit die een ander platform moet kennen

- **Open deals hebben vaak geen bedrag.** "Open waarde" oogt daardoor structureel te laag; de waarde
  zit in gewonnen en verloren deals.
- **Grote opschoning ± juni 2026**: UNABO ging van ±3 227 naar ±900 deals, TKN van ±1 044 naar ±620.
  Vergelijkingen over die grens heen zijn niet zuiver.
- **Bijna-dubbele namen** (labels en productnamen die verschillen in spatie of hoofdletter) worden
  waar mogelijk samengevoegd; de rest blijft zichtbaar zodat iemand het in Pipedrive opruimt.
- **Dezelfde B2B-lijst staat in vier accounts** (±4 400 organisaties). 877 contacten kregen in meer dan
  één account een deal, 123 daarvan binnen 30 dagen: de eigen merken botsen op dezelfde prospect. Wie
  over accounts heen telt, moet ontdubbelen op organisatie/e-mail.
- **Synchronisatiefouten zijn onzichtbaar** tenzij je ze toont. Een stille sync-fout hield de
  advertentiedata twaalf dagen stil zonder melding. Toon altijd het laatste ververs-moment.

## 8. Compacte regelset (het overdraagbare deel)

1. Firma = Pipedrive-account. Vier tellen mee, HarmonieBOUW niet.
2. Aantallen tel je op de pipeline; euro's tel je op de productregels.
3. Afdeling = tekst vóór de eerste dubbele punt in de productnaam; geen prefix = `Niet toegewezen`.
4. Engineering heeft twee scopes: ruim voor aantallen (TKN + UNABO-Engineering-pipeline of -product),
   strikt voor omzet (alleen ENGINEERING-productregels + alle TKN-regels).
5. Deal-label = uitsluitend het kanaal. Tweelaags: hoofdkanaal → subkanaal, via configuratie.
6. Thema is de dwarsdoorsnede over firma's heen, gematcht op productnaam.
7. Elke meting zijn eigen datum: aanvraag `add_time`, gewonnen `won_time`, verloren `lost_time`.
8. Verliesredenen normaliseren naar acht hoofdredenen; onbekende tonen onder eigen naam.
9. Verbergen is geen verwijderen.
10. Nooit schrijven, nooit forecasten op euro's, nooit meten per persoon.
11. Een leeg veld toon je als "nog niet gevuld" — nooit als 0 en nooit als percentage.
12. Alles wat per configuratie kan (labels, thema's, verliesredenen, custom fields) hoort in
    configuratie, zodat het team het zonder ontwikkelaar kan bijwerken.
