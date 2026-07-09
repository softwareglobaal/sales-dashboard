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
_(status: gepland)_

- [ ] Aparte "Bundel"-sectie (aanvraag / offerte / gewonnen / verloren)
- [ ] Woordenboek/definitie-tab (o.a. verliesredenen)
- [ ] Aanvraagdatum tonen bij gewonnen deals
- [ ] Dag/uur-analyse (wanneer komen aanvragen binnen)
- [ ] Conversie % over langere periode

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
_(wordt tijdens de sessie aangevuld)_
