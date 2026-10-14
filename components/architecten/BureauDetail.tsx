"use client";

// Detail van één opdrachtgever (architect, ingenieur, studiebureau, ...): elk project bij
// onze firma's met de reden waarom het aan dit bureau hangt, en -- voor wie het Bisson-
// overzicht mag zien -- elk project via Bisson, de deals die we niet binnenhaalden, de
// contactpersonen en de vaststelling van wie naleest. Filterbaar per jaar.
// Gedeeld door /opdrachtgevers en /engineering/bisson.

import { useState } from "react";
import type { Architect, BissonProject, Contact, NietBinnen, ProjectBron } from "@/lib/architecten";
import { Vaststelling, type VaststellingWaarde } from "./Vaststelling";

function euro(n: number) {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}
function datum(d: string | null | undefined) {
  if (!d) return "—";
  if (d.endsWith("-01-01")) return d.slice(0, 4);
  return d.slice(0, 10).split("-").reverse().join("/");
}
export function jaarVan(d: string | null | undefined): string {
  return (d || "").slice(0, 4);
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

const OMVANG: Record<string, [string, string]> = {
  groot: ["groot", "kritiek"],
  middel: ["middel", "let"],
  klein: ["klein", ""],
  onbekend: ["?", ""],
};

export function OmvangChip({ o }: { o: BissonProject["omvang"] | Record<string, never> | undefined }) {
  if (!o || !("klasse" in o)) return <span className="text-zinc-400">—</span>;
  const [label, klasse] = OMVANG[o.klasse] || [o.klasse, ""];
  const tip = [
    o.bestanden != null ? `${o.bestanden} bestanden in de map` : "geen map",
    o.meerdere_eenheden ? "mapnaam noemt meerdere woningen of appartementen" : null,
    o.monday_bedrag ? `bedrag op Monday ${euro(o.monday_bedrag)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <span className={"chip " + klasse} title={tip}>
      {label}
      {o.bestanden != null ? ` · ${o.bestanden}` : ""}
    </span>
  );
}

export function OnzeProjecten({ a, projecten }: { a: Architect; projecten: Architect["projecten"] }) {
  if (!projecten.length) return <p className="text-[12.5px] text-zinc-500">Geen project bij onze firma&apos;s in deze periode.</p>;
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
            <th>Waarom dit bureau</th>
            <th>Openen</th>
          </tr>
        </thead>
        <tbody>
          {projecten.map((p) => {
            const waarom = p.partijen.find((x) => x.id === a.id)?.waarom || [];
            return (
              <tr key={p.id}>
                <td className="whitespace-nowrap">{datum(p.datum)}</td>
                <td className="whitespace-nowrap">{p.projectnrs.join(", ") || "—"}</td>
                <td className="text-[12.5px]">
                  {p.zonder_verwijzing ? (
                    <span className="text-zinc-500">facturen zonder projectverwijzing ({p.datum?.slice(0, 4)})</span>
                  ) : (
                    p.adres || "—"
                  )}
                  {p.nakijken.length > 0 && (
                    <div className="mt-0.5 text-[11px] text-amber-700" title={p.nakijken.join("\n")}>
                      ⚠ {p.nakijken[0]}
                    </div>
                  )}
                </td>
                <td className="text-[12.5px]">{p.firmas.join(", ")}</td>
                <td className="text-[12.5px]">{p.diensten.join(", ") || "—"}</td>
                <td className="num">{p.verkocht ? euro(p.verkocht) : "—"}</td>
                <td className="num">{p.gefactureerd ? euro(p.gefactureerd) : "—"}</td>
                <td className="text-[11.5px] text-zinc-500" style={{ maxWidth: 260 }}>
                  {waarom[0] || "—"}
                  {waarom.length > 1 && <span title={waarom.slice(1).join("\n")}> (+{waarom.length - 1})</span>}
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {p.bronnen.map((b, j) => (
                      <Bron key={j} b={b} />
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function BissonProjecten({
  a,
  projecten,
  vast,
}: {
  a?: Architect;
  projecten: BissonProject[];
  vast?: Record<string, VaststellingWaarde>;
}) {
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
            <th>Omvang</th>
            <th>Werfadres</th>
            <th>Rol · waarom</th>
            <th>Monday</th>
            <th>Openen</th>
            {vast && <th>Vaststelling</th>}
          </tr>
        </thead>
        <tbody>
          {projecten.map((p) => {
            const mij = a ? p.partijen.find((x) => x.id === a.id) : undefined;
            const anderen = p.partijen.filter((x) => x.id !== a?.id);
            return (
              <tr key={p.nr}>
                <td className="font-medium">{p.nr}</td>
                <td className="whitespace-nowrap">{datum(p.datum)}</td>
                <td>{p.dienst_naam || "—"}</td>
                <td className="text-[12.5px]">{p.soort_naam || "—"}</td>
                <td>
                  <OmvangChip o={p.omvang} />
                </td>
                <td className="text-[12.5px]">
                  {p.adres || "—"}
                  {p.nakijken.length > 0 && (
                    <div className="mt-0.5 text-[11px] text-amber-700" title={p.nakijken.join("\n")}>
                      ⚠ {p.nakijken[0]}
                    </div>
                  )}
                </td>
                <td className="text-[11.5px] text-zinc-500" style={{ maxWidth: 260 }}>
                  {mij ? `${mij.rollen.join(", ")} · ${mij.waarom[0] || ""}` : "—"}
                  {anderen.length > 0 && (
                    <div className="text-zinc-600">ook: {anderen.map((x) => `${x.naam} (${x.rollen.join(", ")})`).join(", ")}</div>
                  )}
                </td>
                <td className="text-[12px]">{p.monday?.stand || "—"}</td>
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
                {vast && (
                  <td>
                    <Vaststelling sleutel={`project|${p.nr}`} begin={vast[`project|${p.nr}`]} klein />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NietBinnenLijst({ lijst }: { lijst: NietBinnen[] }) {
  if (!lijst.length) return <p className="text-[12.5px] text-zinc-500">Geen open of verloren deals in Pipedrive.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="tabel">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Firma</th>
            <th>Soort</th>
            <th>Status</th>
            <th>Deal</th>
            <th>Pipeline · fase</th>
            <th>Reden verlies</th>
          </tr>
        </thead>
        <tbody>
          {lijst.map((d, i) => (
            <tr key={i}>
              <td className="whitespace-nowrap">{datum(d.datum)}</td>
              <td className="text-[12.5px]">{d.firma}</td>
              <td>
                <span className={"chip " + (d.soort === "aanvraag" ? "accent" : "")}>{d.soort}</span>
              </td>
              <td>
                <span className={"chip " + (d.status === "verloren" ? "kritiek" : "let")}>{d.status}</span>
              </td>
              <td className="text-[12.5px]">
                {d.link ? (
                  <a href={d.link} target="_blank" rel="noopener" className="underline">
                    {d.titel || "deal"}
                  </a>
                ) : (
                  d.titel
                )}
              </td>
              <td className="text-[12px] text-zinc-500">
                {d.pipeline}
                {d.fase ? ` · ${d.fase}` : ""}
              </td>
              <td className="text-[12px] text-zinc-500">{d.reden || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Contacten({ lijst }: { lijst: Contact[] }) {
  if (!lijst.length) return <p className="text-[12.5px] text-zinc-500">Geen contactgegevens in Pipedrive.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {lijst.map((c, i) => (
        <div key={i} className="rounded-xl border border-black/10 px-3 py-2 text-[12.5px]" style={{ background: "var(--glas)" }}>
          <div className="font-medium">{c.naam}</div>
          {c.telefoon && (
            <div>
              <a href={`tel:${c.telefoon.replace(/\s/g, "")}`} className="underline">
                {c.telefoon}
              </a>
            </div>
          )}
          {c.email && (
            <div>
              <a href={`mailto:${c.email}`} className="underline">
                {c.email}
              </a>
            </div>
          )}
          <div className="text-[11px] text-zinc-500">{c.bron}</div>
        </div>
      ))}
    </div>
  );
}

/** Alles onder elkaar, met jaarknoppen bovenaan. Extra's (Bisson, deals, contact) enkel als ze meegegeven zijn. */
export function BureauDetail({
  a,
  bisson,
  jaar: beginJaar = "",
  nietBinnen,
  contacten,
  vast,
}: {
  a: Architect;
  bisson?: BissonProject[];
  jaar?: string;
  nietBinnen?: NietBinnen[];
  contacten?: Contact[];
  vast?: Record<string, VaststellingWaarde>;
}) {
  const [jaar, setJaar] = useState(beginJaar);
  const jaren = [
    ...new Set(
      [
        ...a.projecten.map((p) => jaarVan(p.datum)),
        ...(bisson || []).map((p) => String(p.jaar)),
        ...(nietBinnen || []).map((d) => jaarVan(d.datum)),
      ].filter(Boolean),
    ),
  ].sort((x, y) => y.localeCompare(x));
  const ons = a.projecten.filter((p) => !jaar || jaarVan(p.datum) === jaar);
  const bis = (bisson || []).filter((p) => !jaar || String(p.jaar) === jaar);
  const niet = (nietBinnen || []).filter((d) => !jaar || jaarVan(d.datum) === jaar);
  const telOns = ons.filter((p) => !p.zonder_verwijzing).length;
  const knop = (waarde: string, label: string) => (
    <button
      key={label}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setJaar(waarde);
      }}
      className={jaar === waarde ? "chip donker" : "chip"}
      style={{ padding: "4px 11px", fontSize: 12, cursor: "pointer" }}
    >
      {label}
    </button>
  );
  return (
    <div className="space-y-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[12px] text-zinc-500">Jaar:</span>
          {knop("", "Alle")}
          {jaren.map((j) => knop(j, j))}
        </div>
        {vast && <Vaststelling sleutel={`bureau|${a.id}`} begin={vast[`bureau|${a.id}`]} />}
      </div>
      <div className="text-[12px] text-zinc-500">
        {a.soort_label}
        {a.namen.length > 0 && <> · staat in onze systemen als: {a.namen.join(" · ")}</>}
        {a.codes.length > 0 && <> · code in de mappen: {a.codes.join(", ")}</>}
      </div>
      {a.nakijken.length > 0 && (
        <div className="notitie let text-[12px]">
          <b>Na te kijken:</b> {a.nakijken.slice(0, 4).join(" · ")}
          {a.nakijken.length > 4 ? ` (+${a.nakijken.length - 4})` : ""}
        </div>
      )}
      {contacten && (
        <div>
          <div className="label mb-1">Contact</div>
          <Contacten lijst={contacten} />
        </div>
      )}
      <div>
        <div className="label mb-1">
          Bij onze firma&apos;s{jaar ? ` in ${jaar}` : ""} · {telOns} project{telOns === 1 ? "" : "en"}
        </div>
        <OnzeProjecten a={a} projecten={ons} />
      </div>
      {bisson && bisson.length > 0 && (
        <div>
          <div className="label mb-1">
            Via Studiebureau Bisson{jaar ? ` in ${jaar}` : ""} · {bis.length} projecten
          </div>
          {bis.length ? (
            <BissonProjecten a={a} projecten={bis} vast={vast} />
          ) : (
            <p className="text-[12.5px] text-zinc-500">Geen Bisson-project in deze periode.</p>
          )}
        </div>
      )}
      {nietBinnen && (
        <div>
          <div className="label mb-1">
            Niet binnengehaald in Pipedrive{jaar ? ` in ${jaar}` : ""} · {niet.length}
          </div>
          <NietBinnenLijst lijst={niet} />
        </div>
      )}
    </div>
  );
}
