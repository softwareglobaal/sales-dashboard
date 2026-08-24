// Gedeelde helpers voor de agent-API (/api/v1/*): parameters lezen, periodes
// valideren en de afdeling naar de juiste querymodule leiden.
//
// Het uitgangspunt van deze API: het dashboard bezit de definities (wat telt
// als aanvraag, op welke datum, welke pipelines in scope) en levert de
// uitkomst uit. De agents rekenen niets zelf opnieuw uit — zo kan er maar één
// waarheid zijn. Zie DASHBOARD-SPEC.md.

import { NextResponse } from "next/server";
import { isValidPeriod, periodRange, type Period } from "./queries";

export type Afdeling = "engineering" | "energy";

export type Params =
  | { ok: true; periode: Period; afdeling: Afdeling; bereik: { van: string | null; tot: string | null; label: string } }
  | { ok: false; antwoord: NextResponse };

// Leest ?periode= en ?afdeling= met dezelfde regels als de UI.
export function leesParams(req: Request, afdelingVerplicht = true): Params {
  const url = new URL(req.url);
  const periode = url.searchParams.get("periode") || "12m";
  if (!isValidPeriod(periode)) {
    return {
      ok: false,
      antwoord: NextResponse.json(
        {
          error: `Onbekende periode '${periode}'.`,
          toegestaan: ["12m", "ytd", "prev_year", "all", "2026-01 t/m 2026-12", "wk:JJJJ-MM-DD"],
        },
        { status: 400 },
      ),
    };
  }

  const ruw = (url.searchParams.get("afdeling") || "engineering").toLowerCase();
  if (afdelingVerplicht && ruw !== "engineering" && ruw !== "energy") {
    return {
      ok: false,
      antwoord: NextResponse.json(
        { error: `Onbekende afdeling '${ruw}'.`, toegestaan: ["engineering", "energy"] },
        { status: 400 },
      ),
    };
  }

  const r = periodRange(periode);
  return {
    ok: true,
    periode,
    afdeling: ruw as Afdeling,
    bereik: { van: r.from, tot: r.to, label: r.label },
  };
}
