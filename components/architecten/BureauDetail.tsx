// Detail van één architectenbureau: elk project bij onze firma's (met dienst, firma en
// een link naar de deal, de factuur, de map of Monday) en, voor de directie, elk project
// dat via Bisson liep. Gedeeld door /architecten en /engineering/bisson.

import type { Architect, BissonProject, ProjectBron } from "@/lib/architecten";

function euro(n: number) {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}
function datum(d: string | null | undefined) {
  if (!d) return "—";
  if (d.endsWith("-01-01")) return d.slice(0, 4);
  return d.slice(0, 10).split("-").reverse().join("/");
}

const LABEL: Record<string, string> = { Pipedrive: "deal", Octopus: "factuur", Dropbox: "map", Monday: "Monday" };

function Bron({ b }: { b: ProjectBron }) {
  const nr = b.bron === "Octopus" ? (b.ref || "").split(" ").pop() : "";
  const tekst = `${LABEL[b.bron] || b.bron}${nr ? " " + nr : ""}`;
  const tip = [b.ref, b.omschrijving, b.gefactureerd != null ? euro(b.gefactureerd) : null].filter(Boolean).join(" · ");
  return b.link ? (
    <a href={b.link} target="_blank" rel="noopener" className="chip accent" title={tip} style={{ textDecoration: "none" }}>
      {tekst} ↗
    </a>
  ) : (
    <span className="chip" title={tip}>
      {tekst}
    </span>
  );
}

export function OnzeProjecten({ a, toonBissonNr = false }: { a: Architect; toonBissonNr?: boolean }) {
  if (!a.projecten.length) return <p className="text-[12.5px] text-zinc-500">Geen project bij onze firma&apos;s gevonden.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="tabel">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Projectnr</th>
            <th>Werfadres</th>
            <th>Firma</th>
            <th>Dienst</th>
            <th className="num">Verkocht</th>
            <th className="num">Gefactureerd</th>
            <th>Openen</th>
          </tr>
        </thead>
        <tbody>
          {a.projecten.map((p, i) => (
            <tr key={i}>
              <td className="whitespace-nowrap">{datum(p.datum)}</td>
              <td className="whitespace-nowrap">
                {p.projectnrs.join(", ") || "—"}
                {toonBissonNr && p.bisson_nummer && <span className="chip let ml-1">Bisson-nr</span>}
              </td>
              <td className="text-[12.5px]">
                {p.zonder_verwijzing ? (
                  <span className="text-zinc-500">facturen zonder projectverwijzing ({p.datum?.slice(0, 4)})</span>
                ) : (
                  p.adres || "—"
                )}
              </td>
              <td className="text-[12.5px]">{p.firmas.join(", ")}</td>
              <td className="text-[12.5px]">{p.diensten.join(", ") || "—"}</td>
              <td className="num">{p.verkocht ? euro(p.verkocht) : "—"}</td>
              <td className="num">{p.gefactureerd ? euro(p.gefactureerd) : "—"}</td>
              <td>
                <div className="flex flex-wrap gap-1">
                  {p.bronnen.map((b, j) => (
                    <Bron key={j} b={b} />
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BissonProjecten({ projecten }: { projecten: BissonProject[] }) {
  if (!projecten.length) return null;
  return (
    <div className="overflow-x-auto">
      <table className="tabel">
        <thead>
          <tr>
            <th>Nr</th>
            <th>Start</th>
            <th>Dienst</th>
            <th>Soort</th>
            <th>Werfadres</th>
            <th>Ingenieur (OA)</th>
            <th>Stand op Monday</th>
            <th>Openen</th>
          </tr>
        </thead>
        <tbody>
          {projecten.map((p) => (
            <tr key={p.nr}>
              <td className="font-medium">{p.nr}</td>
              <td className="whitespace-nowrap">{datum(p.datum)}</td>
              <td>{p.dienst_naam || "—"}</td>
              <td className="text-[12.5px]">{p.soort_naam || "—"}</td>
              <td className="text-[12.5px]">{p.adres || "—"}</td>
              <td className="text-[12.5px]">{p.ingenieur || "—"}</td>
              <td className="text-[12.5px]">{p.monday?.stand || "—"}</td>
              <td>
                <div className="flex flex-wrap gap-1">
                  {p.link && (
                    <a href={p.link} target="_blank" rel="noopener" className="chip accent" style={{ textDecoration: "none" }}>
                      map ↗
                    </a>
                  )}
                  {p.monday?.link && (
                    <a href={p.monday.link} target="_blank" rel="noopener" className="chip accent" style={{ textDecoration: "none" }}>
                      Monday ↗
                    </a>
                  )}
                  {p.facturen.map((f) =>
                    f.pdf ? (
                      <a key={f.nr} href={f.pdf} target="_blank" rel="noopener" className="chip let" style={{ textDecoration: "none" }} title={`${f.klant} ${euro(f.bedrag || 0)}`}>
                        factuur {f.nr.split("/").pop()} ↗
                      </a>
                    ) : (
                      <span key={f.nr} className="chip let" title={`${f.klant} ${euro(f.bedrag || 0)}`}>
                        factuur {f.nr.split("/").pop()}
                      </span>
                    ),
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Beide lijsten onder elkaar, met een korte kop. */
export function BureauDetail({ a, bisson }: { a: Architect; bisson?: BissonProject[] }) {
  return (
    <div className="space-y-4 py-2">
      {a.namen.length > 0 && <div className="text-[12px] text-zinc-500">Staat in onze systemen als: {a.namen.join(" · ")}</div>}
      <div>
        <div className="label mb-1">
          Bij onze firma&apos;s · {a.aantal_projecten} project{a.aantal_projecten === 1 ? "" : "en"}
        </div>
        <OnzeProjecten a={a} toonBissonNr={!!bisson} />
      </div>
      {bisson && bisson.length > 0 && (
        <div>
          <div className="label mb-1">Via Studiebureau Bisson · {bisson.length} projecten</div>
          <BissonProjecten projecten={bisson} />
        </div>
      )}
    </div>
  );
}
