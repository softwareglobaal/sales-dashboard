// De teambeloning: één plek waar uit de omzet van een maand de pot volgt.
//
// De regels staan in config/commissie.json (voorstel sep 2026, Joey & Shelton
// 50/50). Zowel de balk op het dashboard als de agent-API rekenen hiermee,
// zodat er maar één waarheid is — zie DASHBOARD-SPEC.md. Payrun haalt de
// uitkomst op en zet er een commissieregel van; die rekent dus ook niets zelf
// opnieuw uit.

import cfg from "@/config/commissie.json";

export type Mijlpaal = { omzet: number; pot: number };
export type CommissieAfdeling = {
  titel: string;
  omvat: string;
  vertrek: number;
  doel: number;
  breakeven?: number;
  mijlpalen: Mijlpaal[];
  extraRegels: string[];
};
export type Deel = { naam: string; aandeel: number; bedrag: number };
export type Beloning = {
  afdeling: Afdeling;
  omzet: number;
  doel: number;
  behaald: Mijlpaal | null;
  volgende: Mijlpaal | null;
  pot: number;
  verdeling: Deel[];
};

export type Afdeling = "engineering" | "energy";

export function commissieConfig(afdeling: Afdeling): CommissieAfdeling {
  return cfg[afdeling] as CommissieAfdeling;
}

export function commissieStatus(): string {
  return (cfg as { status?: string }).status || "";
}

export function algemeneRegels(): string[] {
  return (cfg as { algemeneRegels?: string[] }).algemeneRegels || [];
}

// Per maand telt de hoogst behaalde mijlpaal; de bedragen stapelen niet.
export function beloning(afdeling: Afdeling, omzet: number): Beloning {
  const c = commissieConfig(afdeling);
  const behaald = [...c.mijlpalen].reverse().find((m) => omzet >= m.omzet) || null;
  const volgende = c.mijlpalen.find((m) => omzet < m.omzet) || null;
  const pot = behaald?.pot || 0;
  return { afdeling, omzet, doel: c.doel, behaald, volgende, pot, verdeling: verdeel(pot) };
}

// De pot over de deelnemers, in hele centen. Wat er door het afronden
// overblijft gaat naar de laatste, zodat de delen samen exact de pot zijn —
// anders klopt de loonadministratie aan de andere kant een cent niet.
export function verdeel(pot: number): Deel[] {
  const delen = ((cfg as { verdeling?: { naam: string; aandeel: number }[] }).verdeling || []).slice();
  const centen = Math.round(pot * 100);
  let uit = 0;
  return delen.map((d, i) => {
    const eigen = i === delen.length - 1 ? centen - uit : Math.round(centen * d.aandeel);
    uit += eigen;
    return { naam: d.naam, aandeel: d.aandeel, bedrag: eigen / 100 };
  });
}
