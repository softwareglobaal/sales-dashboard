import { NextResponse } from "next/server";
import { haalSearchConsole, gscBeschikbaar, lijstProperties } from "@/lib/searchConsole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const url = new URL(request.url);

  // ?check=1 toont enkel welke properties bereikbaar zijn — handig bij het opzetten.
  if (url.searchParams.get("check") === "1") {
    const status = gscBeschikbaar();
    if (!status.klaar) return NextResponse.json({ ok: false, ...status });
    try {
      return NextResponse.json({ ok: true, properties: await lijstProperties() });
    } catch (e) {
      return NextResponse.json({ ok: false, fout: String((e as Error).message) });
    }
  }

  const dagen = Number(url.searchParams.get("dagen") || 28);
  return NextResponse.json(await haalSearchConsole(dagen));
}

export const POST = GET;
