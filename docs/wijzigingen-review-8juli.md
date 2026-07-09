# Wijzigingen n.a.v. review 8 juli (autonome sessie)

Dit document beschrijft alles wat is aangepast na de feedback-meeting van 8 juli, zodat we weten "vanwaar we komen" en desnoods kunnen terugdraaien (elke sprint = aparte git-commit).

**Regels deze sessie:** Pipedrive alleen-lezen (géén wijzigingen), twijfelgevallen worden overgeslagen en onderaan bij "Openstaand / laten staan" genoteerd.

---

## Sprint 1 — Fixes & verduidelijkingen (Groep A)
_(status: ✅ KLAAR — commit "review-8juli sprint 1")_

- [x] Excl. btw-melding als klein vast blok (chip in Engineering-header) — `app/engineering/page.tsx`
- [x] Kanaal-% duidelijker: kolomkop → "Aandeel v/d aanvragen" + tooltip — `components/ChannelTable.tsx`
- [x] Diensten-tabel: uitleg dat "verkocht" in andere maand kan vallen dan "aanvragen" — `app/engineering/page.tsx`
- [x] "Aanvragen vs. direct gewonnen omzet": titel + uitleg verduidelijkt — `app/engineering/page.tsx`
- [x] Adres-parser: gemeente-zonder-postcode terugval (`lib/cityCoords.ts` = 1155 gemeenten; `lib/regio.ts`). Kaartdekking: 42 i.p.v. 46 zonder adres.
- [x] Kaart: provincie- + stad-labels + kantoornamen + "Namen"-toggle — `components/BelgiumMap.tsx`

## Sprint 2 — Nieuwe onderdelen (Groep B, deel 1)
_(status: ✅ KLAAR — commit "review-8juli sprint 2")_

- [x] Woordenboek/definitie-tab (o.a. verliesredenen) — nieuwe pagina `app/woordenboek/page.tsx` + zijbalk-item. Toont kernbegrippen (aanvraag, offerte, conversie, bundel, scope, kanaal, …) en groepeert alle ruwe verliesredenen onder de 8 hoofd-redenen (leest `config/lossReasons.json`). Onzekere items gemarkeerd met "controleren".
- [x] Aanvraagdatum tonen bij deal-lijsten — kolom "aangemaakt" toegevoegd in de klikbare deal-detaillijsten (aanvragen/gewonnen/verloren). `lib/queries.ts` (`DealMini.addDate` via `getEngineeringActivity`) + `components/Charts.tsx`.
- [x] Dag/uur-analyse "Wanneer komen aanvragen binnen?" — nieuwe sectie in de Engineering-tab met twee grafieken (per weekdag / per uur), Belgische tijd. `lib/queries.ts` (`getEngineeringTiming`), `components/Charts.tsx` (`TimingBars`), `app/engineering/page.tsx` + sub-nav "Dag & uur".
- [x] Conversie % — stat "Conversie" toegevoegd aan de offerte-strip (aandeel aanvragen → gewonnen), met uitleg dat het over kortere periodes ruwer is.
- [~] Aparte "Bundel"-sectie (aanvraag / offerte / gewonnen / verloren) — **bewust beperkt gehouden** (zie "Openstaand"). De bundel-vs-los verdeling bestaat al voor **gewonnen** deals (in Omzet & bundel). Voor open/verloren deals is de bundel-classificatie onbetrouwbaar omdat producten daar vaak nog niet ingevuld zijn; een volledige trechter zou misleidend zijn.

## Sprint 3 — Nieuwe onderdelen (Groep B, deel 2)
_(status: gepland)_

- [ ] Targets op KPI's (mechanisme; waarden door jou in te vullen)
- [ ] Kosten per lead/kanaal (config-gedreven)
- [ ] AI-analyse per deal (klik deal → "wat is er gebeurd")

## Sprint 4 — Placeholders die wachten op Pipedrive-velden (Groep C)
_(status: gepland)_

- [ ] Projecttype-uitsplitsing (vult zich als velden ingevuld zijn)
- [ ] Geslacht-analyse (idem)
- [ ] Meeting-metrics (wacht op data)

---

## Openstaand / bewust laten staan (twijfel of externe input nodig)

- **Volledige bundel-trechter (aanvraag → offerte → gewonnen → verloren):** bundel-vs-los kan enkel betrouwbaar bepaald worden voor gewonnen deals (producten dan ingevuld). Voor open/verloren deals ontbreken producten vaak → laten staan tot dit met Mehdi besproken is. Bundel-vs-los voor gewonnen deals staat al in "Omzet & bundel".
- **Targets/streefwaarden op KPI's:** mechanisme kan gebouwd worden, maar de waarden moeten door jullie ingevuld worden. Wacht op input (Sprint 3).
- **Kosten per lead/kanaal:** vereist de exacte advertentiekosten (Google Ads / website). Wacht op de Google Ads-koppeling die jij aan jullie kant voorbereidt.
- **Geslacht, projecttype-detail, meeting-metrics:** placeholders staan klaar; vullen zich zodra de Pipedrive-velden bestaan/ingevuld zijn.
- **Exacte definities van enkele verliesredenen:** in het Woordenboek gemarkeerd met "controleren".
