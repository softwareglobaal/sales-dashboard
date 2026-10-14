import { headers } from "next/headers";
import { magArchitecten, magBisson } from "@/lib/toegang";
import {
  architectenOverzicht,
  contactenVan,
  nietBinnengehaald,
  type Architect,
  type BissonProject,
  type Contact,
  type NietBinnen,
} from "@/lib/architecten";
import { euro, num } from "@/lib/format";
import { OpdrachtgeversLijst } from "./OpdrachtgeversLijst";

// Opdrachtgevers over alle firma's heen (spec §18): welke architecten, ingenieurs,
// studiebureaus, EPB-bureaus en aannemers werken met ons, bij welke firma, voor welke
// dienst, op welke werven en onder welk projectnummer -- en waarom elk project aan dat
// bureau hangt. Eén register uit het facturatieplatform (architecten.py): Pipedrive,
// Octopus, de TKN-mappen en het Monday-bord. Enkel wp-alles.

export const dynamic = "force-dynamic";

/**
 * Wie het Bisson-overzicht niet mag zien (magBisson), krijgt ook geen spoor ervan mee
 * naar de browser: geen Bisson-velden en geen factuuromschrijving die Bisson noemt.
 */
function zonderBisson(a: Architect): Architect {
  const { bisson, aantal_bisson, eerste_bisson, laatste_bisson, bij_ons_na_eerste_bisson, signaal, ...rest } = a;
  void [bisson, aantal_bisson, eerste_bisson, laatste_bisson, bij_ons_na_eerste_bisson, signaal];
  const schoon = (l: string[]) => l.filter((x) => !/bisson/i.test(x));
  return {
    ...rest,
    nakijken: schoon(a.nakijken || []),
    projecten: a.projecten.map(({ bisson: _b, ...p }) => ({
      ...p,
      nakijken: schoon(p.nakijken || []),
      partijen: p.partijen.map((x) => ({ ...x, waarom: schoon(x.waarom) })),
      bronnen: p.bronnen.map((b) => (/bisson/i.test(b.omschrijving || "") ? { ...b, omschrijving: undefined } : b)),
    })),
  } as unknown as Architect;
}

export default async function Page() {
  const h = await headers();
  if (!magArchitecten(h.get("x-authentik-groups"))) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="paneel">
          <h2>Geen toegang</h2>
          <p className="mt-2 text-[13px] text-zinc-500">Het opdrachtgeversbestand is enkel zichtbaar voor de directie en het salesteam.</p>
        </div>
      </main>
    );
  }
  const toonBisson = magBisson(h.get("x-authentik-groups"), h.get("x-authentik-username"));
  const stand = await architectenOverzicht();

  if (stand.status !== "ok") {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="h1-glas">Opdrachtgevers</h1>
        <div className="notitie let mt-4">
          {stand.status === "niet-ingesteld"
            ? "De koppeling met het facturatieplatform is niet ingesteld (FACTURATIE_URL en KOPPELING_TOKEN)."
            : `Het overzicht kon niet geladen worden: ${stand.melding}`}
        </div>
      </main>
    );
  }

  const klanten = stand.data.opdrachtgevers
    .filter((a) => a.klant && !a.eigen)
    .map((a) => (toonBisson ? a : zonderBisson(a)))
    .sort((x, y) => y.aantal_projecten - x.aantal_projecten || y.gefactureerd + y.verkocht - (x.gefactureerd + x.verkocht));
  const projecten = klanten.reduce((s, a) => s + a.aantal_projecten, 0);
  const gefactureerd = klanten.reduce((s, a) => s + a.gefactureerd, 0);
  const firmas = [...new Set(klanten.flatMap((a) => a.firmas))].sort();
  const perFirma = firmas.map((f) => ({
    firma: f,
    bureaus: klanten.filter((a) => a.firmas.includes(f)).length,
    projecten: klanten.reduce((s, a) => s + a.projecten.filter((p) => !p.zonder_verwijzing && p.firmas.includes(f)).length, 0),
  }));
  const viaBisson = klanten.filter((a) => (a.aantal_bisson ?? 0) > 0).length;
  // Enkel voor de directie: de Bisson-projecten per bureau, voor de uitklapweergave.
  const perBureau: Record<string, BissonProject[]> = {};
  if (toonBisson) for (const p of stand.data.bisson.projecten) for (const x of p.partijen) (perBureau[x.id] ||= []).push(p);
  // Per bureau uit Pipedrive: contactpersonen en de deals die niet binnengehaald werden.
  const extra: Record<string, { nietBinnen: NietBinnen[]; contacten: Contact[] }> = {};
  for (const a of klanten) extra[a.id] = { nietBinnen: nietBinnengehaald(a), contacten: contactenVan(a) };
  const soorten = [...new Set(klanten.map((a) => a.soort))].map((s) => ({
    soort: s,
    label: klanten.find((a) => a.soort === s)?.soort_label || s,
    n: klanten.filter((a) => a.soort === s).length,
  }));

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="kopbalk">
        <h1 className="h1-glas">Opdrachtgevers</h1>
        <p className="text-[12.5px] text-zinc-500">
          Architecten, ingenieurs, studiebureaus en andere bedrijven die klant zijn bij een van onze firma&apos;s · bronnen: Pipedrive
          (gewonnen deals), Octopus (facturen), de TKN-projectmappen en het Monday-bord · ververst {stand.data.ververst?.slice(0, 10).split("-").reverse().join("/") || "—"}
        </p>
      </div>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="paneel kpi">
          <span className="label">Opdrachtgevers</span>
          <div className="groot">{num(klanten.length)}</div>
          <div className="delta">{soorten.map((s) => `${s.n} ${s.label.toLowerCase()}`).join(" · ")}</div>
        </div>
        <div className="paneel kpi">
          <span className="label">Projecten</span>
          <div className="groot">{num(projecten)}</div>
          <div className="delta">één werf of projectnummer = één project, over de firma&apos;s heen</div>
        </div>
        <div className="paneel kpi">
          <span className="label">Gefactureerd</span>
          <div className="groot">{euro(gefactureerd)}</div>
          <div className="delta">excl. btw, aan het bureau zelf</div>
        </div>
        {toonBisson ? (
          <div className="paneel kpi">
            <span className="label">Werkt ook via Bisson</span>
            <div className="groot">{viaBisson}</div>
            <div className="delta">
              zie <a href="/engineering/bisson#overlap" className="underline">Engineering → Studiebureau Bisson</a>
            </div>
          </div>
        ) : (
          <div className="paneel kpi">
            <span className="label">Firma&apos;s</span>
            <div className="groot">{firmas.length}</div>
            <div className="delta">{firmas.join(", ")}</div>
          </div>
        )}
      </section>

      <section className="paneel mt-4">
        <div className="kop">
          <h2>Per firma</h2>
          <small>een bureau kan bij meer dan één firma klant zijn</small>
        </div>
        <div className="flex flex-wrap gap-2">
          {perFirma.map((f) => (
            <span key={f.firma} className="chip" style={{ padding: "6px 12px", fontSize: 12.5 }}>
              <b>{f.firma}</b> · {f.bureaus} bureaus · {f.projecten} projecten
            </span>
          ))}
        </div>
      </section>

      <section className="paneel mt-4">
        <OpdrachtgeversLijst
          architecten={klanten}
          directie={toonBisson}
          firmas={firmas}
          extra={extra}
          soorten={soorten}
          {...(toonBisson ? { bisson: perBureau } : {})}
        />
        <p className="mt-3 text-[12px] text-zinc-500">
          Een opdrachtgever wordt herkend aan het Pipedrive-contact (&ldquo;B2B ARC&rdquo;, &ldquo;B2B ING&rdquo;, &ldquo;B2B EPB&rdquo;, ...),
          aan een bedrijfsnaam met &ldquo;architect&rdquo;, &ldquo;ingenieur&rdquo;, &ldquo;studiebureau&rdquo; en dergelijke in
          Pipedrive of Octopus, aan de naam in een TKN-projectmap, of aan de kolommen architect en ingenieur op het Monday-bord. Een
          particulier die toevallig zo heet, telt niet mee. Klik een bureau open om per project de reden te zien. Facturen zonder
          projectnummer of adres staan per jaar samen als &ldquo;zonder projectverwijzing&rdquo; en tellen niet als project.
        </p>
      </section>
    </main>
  );
}
