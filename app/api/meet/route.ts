import { NextRequest } from "next/server";
import { verwerk } from "@/lib/websitesMeting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Inname van de websitemeting (spec §15). Publiek bereikbaar via meet.globaal.be,
// buiten Authentik om; middleware.ts laat dit pad door. Neemt alleen gegevens aan
// voor de domeinen uit config/websites.json.

const KOPPEN = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

// Eenvoudige rem per IP tegen misbruik: een echte bezoeker komt hier nooit aan.
const teller = new Map<string, { n: number; tot: number }>();
function teVeel(ip: string): boolean {
  const nu = Date.now();
  const t = teller.get(ip);
  if (!t || t.tot < nu) {
    if (teller.size > 5000) teller.clear();
    teller.set(ip, { n: 1, tot: nu + 60_000 });
    return false;
  }
  return ++t.n > 120;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: KOPPEN });
}

export async function POST(req: NextRequest) {
  // nginx zet X-Real-IP zelf op het echte bronadres; een meegestuurde kop van de bezoeker wordt daar overschreven.
  const ip = req.headers.get("x-real-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  if (!ip || teVeel(ip)) return new Response(null, { status: 204, headers: KOPPEN });
  const ruw = await req.text();
  if (ruw.length > 64_000) return new Response(null, { status: 413, headers: KOPPEN });
  try {
    verwerk(JSON.parse(ruw), ip, req.headers.get("user-agent") || "", req.headers.get("origin"));
  } catch (e) {
    console.error("[meet]", e instanceof Error ? e.message : e);
  }
  // Altijd 204: het script op de site heeft niets aan een foutmelding.
  return new Response(null, { status: 204, headers: KOPPEN });
}
