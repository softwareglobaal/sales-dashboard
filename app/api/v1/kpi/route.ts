import { NextResponse } from "next/server";
import { agentGuard } from "@/lib/agentAuth";
import { leesParams } from "@/lib/agentApi";
import { getEngineeringKpisWithDelta } from "@/lib/queries";
import { getEnergyKpisWithDelta } from "@/lib/energyQueries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Kerncijfers van een afdeling, inclusief de vergelijking met de vorige,
// even lange periode. Exact dezelfde functies als de tabbladen gebruiken.
export async function GET(req: Request) {
  const blok = agentGuard(req);
  if (blok) return blok;

  const p = leesParams(req);
  if (!p.ok) return p.antwoord;

  const k = p.afdeling === "energy" ? getEnergyKpisWithDelta(p.periode) : getEngineeringKpisWithDelta(p.periode);

  return NextResponse.json({
    afdeling: p.afdeling,
    periode: p.periode,
    bereik: p.bereik,
    aanvragen: k.requests,
    verkocht: k.wonCount,
    omzet: k.wonValue,
    gemDagenTotVerkoop: k.avgDays,
    vorigePeriode: k.prev
      ? { aanvragen: k.prev.requests, verkocht: k.prev.wonCount, omzet: k.prev.wonValue }
      : null,
    verschilProcent: { aanvragen: k.dRequests, verkocht: k.dWonCount, omzet: k.dWonValue },
    toelichting:
      "Aanvragen tellen op aanmaakdatum (add_time); verkocht en omzet op de datum van winnen. Zie DASHBOARD-SPEC.md.",
  });
}
