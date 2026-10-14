import { NextResponse } from "next/server";
import { magBisson } from "@/lib/toegang";
import { bewaarVaststelling, vaststellingen } from "@/lib/vaststellingen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vaststellingen bij het Bisson-overzicht. Enkel wie het overzicht mag zien (magBisson):
// de directie en Matthew. De naam komt uit de login, nooit uit het verzoek.
function wie(req: Request): string | null {
  const groepen = req.headers.get("x-authentik-groups");
  const naam = req.headers.get("x-authentik-username") || (process.env.TOEGANG_DEV === "1" ? "lokaal" : "");
  return naam && magBisson(groepen, naam) ? naam : null;
}

export async function GET(req: Request) {
  if (!wie(req)) return NextResponse.json({ error: "Geen toegang." }, { status: 403 });
  return NextResponse.json(vaststellingen());
}

export async function POST(req: Request) {
  const naam = wie(req);
  if (!naam) return NextResponse.json({ error: "Geen toegang." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  try {
    bewaarVaststelling(String(body?.sleutel || ""), body?.status ?? null, body?.notitie ?? null, naam);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 400 });
  }
  return NextResponse.json({ ok: true, vaststellingen: vaststellingen() });
}
