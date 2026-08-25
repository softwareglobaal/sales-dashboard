# Agent-API (`/api/v1`)

Leesalleen-koppeling voor de Sales/Marketing-agents op `siyanagents.globaal.be`.

## Waarom deze API bestaat

De agents en het dashboard werken op dezelfde gegevens. Zonder koppeling leidt
elk systeem alles zelf opnieuw af uit Pipedrive — en dan lopen de cijfers ooit
uit elkaar. Dan heb je twee getallen en geen waarheid.

Het dashboard bezit de definities: wat telt als aanvraag, op welke datum, welke
pipelines in scope zitten, hoe kanalen uit labels worden afgeleid. Die staan in
[DASHBOARD-SPEC.md](../DASHBOARD-SPEC.md) en zijn moeizaam vastgelegd. Deze API
levert de **uitkomst** van die definities uit, zodat de agents niets hoeven na te
rekenen.

De API is **strikt lezend**. Het dashboard schrijft nooit naar Pipedrive; die
grens verandert hier niet. Mutaties blijven het werk van de agents zelf, achter
hun eigen goedkeuringspoort.

## Toegang

Een agent heeft geen browsersessie en kan dus niet door de Authentik-poort. Hij
legitimeert zich met een gedeeld token:

```
Authorization: Bearer $SALES_AGENT_TOKEN
```

Het token staat in `~/Claude/credentials.env` (de enige bron) en komt via
`sync-credentials.sh` op de server terecht. Staat `SALES_AGENT_TOKEN` niet
ingesteld, dan geeft elk endpoint **503** — de API staat dan uit. Dat is bewust:
liever dicht dan met een standaardwaarde open.

In de nginx-vhost gaat `/api/v1/` langs de forward-auth, met de
`X-authentik-*`-headers hard leeggemaakt. Een agent kan zich dus niet als
gebruiker voordoen.

## Parameters

| Parameter | Waarden | Standaard |
|---|---|---|
| `periode` | `12m`, `ytd`, `prev_year`, `all`, `2026-01` … `2026-12`, `wk:JJJJ-MM-DD` | `12m` |
| `afdeling` | `engineering`, `energy` | `engineering` |
| `account` | alleen bij `/campagnes`: Pipedrive-accountsleutel | `unabo` |

## Endpoints

### `GET /api/v1/health`

Versheid van de gegevens per bron. **Controleer dit vóór je op de cijfers
afgaat.** Geeft per bron de laatste sync, de ouderdom in uren, de status en de
foutmelding, plus een samenvattend `gezond` en een lijst `waarschuwingen`.

Aanleiding: op 2026-08-24 bleek de advertentie-sync twaalf dagen stil te staan.
De fout stond netjes in de database, maar was nergens zichtbaar. Een agent die
dit endpoint leest, ziet het meteen.

### `GET /api/v1/kpi`

Aanvragen, verkocht, omzet en gemiddelde doorlooptijd tot verkoop, met de
vergelijking met de vorige even lange periode (`verschilProcent`).

### `GET /api/v1/kanalen`

Aanvragen per kanaal, met subkanalen (bijvoorbeeld individuele
architectenkantoren) en de verdeling gewonnen / open / verloren.

### `GET /api/v1/diensten`

Per dienst: aanvragen, verkocht, omzet en gemiddelde doorlooptijd. Omzet komt
van de productprijs, niet van de dealwaarde.

### `GET /api/v1/campagnes`

Google Ads per campagne: uitgaven, klikken, vertoningen, conversies, CTR, kost
per klik en kost per conversie, plus een `versheid`-blok.

**Let op het verschil:** `conversies` zijn wat Google op de site telt,
`aanvragen` (uit `/kpi`) zijn deals in Pipedrive. Die twee lopen niet gelijk.
Voor beoordeling van een campagne is de kost per *aanvraag* de eerlijkste
maatstaf.

## Voorbeeld

```sh
curl -s -H "Authorization: Bearer $SALES_AGENT_TOKEN" \
  "https://sales.globaal.be/api/v1/kpi?afdeling=engineering&periode=2026-08"
```

## Onderhoud

Nieuwe cijfers horen hier pas bij als ze in het dashboard bestaan. Bouw nooit een
tweede berekening in dit bestand of in de agents — voeg de functie toe aan
`lib/queries.ts` of `lib/energyQueries.ts` en geef de uitkomst door. Anders is de
reden waarom deze API bestaat meteen weg.
