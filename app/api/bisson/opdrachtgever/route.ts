import { NextResponse } from "next/server";
import { magBisson } from "@/lib/toegang";
import { bewaarOpdrachtgever, ingevuldeOpdrachtgevers } from "@/lib/vaststellingen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Zelf ingevulde architect of ingenieur voor een Bisson-project zonder opdrachtgever.
// Enkel wie het Bisson-overzicht mag zien (magBisson). De naam van wie invult komt uit de login.
function wie(req: Request): string | null {
  const naam = req.headers.get("x-authentik-username") || (process.env.TOEGANG_DEV === "1" ? "lokaal" : "");
  return naam && magBisson(req.headers.get("x-authentik-groups"), naam) ? naam : null;
}

export async function GET(req: Request) {
  if (!wie(req)) return NextResponse.json({ error: "Geen toegang." }, { status: 403 });
  return NextResponse.json(ingevuldeOpdrachtgevers());
}

export async function POST(req: Request) {
  const door = wie(req);
  if (!door) return NextResponse.json({ error: "Geen toegang." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  try {
    bewaarOpdrachtgever(String(body?.nr || ""), body?.naam ?? null, body?.soort ?? null, door);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 400 });
  }
  return NextResponse.json({ ok: true, ingevuld: ingevuldeOpdrachtgevers()[String(body?.nr)] || null });
}
