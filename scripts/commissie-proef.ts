// Controle op de teambeloning (lib/commissie.ts): telt de hoogst behaalde
// mijlpaal, en komt de verdeling exact op de pot uit? Dat laatste is geen
// detail: Payrun zet deze bedragen in de loonadministratie, en daar mag geen
// cent zoekraken.
//
// Draaien:
//   JITI_ALIAS='{"@/":"'$PWD/'"}' ./node_modules/.bin/jiti scripts/commissie-proef.ts

const C = require("../lib/commissie");

let fout = 0;
function gelijk(wat: string, a: unknown, b: unknown) {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) fout++;
  console.log((ok ? "ok   " : "FOUT ") + wat + (ok ? "" : `  kreeg ${JSON.stringify(a)}, wilde ${JSON.stringify(b)}`));
}

gelijk("engineering 24.999 -> pot 350", C.beloning("engineering", 24999).pot, 350);
gelijk("engineering 25.000 -> pot 500", C.beloning("engineering", 25000).pot, 500);
gelijk("engineering 9.999 -> geen pot", C.beloning("engineering", 9999).pot, 0);
gelijk("boven het doel -> de hoogste pot, niet opgeteld", C.beloning("engineering", 99999).pot, 700);
gelijk("energy 15.000 -> pot 100", C.beloning("energy", 15000).pot, 100);

for (const pot of [0, 50, 100, 175, 350, 700, 0.01, 12.33]) {
  const d = C.verdeel(pot);
  const som = Math.round(d.reduce((t: number, x: { bedrag: number }) => t + x.bedrag, 0) * 100) / 100;
  gelijk(`verdeling van ${pot} telt op tot ${pot}`, som, pot);
}
gelijk("350 wordt 175/175", C.verdeel(350).map((d: { bedrag: number }) => d.bedrag), [175, 175]);
gelijk("een oneven cent gaat naar de laatste", C.verdeel(0.01).map((d: { bedrag: number }) => d.bedrag), [0.01, 0]);
gelijk("zonder pot geen bedragen", C.beloning("energy", 0).verdeling.map((d: { bedrag: number }) => d.bedrag), [0, 0]);

console.log(fout ? `\n${fout} fout` : "\nalles klopt");
process.exit(fout ? 1 : 0);
