import { NextResponse } from "next/server";
import { agentGuard } from "@/lib/agentAuth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Versheid van de gegevens. Een agent hoort dit te controleren vóór hij op de
// cijfers afgaat: een sync die stilvalt is hier eerder zichtbaar dan in de UI.
// (De advertentie-sync stond op 2026-08-24 twaalf dagen stil zonder dat iemand
// het zag — precies wat dit endpoint moet voorkomen.)
export async function GET(req: Request) {
  const blok = agentGuard(req);
  if (blok) return blok;

  const db = getDb();
  const rijen = db
    .prepare("SELECT account_key, last_sync, deal_count, status, message FROM sync_meta ORDER BY account_key")
    .all() as { account_key: string; last_sync: string | null; deal_count: number; status: string; message: string | null }[];

  const nu = Date.now();
  const bronnen = rijen.map((r) => {
    const ouderdomUren = r.last_sync ? Math.round(((nu - Date.parse(r.last_sync)) / 3_600_000) * 10) / 10 : null;
    return {
      bron: r.account_key,
      soort: r.account_key.startsWith("ads:") ? "advertenties" : "deals",
      laatsteSync: r.last_sync,
      ouderdomUren,
      aantal: r.deal_count,
      status: r.status,
      melding: r.message,
    };
  });

  // De dagelijkse sync draait op werkdagen om 06:45 UTC. Ouder dan 48 uur of een
  // foutstatus betekent: niet op deze cijfers vertrouwen.
  const kapot = bronnen.filter((b) => b.status !== "ok");
  const oud = bronnen.filter((b) => b.ouderdomUren !== null && b.ouderdomUren > 48);
  const gezond = kapot.length === 0 && oud.length === 0;

  return NextResponse.json({
    gezond,
    waarschuwingen: [
      ...kapot.map((b) => `${b.bron}: sync staat op '${b.status}' (${b.melding ?? "geen melding"})`),
      ...oud.map((b) => `${b.bron}: laatste sync is ${b.ouderdomUren} uur oud`),
    ],
    bronnen,
  });
}
