import { NextResponse } from "next/server";
import { bewaarIntro } from "@/lib/intro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Antwoord op de introductievraag. Iedereen mag dit (ook kijkers): het bewaart enkel
// dat de vraag gesteld is. De naam komt uit de login, nooit uit het verzoek.
export async function POST(req: Request) {
  const wie = req.headers.get("x-authentik-username") || (process.env.TOEGANG_DEV === "1" ? "lokaal" : "");
  if (!wie) return NextResponse.json({ error: "Geen gebruiker." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  bewaarIntro(wie, body?.keuze === "ja" ? "ja" : "nee");
  return NextResponse.json({ ok: true });
}
