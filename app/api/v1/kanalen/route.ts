import { NextResponse } from "next/server";
import { agentGuard } from "@/lib/agentAuth";
import { leesParams } from "@/lib/agentApi";
import { getEngineeringChannels } from "@/lib/queries";
import { getEnergyChannels } from "@/lib/energyQueries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Aanvragen per kanaal (uit de labels in Pipedrive), met subkanalen zoals
// individuele architectenkantoren. Hiermee kan een agent zien waar de instroom
// vandaan komt en welk kanaal wegvalt.
export async function GET(req: Request) {
  const blok = agentGuard(req);
  if (blok) return blok;

  const p = leesParams(req);
  if (!p.ok) return p.antwoord;

  const rijen = p.afdeling === "energy" ? getEnergyChannels(p.periode) : getEngineeringChannels(p.periode);

  return NextResponse.json({
    afdeling: p.afdeling,
    periode: p.periode,
    bereik: p.bereik,
    kanalen: rijen.map((r) => ({
      kanaal: r.channel,
      aanvragen: r.leads,
      gewonnen: r.won,
      open: r.open,
      verloren: r.lost,
      subkanalen: r.subs.map((s) => ({
        naam: s.sub,
        aanvragen: s.leads,
        gewonnen: s.won,
        open: s.open,
        verloren: s.lost,
      })),
    })),
  });
}
