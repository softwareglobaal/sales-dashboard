# Architectenregister — Orde van Architecten (Vlaamse Raad)

Bronbestand: `architecten-orde-2026-09.json`
Bron: <https://vind.architect.be> — het publieke ledenregister van de Vlaamse Raad
van de Orde van Architecten.
Opgehaald: 9 september 2026. Handmatig ververst, net als het VEKA-register.

Dit is de bron onder de markt **architectuur** in de concurrentiemonitor
(`/h-architects/concurrentie`). Waar de energiemarkt op het VEKA-register steunt en
de engineering-markt op niets, heeft deze markt een volledig register: in België
mag niemand het beroep van architect uitoefenen zonder inschrijving bij de Orde,
en de Orde publiceert die inschrijvingen.

---

## Hoe de gegevens opgehaald zijn

De zoektool op vind.architect.be is een Laravel/Livewire-toepassing. Ze is van
buitenaf onderzocht — netwerkverzoeken en de JavaScript-bundel gelezen — en dat
leverde het volgende beeld op.

**Wat er níét werkt om een lijst te krijgen**

- `GET /api/suggestions?q=<term>` geeft nette JSON per lid (naam, stamnummer,
  postcode, gemeente, provincie, type, profiel-URL, expertises) plus een
  `totalHits`. Maar het aantal treffers is aan de serverkant hard begrensd op
  **drie**; `limit` en `per_page` doen niets. Bruikbaar om één naam op te zoeken,
  niet om een register op te bouwen.
- `GET /api/members/at-location?lat=..&lng=..` hoort bij de kaartpopup en geeft
  alleen iets terug voor een exact kaartpunt. Op een gemeentecoördinaat antwoordt
  hij `[]`.
- `/zoek` zonder parameters stuurt door naar de homepage.

**Wat wél werkt, en waarom we dat gekozen hebben**

De site publiceert zelf een sitemap: `https://vind.architect.be/sitemap.xml`,
aangekondigd in haar eigen `robots.txt`. Die bevat **11.965 profielpagina's**, één
per inschrijving, in de vorm `/<naam-slug>/<stamnummer>`. Elke profielpagina toont
publiek: naam, e-mailadres, telefoon, website, adres, stamnummer, tabel
(= provincie), type (natuurlijke persoon of rechtspersoon), rechtsvorm en de
vennoten van een vennootschap.

Er is dus geen enkele reden om de zoektool na te bootsen: de site geeft zelf de
volledige lijst, en die lijst is bedoeld om gevonden te worden.

**Wat het opleverde** (9 september 2026)

11.950 van de 11.965 profielen; de vijftien overige geven een 404 — die inschrijvingen
zijn verdwenen sinds de sitemap werd opgebouwd. Verdeling per tabel: Antwerpen 3.230,
Oost-Vlaanderen 3.122, Vlaams-Brabant 2.492, West-Vlaanderen 1.757, Limburg 1.340,
onbekend 9. Naar soort: 8.923 natuurlijke personen en 3.027 vennootschappen. 1.519
inschrijvingen gaven zelf een website op; met het e-maildomein erbij levert dat
**1.945 unieke domeinen** op, waarvan er 1.456 gecrawld worden (zie DASHBOARD-SPEC §13).

**Hoe we ons gedragen hebben**

- `robots.txt` van vind.architect.be staat crawlen volledig toe
  (`User-agent: *` met een lege `Disallow:`, en een verwijzing naar de sitemap).
  Er staat geen `Crawl-delay` in.
- Eigen User-Agent met contactdomein:
  `HArchitectsConcurrentieMonitor/1.0 (+https://h-architects.be)`.
- Elke pagina één keer opgehaald, met een pauze tussen de verzoeken. Vijf
  parallelle werkers, ongeveer vijf verzoeken per seconde, ruim een half uur werk.
- Alleen lezen. Geen formulier ingevuld, geen account, geen login, geen
  bot-detectie omzeild. Er is niets naar die site geschreven.
- De lijst komt uit hun eigen sitemap; er zijn geen URL's geraden.

Dat is dezelfde afspraak als in DASHBOARD-SPEC §10 voor de sitecrawl:
publiek materiaal, uitsluitend lezen, en een site die nee zegt krijgt geen
tweede poging.

---

## Wat er in het bestand staat

```
bron, bron_url, opgehaald, methode, beperkingen, aantallen, records[]
```

Per record:

| veld | betekenis |
|---|---|
| `stamnummer` | `A######` = natuurlijke persoon, `B######` = vennootschap |
| `naam` | zoals de Orde hem publiceert |
| `soort` | `persoon` of `vennootschap` |
| `rechtsvorm` | BV, NV, CommV, … (leeg bij personen) |
| `straat`, `postcode`, `gemeente` | het adres van de inschrijving — vaak leeg bij personen |
| `provincie` | de **tabel** waarop de inschrijving staat |
| `telefoon`, `email`, `website` | zoals gepubliceerd op de profielpagina |
| `domein` | afgeleid: de website, anders het e-maildomein |
| `profiel_url` | de publieke profielpagina |
| `vennoten` | stamnummers van de vennoten van een vennootschap |

**Hoe `domein` afgeleid wordt.** Eerst de opgegeven website (zonder `www.`).
Staat daar een sociaal profiel — een handvol leden geeft alleen Instagram op —
dan telt dat niet als website en valt de afleiding terug op het e-maildomein.
Een gratis provider (telenet, gmail, skynet, …) levert geen domein op: daar zit
geen bedrijfssite achter. Wie geen van beide heeft, houdt een leeg `domein` en
wordt dus nooit gecrawld.

---

## Beperkingen — wat dit bestand níét is

- **De meeste personen hebben geen adres.** Van de 8.923 natuurlijke personen
  publiceert de Orde er maar 294 met adres; bij de 3.027 vennootschappen zijn dat
  er 2.339. Dat is geen leesfout van ons — de profielpagina van een persoon toont
  meestal gewoon geen adres. Praktisch valt het mee: van de **1.945 domeinen die
  wij volgen heeft 97 % (1.895) wél een gemeente, en 100 % een provincie**, want
  het domein hangt bijna altijd aan een vennootschap. Waar het wél schuurt is de
  tabel "drukste gemeenten": die telt alleen wie een adres publiceerde, en zegt
  dat er ook bij.
- **Negen inschrijvingen hebben zelfs geen provincie.** Die vallen in het
  dashboard onder "onbekend".
- **De provincie is een inschrijvingstabel, geen werkgebied.** Een architect
  ingeschreven op de tabel Vlaams-Brabant werkt vaak ook in Antwerpen. Het
  regiofilter op de pagina zegt dus waar bureaus *zitten*, niet waar ze *werken*.
- **Inschrijvingen zijn geen bureaus.** Een bureau met drie vennoten en een BV
  staat vier keer in dit bestand. Wie de markt in bureaus wil tellen, telt
  domeinen — dat is ook wat de crawler doet.
- **Ingeschreven is niet hetzelfde als actief.** Het register kent geen
  "gepensioneerd" of "in loondienst". Een architect zonder website en zonder eigen
  e-maildomein is voor deze monitor onzichtbaar, en dat is meestal terecht — maar
  niet altijd.
- **Frans- en Duitstalig België ontbreekt.** vind.architect.be is de Vlaamse Raad.
  Voor Wallonië en Brussel bestaat een aparte raad
  (`ordredesarchitectes.be`), die hier niet ingelezen is: het werkgebied van
  H-Architects is Vlaanderen.
- **Het is een momentopname.** Verversen betekent: het exportscript opnieuw
  draaien en het bestand vervangen. De datum staat in `opgehaald`, en het
  dashboard toont die.

---

## Persoonsgegevens

Naam, e-mailadres, telefoonnummer en adres komen uit een openbaar register, maar
blijven persoonsgegevens. Dezelfde afspraak als bij het VEKA-register, en die
staat in DASHBOARD-SPEC §10:

- intern gebruik, achter Authentik, in een privé-repo;
- niet exporteren, niet doorverkopen;
- niet verrijken met gegevens van buiten dit register;
- de tabel `architecten` wordt niet via de publieke API ontsloten.

---

## Verversen

Het ophaal- en exportscript staat in `scripts/architecten-register.py`. Het is
eenmalig werk en geen onderdeel van de draaiende app — vandaar een los script en
geen route. Drie stappen, de tweede is hervatbaar:

```
python3 scripts/architecten-register.py sitemap      # profiel-URL's uit hun sitemap
python3 scripts/architecten-register.py ophalen      # elke profielpagina één keer lezen (~40 min)
python3 scripts/architecten-register.py exporteren   # dit bronbestand schrijven
```

De tussenbestanden komen in `data-bronnen/.architecten-werk/` en staan in
`.gitignore`: dat zijn 11.965 ruwe profielpagina-uittreksels, geen bron.
Onderbreek je stap twee, dan pikt een herstart de draad op waar hij lag — geen
enkele pagina wordt twee keer opgehaald.

Daarna in het dashboard:

```
/api/concurrentie?import=1&crawl=0     # registers inlezen, geen site bezoeken
/api/concurrentie?herbereken=1         # marktindeling opnieuw afleiden
```
