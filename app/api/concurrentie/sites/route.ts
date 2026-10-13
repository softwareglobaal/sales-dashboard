import { NextResponse } from "next/server";
import { crawlSite, sitesMetConcurrentie } from "@/lib/siteConcurrentie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

/**
 * Crawlt de concurrenten van eigen sites zonder dienst (config/concurrentie-sites.json).
 *   ?site=angela   enkel die site; zonder parameter alle sites uit de config
 * Wordt wekelijks aangeroepen door scripts/concurrentie-cron.sh. Leest enkel publieke
 * sitemaps en homepages; er wordt nergens naar buiten geschreven.
 */
async function draai(url: URL) {
  const enkel = url.searchParams.get("site");
  const sites = sitesMetConcurrentie().filter((s) => !enkel || s.site === enkel);
  if (!sites.length) return { ok: false, fout: `onbekende site ${enkel}` };
  const uit: Record<string, unknown> = {};
  for (const s of sites) {
    const r = await crawlSite(s.site);
    uit[s.site] = {
      gecrawld: r.length,
      online: r.filter((x) => x.ok).length,
      fouten: r.filter((x) => !x.ok).map((x) => ({ domein: x.domein, fout: x.fout })),
    };
  }
  return { ok: true, ...uit };
}

export async function GET(request: Request) {
  return NextResponse.json(await draai(new URL(request.url)));
}

export async function POST(request: Request) {
  return NextResponse.json(await draai(new URL(request.url)));
}
