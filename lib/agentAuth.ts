// Toegangscontrole voor de agent-API (/api/v1/*).
//
// De Sales/Marketing-agents hebben geen browsersessie, dus ze kunnen niet door
// de Authentik-poort. Ze legitimeren zich met een gedeeld token uit de omgeving.
// De nginx-vhost laat /api/v1/ langs de forward-auth en maakt de
// X-authentik-*-headers hard leeg, zodat een agent zich niet als gebruiker kan
// voordoen.
//
// Leeg token = endpoint uit. Dat is bewust: liever niets uitleveren dan met een
// standaardwaarde open staan.

import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

function gelijk(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

// Geeft null als de aanvraag mag; anders het antwoord dat teruggestuurd moet worden.
export function agentGuard(req: Request): NextResponse | null {
  const verwacht = process.env.SALES_AGENT_TOKEN || "";
  if (!verwacht) {
    return NextResponse.json(
      { error: "De agent-API staat uit: SALES_AGENT_TOKEN is niet ingesteld." },
      { status: 503 },
    );
  }
  const kop = req.headers.get("authorization") || "";
  const token = kop.startsWith("Bearer ") ? kop.slice(7).trim() : "";
  if (!token || !gelijk(token, verwacht)) {
    return NextResponse.json({ error: "Geen geldig token." }, { status: 401 });
  }
  return null;
}
