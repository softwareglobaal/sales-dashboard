import { NextResponse } from "next/server";
import { agentGuard } from "@/lib/agentAuth";
import { leesParams } from "@/lib/agentApi";
import { getEngineeringServices } from "@/lib/queries";
import { getEnergyServices } from "@/lib/energyQueries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Prestaties per dienst: aanvragen, verkocht, omzet en de gemiddelde doorlooptijd
// van aanvraag tot verkoop. Omzet komt van de productprijs, niet van de dealwaarde.
export async function GET(req: Request) {
  const blok = agentGuard(req);
  if (blok) return blok;

  const p = leesParams(req);
  if (!p.ok) return p.antwoord;

  const rijen = p.afdeling === "energy" ? getEnergyServices(p.periode) : getEngineeringServices(p.periode);

  return NextResponse.json({
    afdeling: p.afdeling,
    periode: p.periode,
    bereik: p.bereik,
    diensten: rijen.map((r) => ({
      dienst: r.service,
      bron: r.source,
      aanvragen: r.requests,
      verkocht: r.soldCount,
      omzet: r.revenue,
      gemDagenTotVerkoop: r.avgDays,
    })),
  });
}
