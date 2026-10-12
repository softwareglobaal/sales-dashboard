import { headers } from "next/headers";
import { magArchitecten, magBisson } from "@/lib/toegang";
import { architectenOverzicht, type Architect, type BissonProject } from "@/lib/architecten";
import { euro, num } from "@/lib/format";
import { ArchitectenLijst } from "./ArchitectenLijst";

// Architecten-klanten over alle firma's heen (spec §18): welke architectenbureaus
// werken met ons, bij welke firma, voor welke dienst, op welke werven en onder welk
// projectnummer. Bronnen: gewonnen deals in Pipedrive (contact "B2B ARC" of een
// architectenbureau), verkoopfacturen in Octopus en de eigen TKN-projectmappen.
// Opgebouwd in het facturatieplatform (architecten.py); enkel wp-alles.

export const dynamic = "force-dynamic";

/**
 * Wie het Bisson-overzicht niet mag zien (magBisson), krijgt ook geen spoor ervan mee
 * naar de browser: geen Bisson-velden en geen factuuromschrijving die Bisson noemt.
 */
function zonderBisson(a: Architect): Architect {
  const { bisson, aantal_bisson, eerste_bisson, laatste_bisson, bij_ons_na_eerste_bisson, signaal, ...rest } = a;
  void [bisson, aantal_bisson, eerste_bisson, laatste_bisson, bij_ons_na_eerste_bisson, signaal];
  return {
    ...rest,
    projecten: a.projecten.map(({ bisson_nummer, ...p }) => {
      void bisson_nummer;
      return { ...p, bronnen: p.bronnen.map((b) => (/bisson/i.test(b.omschrijving || "") ? { ...b, omschrijving: undefined } : b)) };
    }),
  } as unknown as Architect;
}

export default async function Page() {
  const h = await headers();
  if (!magArchitecten(h.get("x-authentik-groups"))) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="paneel">
          <h2>Geen toegang</h2>
          <p className="mt-2 text-[13px] text-zinc-500">Het architecten-klantenbestand is enkel zichtbaar voor de directie en het salesteam.</p>
        </div>
      </main>
    );
  }
  const toonBisson = magBisson(h.get("x-authentik-groups"), h.get("x-authentik-username"));
  const stand = await architectenOverzicht();

  if (stand.status !== "ok") {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="h1-glas">Architecten</h1>
        <div className="notitie let mt-4">
          {stand.status === "niet-ingesteld"
            ? "De koppeling met het facturatieplatform is niet ingesteld (FACTURATIE_URL en KOPPELING_TOKEN)."
            : `Het overzicht kon niet geladen worden: ${stand.melding}`}
        </div>
      </main>
    );
  }

  const klanten = stand.data.architecten
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
  if (toonBisson) for (const p of stand.data.bisson.projecten) if (p.bureau) (perBureau[p.bureau] ||= []).push(p);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="kopbalk">
        <h1 className="h1-glas">Architecten</h1>
        <p className="text-[12.5px] text-zinc-500">
          Architectenbureaus die klant zijn bij een van onze firma&apos;s · bronnen: Pipedrive (gewonnen deals), Octopus (facturen) en
          de TKN-projectmappen · ververst {stand.data.ververst?.slice(0, 10).split("-").reverse().join("/") || "—"}
        </p>
      </div>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="paneel kpi">
          <span className="label">Architect-klanten</span>
          <div className="groot">{num(klanten.length)}</div>
          <div className="delta">eigen firma&apos;s en leadplatformen niet meegeteld</div>
        </div>
        <div className="paneel kpi">
          <span className="label">Projecten</span>
          <div className="groot">{num(projecten)}</div>
          <div className="delta">één werf of projectnummer = één project, over de firma&apos;s heen</div>
        </div>
        <div className="paneel kpi">
          <span className="label">Gefactureerd</span>
          <div className="groot">{euro(gefactureerd)}</div>
          <div className="delta">excl. btw, aan de architect zelf</div>
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
        <ArchitectenLijst architecten={klanten} directie={toonBisson} firmas={firmas} {...(toonBisson ? { bisson: perBureau } : {})} />
        <p className="mt-3 text-[12px] text-zinc-500">
          Een architect wordt herkend aan het contact &ldquo;B2B ARC&rdquo; in Pipedrive, aan een bureaunaam met &ldquo;architect&rdquo;,
          &ldquo;architectuur&rdquo; of &ldquo;studio&rdquo; in Pipedrive of Octopus, of aan de architect in de naam van een
          TKN-projectmap. Een particulier die toevallig zo heet, telt niet mee. Facturen zonder projectnummer of adres staan per jaar
          samen als &ldquo;zonder projectverwijzing&rdquo; en tellen niet als project.
        </p>
      </section>
    </main>
  );
}
