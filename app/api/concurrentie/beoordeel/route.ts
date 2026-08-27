import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OORDELEN = ["prospect", "geen-prospect", "concurrent", "klant"];

/**
 * Legt een menselijk oordeel vast over een verslaggever of een bedrijf.
 * Schrijfrechten worden al afgedwongen door de middleware: alleen namen uit
 * EDITOR_USERS komen hier voorbij, de rest krijgt 403.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    soort?: string; sleutel?: string; oordeel?: string; notitie?: string;
  };
  const soort = body.soort === "domein" ? "domein" : "verslaggever";
  const sleutel = (body.sleutel || "").trim();
  const oordeel = (body.oordeel || "").trim();

  if (!sleutel) return NextResponse.json({ error: "sleutel ontbreekt" }, { status: 400 });

  const db = getDb();
  const door = req.headers.get("x-authentik-username") || "onbekend";
  const nu = new Date().toISOString();

  // Leeg oordeel = terugdraaien naar de automatische indeling.
  if (!oordeel) {
    db.prepare("DELETE FROM beoordelingen WHERE soort = ? AND sleutel = ?").run(soort, sleutel);
    return NextResponse.json({ ok: true, oordeel: null });
  }
  if (!OORDELEN.includes(oordeel)) {
    return NextResponse.json({ error: `oordeel moet een van ${OORDELEN.join(", ")} zijn` }, { status: 400 });
  }

  db.prepare(
    `INSERT INTO beoordelingen (soort, sleutel, oordeel, notitie, door, datum)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(soort, sleutel) DO UPDATE SET
       oordeel = excluded.oordeel, notitie = excluded.notitie,
       door = excluded.door, datum = excluded.datum`
  ).run(soort, sleutel, oordeel, body.notitie || null, door, nu);

  return NextResponse.json({ ok: true, oordeel, door, datum: nu });
}
