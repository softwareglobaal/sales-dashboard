import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  isValidPeriod,
  periodRange,
  getEngineeringKpisWithDelta,
  getEngineeringChannels,
  getEngineeringLostReasons,
  getEngineeringServices,
  getEngineeringBundleSplit,
  getEngineeringOfferteStats,
  getEngineeringMotivation,
  getEngineeringProjectType,
  getEngineeringActivity,
  type Period,
  type EngScope,
} from "@/lib/queries";
import { getTheme } from "@/lib/themes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Belangrijk: we sturen ALLEEN geaggregeerde cijfers naar Claude — geen deal-titels,
// klantnamen of URL's. Pipedrive blijft read-only; dit is puur lezen + analyseren.

const eur = (n: number) => "€" + Math.round(n).toLocaleString("nl-BE");
const pct = (v: number | null) => (v == null ? "n.v.t." : (v > 0 ? "+" : "") + v + "%");

function buildAggregates(period: Period, themeKey: string | undefined, scope: EngScope) {
  const label = periodRange(period).label;
  const themeLabel = themeKey ? getTheme(themeKey)?.label || themeKey : "Alle thema's";
  const scopeLabel =
    scope === "unabo" ? "Enkel UNABO Engineering" : scope === "tkn" ? "Enkel TKN-Buro" : "Alles (UNABO Engineering + TKN-Buro)";

  const k = getEngineeringKpisWithDelta(period, themeKey, scope);
  const offerte = getEngineeringOfferteStats(period, themeKey, scope);
  const channels = getEngineeringChannels(period, themeKey, scope);
  const lost = getEngineeringLostReasons(period, themeKey, scope);
  const services = getEngineeringServices(period, themeKey, scope);
  const bundle = getEngineeringBundleSplit(period, themeKey, scope);
  const motivation = getEngineeringMotivation(period, scope);
  const projectType = getEngineeringProjectType(period, themeKey, scope);
  const activity = getEngineeringActivity(period, "month", themeKey, scope);

  const lines: string[] = [];
  lines.push(`FIRMA-SCOPE: ${scopeLabel}`);
  lines.push(`PERIODE: ${label}`);
  lines.push(`THEMA-FILTER: ${themeLabel}`);
  lines.push("");
  lines.push("KERNCIJFERS (t.o.v. vorige even lange periode):");
  lines.push(`- Aanvragen (leads): ${k.requests} (${pct(k.dRequests)})`);
  lines.push(`- Verkocht (gewonnen deals): ${k.wonCount} (${pct(k.dWonCount)})`);
  lines.push(`- Omzet gewonnen (op product-prijs): ${eur(k.wonValue)} (${pct(k.dWonValue)})`);
  lines.push(`- Gem. tijd aanvraag → gewonnen: ${k.avgDays != null ? k.avgDays + " dagen" : "onbekend"}`);
  lines.push("");
  lines.push("OFFERTES:");
  lines.push(`- Verstuurd: ${offerte.offerteCount}${offerte.leadCount > 0 ? ` (= ${Math.round((offerte.offerteCount / offerte.leadCount) * 100)}% van de aanvragen)` : ""}`);
  lines.push(
    `- Gem. tijd aanvraag → offerte: ${offerte.avgDaysToOfferte != null ? offerte.avgDaysToOfferte + " dagen" : "onbekend"} (INDICATIEF, kleine steekproef n=${offerte.timingSample})`
  );
  lines.push("");

  if (activity.length) {
    lines.push("VERLOOP PER MAAND (aanvragen / gewonnen aantal / omzet / verloren):");
    for (const a of activity) {
      lines.push(`- ${a.label}: ${a.requests} aanvr. · ${a.wonCount} gewonnen · ${eur(a.wonValue)} · ${a.lostCount} verloren`);
    }
    lines.push("");
  }

  if (channels.length) {
    lines.push("KANALEN (herkomst van aanvragen — leads / gewonnen / open / verloren):");
    for (const c of channels) {
      lines.push(`- ${c.channel}: ${c.leads} leads · ${c.won} gewonnen · ${c.open} open · ${c.lost} verloren`);
    }
    lines.push("");
  }

  if (lost.outside2026) {
    lines.push("VERLIESREDENEN: niet beschikbaar (periode valt buiten 2026).");
  } else if (lost.reasons.length) {
    lines.push(`VERLIESREDENEN (totaal ${lost.total} verloren deals, gecombineerd UNABO + TKN):`);
    for (const r of lost.reasons) lines.push(`- ${r.reason}: ${r.count} (UNABO ${r.unabo}, TKN ${r.tkn})`);
    lines.push("");
  }

  if (!motivation.outside2026 && motivation.total > 0) {
    lines.push(`MOTIVATIE BIJ VERLIES (UNABO "Invloedbaar door UNABO?", ${motivation.filledInfluenceable}/${motivation.total} ingevuld):`);
    for (const m of motivation.influenceable) lines.push(`- ${m.label}: ${m.count}`);
    lines.push("");
  }

  if (services.length) {
    const top = [...services].sort((a, b) => b.requests - a.requests).slice(0, 12);
    lines.push("DIENSTEN (top op aanvragen — aanvragen / verkocht / omzet / gem. dagen):");
    for (const s of top) {
      lines.push(`- ${s.service} [${s.source}]: ${s.requests} aanvr. · ${s.soldCount} verkocht · ${eur(s.revenue)} · ${s.avgDays != null ? s.avgDays + "d" : "—"}`);
    }
    lines.push("");
  }

  lines.push("BUNDEL vs. LOS (gewonnen deals):");
  lines.push(`- Los verkocht: ${bundle.losCount} deals, ${eur(bundle.losValue)} engineering-omzet`);
  lines.push(
    `- In bundel: ${bundle.bundelCount} deals, ${eur(bundle.bundelDealValue)} totale deal-waarde waarvan ${eur(bundle.bundelEngValue)} engineering`
  );
  lines.push("");

  const ptReliable = projectType.total > 0 && projectType.gebouwtypeFilled / projectType.total >= 0.4;
  lines.push(
    `PROJECTTYPE (LET OP: slechts ${projectType.gebouwtypeFilled}/${projectType.total} deals hebben 'gebouwtype' ingevuld — ${ptReliable ? "bruikbaar" : "ONBETROUWBAAR / indicatief, niet hard concluderen"}):`
  );
  for (const g of projectType.gebouwtype.slice(0, 6)) lines.push(`- ${g.label}: ${g.count}`);

  return lines.join("\n");
}

const SYSTEM_PROMPT = `Je bent een ervaren sales-analist voor H-Architects Group (België), gespecialiseerd in de Engineering-afdeling (UNABO Engineering + TKN-Buro). Je schrijft in helder, professioneel Nederlands voor een niet-technische zaakvoerder.

Je krijgt uitsluitend GEAGGREGEERDE cijfers voor een gekozen periode. Regels:
- Gebruik ALLEEN de cijfers die je krijgt. Verzin niets, geen klantnamen, geen bedragen die er niet staan.
- Als een dataset als "indicatief", "onbetrouwbaar" of "kleine steekproef" is gemarkeerd: benoem die onzekerheid en trek er GEEN harde conclusie uit.
- Wees concreet en zakelijk. Vermijd holle marketingtaal en overdreven enthousiasme.

Geef je antwoord in Markdown, in exact deze structuur:

## Korte analyse
2 tot 4 korte alinea's: wat valt op in de cijfers (groei/daling, sterkste kanaal, belangrijkste verliesreden, offerte-conversie, opvallende diensten). Benoem de belangrijkste 1–2 aandachtspunten.

## Concrete acties
Een lijst van 3 tot 5 concrete, uitvoerbare acties die direct op deze cijfers gebaseerd zijn. Elke actie begint met een werkwoord en is specifiek (welk kanaal, welke dienst, welke verliesreden). Geen algemeenheden.

Houd het totaal bondig (max ~400 woorden).`;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Geen ANTHROPIC_API_KEY ingesteld in .env.local — de AI-analyse kan niet draaien." },
      { status: 500 }
    );
  }

  let body: { period?: string; t?: string; sc?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const period: Period = isValidPeriod(body.period) ? (body.period as Period) : "ytd";
  const themeKey = body.t && body.t.length ? body.t : undefined;
  const scope: EngScope = body.sc === "unabo" ? "unabo" : body.sc === "tkn" ? "tkn" : "all";

  let aggregates: string;
  try {
    aggregates = buildAggregates(period, themeKey, scope);
  } catch (e: any) {
    return NextResponse.json({ error: "Kon de cijfers niet ophalen: " + (e?.message || String(e)) }, { status: 500 });
  }

  const client = new Anthropic();
  try {
    const msg = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Analyseer de Engineering-cijfers hieronder en geef analyse + acties.\n\n${aggregates}`,
        },
      ],
    });

    if (msg.stop_reason === "refusal") {
      return NextResponse.json({ error: "De AI weigerde deze aanvraag. Probeer een andere periode." }, { status: 502 });
    }

    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return NextResponse.json({ text, period, themeKey: themeKey || null, scope });
  } catch (e: any) {
    const status = e?.status || 500;
    let error = "Er ging iets mis bij het genereren van de analyse.";
    if (status === 401) error = "De Anthropic API-sleutel is ongeldig of verlopen.";
    else if (status === 429) error = "Te veel aanvragen op de API — wacht even en probeer opnieuw.";
    else if (e?.message) error += " (" + e.message + ")";
    return NextResponse.json({ error }, { status: status >= 400 && status < 600 ? status : 500 });
  }
}
