// Pariteitscontrole herinrichting (spec §17): de generieke dienstlaag moet voor
// Engineering en Energy exact dezelfde cijfers geven als de oude querymodules.
// Lokaal draaien tegen een kopie van de databank (nooit tegen productie-tokens):
//   JITI_ALIAS='{"@/":"'$PWD/'"}' ./node_modules/.bin/jiti scripts/pariteit-diensten.ts

const A = require("../lib/afdelingen");
const Q = require("../lib/queries");
const E = require("../lib/energyQueries");
for (const per of ["ytd", "prev_year", "2026-08", "2025-06"]) {
  const eng = A.afdeling("engineering");
  const b = per === "ytd" ? { from: "2026-01-01", to: "9999-12-31" } : Q.periodBounds(per);
  const nieuw = A.kpis(A.dataset(eng), b.from, b.to);
  const oud = Q.getEngineeringKpis(per, undefined, "all");
  const unabo = A.kpis(A.filterFirma(A.dataset(eng), "unabo"), b.from, b.to);
  const oudU = Q.getEngineeringKpis(per, undefined, "unabo");
  const en = A.afdeling("energy");
  const nieuwE = A.kpis(A.filterFirma(A.dataset(en), "unabo"), b.from, b.to);
  const oudE = E.getEnergyKpisWithDelta(per);
  console.log(per, "ENG oud", oud.requests, oud.wonCount, oud.wonValue, "| nieuw", nieuw.aanvragen, nieuw.gewonnen, nieuw.omzet,
    "|| UNABO-eng oud", oudU.requests, oudU.wonCount, oudU.wonValue, "nieuw", unabo.aanvragen, unabo.gewonnen, unabo.omzet,
    "|| ENERGY oud", oudE.requests, oudE.wonCount, oudE.wonValue, "nieuw", nieuwE.aanvragen, nieuwE.gewonnen, nieuwE.omzet);
}
