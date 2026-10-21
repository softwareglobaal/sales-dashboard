import { headers } from "next/headers";
import { aanbestedingFirmas } from "@/lib/toegang";
import { dagenTot, laatste, type Firma, type OordeelStatus, type SamenOpdracht, type Treffer, type Vereiste } from "@/lib/aanbestedingen";

// Openbare aanbestedingen (spec §19): per firma de opdrachten die De Tenderwachter vond, met het
// oordeel "kunnen we meedoen" en de reden, plus de zoekcriteria, waarom die gekozen zijn en welke
// andere mogelijkheden er zijn. België via BOSA (en TED), Suriname via IDB, gov.sr en PURP.
// Enkel wp-alles: de pagina toont de financiële toestand van de firma's.

export const dynamic = "force-dynamic";

type Zoek = { firma?: string; toon?: string };

const STATUS: Record<OordeelStatus, { label: string; chip: string; rot: string }> = {
  ja: { label: "Kan meedoen", chip: "chip goed", rot: "rot g" },
  als: { label: "Kan meedoen als …", chip: "chip let", rot: "rot l" },
  nee: { label: "Kan niet meedoen", chip: "chip kritiek", rot: "rot k" },
};

function datum(iso: string | null | undefined) {
  if (!iso) return "onbekend";
  const d = new Date(iso.length <= 10 ? iso + "T12:00:00" : iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" });
}

function wanneer(deadline: string | null) {
  const d = dagenTot(deadline);
  if (d === null) return "deadline onbekend";
  if (d < 0) return "verlopen";
  if (d === 0) return "sluit vandaag";
  if (d === 1) return "sluit morgen";
  return `nog ${d} dagen`;
}

function bedrag(t: Treffer) {
  if (!t.waarde) return null;
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: t.valuta || "EUR", maximumFractionDigits: 0 }).format(t.waarde);
}

function tel(f: Firma) {
  const n = { ja: 0, als: 0, nee: 0 };
  for (const t of f.treffers) n[t.oordeel.status]++;
  return n;
}

function eerstvolgende(f: Firma) {
  const kans = f.treffers
    .filter((t) => t.oordeel.status !== "nee" && (dagenTot(t.deadline) ?? -1) >= 0)
    .sort((a, b) => (a.deadline || "").localeCompare(b.deadline || ""))[0];
  return kans ? `${datum(kans.deadline)} · ${kans.titel}` : "geen";
}

function link(firma: string | null, toon?: string) {
  const p = new URLSearchParams();
  if (firma) p.set("firma", firma);
  if (toon) p.set("toon", toon);
  const q = p.toString();
  return "/aanbestedingen" + (q ? "?" + q : "");
}

function Tabs({ firmas, actief, samen }: { firmas: Firma[]; actief: string | null; samen: number }) {
  const knop = (href: string, label: string, aan: boolean, n?: number) => (
    <a
      key={href}
      href={href}
      className={
        "whitespace-nowrap rounded-full px-4 py-[7px] text-[13px] font-medium transition " +
        (aan ? "actief bg-[var(--donker)] text-white" : "text-[var(--inkt-zacht)] hover:text-[var(--inkt)]")
      }
    >
      {label}
      {n !== undefined && (
        <b className={"ml-1.5 rounded-full px-1.5 py-px text-[11px] font-medium " + (aan ? "bg-white/25" : "bg-[var(--vlak)]")}>{n}</b>
      )}
    </a>
  );
  return (
    <nav className="subtabs mt-4 !flex flex-wrap" aria-label="Firma's">
      {knop(link(null), "Alle firma's", actief === null)}
      {knop(link("samen"), "Samen inschrijven", actief === "samen", samen)}
      {firmas.map((f) => knop(link(f.code), f.naam.replace(/ (BV|N\.V\.|VOF)$/, ""), actief === f.code, tel(f).ja + tel(f).als))}
    </nav>
  );
}

function Overzicht({ firmas, toonKnelpunt = true }: { firmas: Firma[]; toonKnelpunt?: boolean }) {
  return (
    <section className="paneel mt-4">
      <div className="kop">
        <h2>Per firma</h2>
      </div>
      <div className="tabelwrap mt-2 overflow-x-auto">
        <table className="tabel">
          <thead>
            <tr>
              <th>Firma</th>
              <th>Bron</th>
              <th className="num">Kan meedoen</th>
              <th className="num">Als …</th>
              <th className="num">Kan niet</th>
              <th>Eerstvolgende kans</th>
              {toonKnelpunt && <th>Grootste knelpunt</th>}
            </tr>
          </thead>
          <tbody>
            {firmas.map((f) => {
              const n = tel(f);
              const knelpunt = f.punten.find((p) => p.kleur === "rood");
              return (
                <tr key={f.code}>
                  <td>
                    <a href={link(f.code)} className="font-medium text-[var(--inkt)] underline-offset-2 hover:underline">
                      {f.naam}
                    </a>
                    <div className="text-[11.5px] text-[var(--inkt-vaag)]">{f.plaats}</div>
                  </td>
                  <td className="text-[12.5px]">{f.land === "BE" ? "BOSA + TED" : "IDB, gov.sr, PURP"}</td>
                  <td className="num">
                    <a href={link(f.code, "ja")} className="chip goed">{n.ja}</a>
                  </td>
                  <td className="num">
                    <a href={link(f.code, "als")} className="chip let">{n.als}</a>
                  </td>
                  <td className="num">
                    <a href={link(f.code, "nee")} className="chip kritiek">{n.nee}</a>
                  </td>
                  <td className="max-w-[280px] text-[12.5px]">{eerstvolgende(f)}</td>
                  {toonKnelpunt && (
                    <td className="max-w-[280px] text-[12.5px]">
                      {knelpunt ? `${knelpunt.onderwerp}: ${knelpunt.stand}` : "geen rood punt"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Vereisten({ lijst, gelezen }: { lijst: Vereiste[]; gelezen: string[] }) {
  if (!lijst?.length) {
    return (
      <p className="m-0 text-[12px] text-[var(--inkt-vaag)]">
        Vereisten nog niet nagekeken in de opdrachtdocumenten. Pas daarna kan het oordeel "kan meedoen" worden.
      </p>
    );
  }
  const kleur = (v: string) => (v === "ja" ? "chip goed" : v === "nee" ? "chip kritiek" : "chip let");
  return (
    <details className="rounded-[12px] border border-[var(--lijn)] px-3 py-2" open={lijst.some((v) => v.voldoen !== "ja")}>
      <summary className="cursor-pointer text-[12.5px] font-medium">
        Vereisten nagekeken: {lijst.filter((v) => v.voldoen === "ja").length} van {lijst.length} voldaan
        {gelezen?.length ? ` · gelezen in ${gelezen.length} document${gelezen.length > 1 ? "en" : ""}` : ""}
      </summary>
      <div className="tabelwrap mt-2 overflow-x-auto">
        <table className="tabel">
          <thead>
            <tr>
              <th>Eis</th>
              <th>Bron</th>
              <th>Voldoen we?</th>
              <th>Toelichting</th>
            </tr>
          </thead>
          <tbody>
            {lijst.map((v, i) => (
              <tr key={i}>
                <td className="min-w-[180px] text-[12.5px]">{v.eis}</td>
                <td className="text-[12px] text-[var(--inkt-zacht)]">{v.bron}</td>
                <td>
                  <span className={kleur(v.voldoen)}>{v.voldoen}</span>
                </td>
                <td className="min-w-[200px] text-[12px]">{v.toelichting}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {gelezen?.length > 0 && <p className="mt-2 text-[11.5px] text-[var(--inkt-vaag)]">Gelezen: {gelezen.join("; ")}</p>}
    </details>
  );
}

function Samen({ lijst }: { lijst: SamenOpdracht[] }) {
  return (
    <section className="paneel mt-4">
      <div className="kop">
        <h2>Samen inschrijven</h2>
      </div>
      <p className="mt-2 max-w-[80ch] text-[13px] text-[var(--inkt-zacht)]">
        Opdrachten waarop meerdere van onze firma&apos;s samen kunnen inschrijven, meestal als ontwerpteam. Per firma de dienst die ze
        levert, waarom ze past en haar eigen oordeel. Wat geen van onze firma&apos;s levert, vraagt een externe partner.
      </p>
      {lijst.length === 0 && <p className="mt-3 text-[13px] text-[var(--inkt-zacht)]">Op dit moment geen gezamenlijke opdracht.</p>}
      {lijst.map((o) => {
        const s = STATUS[o.status];
        return (
          <article key={o.opdracht} className="mt-4 rounded-[16px] border border-[var(--lijn)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <a href={o.url || "#"} target="_blank" rel="noopener" className="text-[15px] font-medium leading-snug hover:underline">
                  {o.titel}
                </a>
                <div className="mt-1 text-[12px] text-[var(--inkt-vaag)]">
                  {[o.aanbesteder, o.bron, o.niveau === "EU" ? "Europees" : "nationaal", wanneer(o.deadline)].join(" · ")}
                </div>
              </div>
              <span className={s.chip}>
                <i className="stip" />
                {s.label}
              </span>
            </div>
            {o.advies && <p className="mt-2 text-[13px]">{o.advies}</p>}
            <div className="tabelwrap mt-3 overflow-x-auto">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Firma</th>
                    <th>Dienst</th>
                    <th>Waarom</th>
                    <th>Oordeel</th>
                  </tr>
                </thead>
                <tbody>
                  {o.rollen.map((r) => (
                    <tr key={r.firma}>
                      <td className="whitespace-nowrap font-medium">
                        <a href={link(r.firma)} className="hover:underline">{r.naam}</a>
                      </td>
                      <td className="min-w-[160px] text-[12.5px]">{r.dienst}</td>
                      <td className="min-w-[180px] text-[12px] text-[var(--inkt-zacht)]">{r.waarom}</td>
                      <td className="min-w-[240px] text-[12.5px]">
                        <span className={STATUS[r.status].chip}>{STATUS[r.status].label}</span>
                        <div className="mt-1">{r.reden}</div>
                        {r.nodig && r.status !== "ja" && <div className="mt-1 text-[var(--inkt-zacht)]">Nodig: {r.nodig}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {o.ontbreekt.length > 0 && (
              <div className="notitie let mt-3">
                <b className="font-medium">Geen eigen firma voor: </b>
                {o.ontbreekt.join(", ")}. Daarvoor is een externe partner nodig.
              </div>
            )}
            {o.map && (
              <p className="mt-3 text-[12.5px]">
                <a href={o.map.link} target="_blank" rel="noopener" className="underline underline-offset-2">
                  Map in Dropbox met fiche en documenten
                </a>
              </p>
            )}
          </article>
        );
      })}
    </section>
  );
}

function OpdrachtRij({ t }: { t: Treffer }) {
  const s = STATUS[t.oordeel.status];
  const meta = [t.aanbesteder, t.bron, t.niveau === "EU" ? "Europees" : "nationaal", wanneer(t.deadline), bedrag(t)].filter(Boolean);
  return (
    <article className="border-b border-[var(--lijn)] py-4 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <a href={t.url || "#"} target="_blank" rel="noopener" className="text-[14.5px] font-medium leading-snug text-[var(--inkt)] hover:underline">
            {t.titel}
          </a>
          <div className="mt-1 text-[12px] text-[var(--inkt-vaag)]">{meta.join(" · ")}</div>
        </div>
        <span className={s.chip}>
          <i className="stip" />
          {s.label}
        </span>
      </div>
      <div className="mt-2 grid gap-1.5 text-[13px] leading-relaxed">
        {t.oordeel.reden && (
          <p className="m-0 text-[var(--inkt)]">
            <span className="font-medium">Oordeel: </span>
            {t.oordeel.reden}
          </p>
        )}
        {t.oordeel.redenen.length > 0 && (
          <ul className="m-0 list-none space-y-0.5 p-0 text-[12.5px] text-[var(--inkt-zacht)]">
            {t.oordeel.redenen.map((r) => (
              <li key={r}>· {r}</li>
            ))}
          </ul>
        )}
        {t.oordeel.status !== "ja" && t.oordeel.nodig && (
          <p className="m-0 text-[13px] text-[var(--inkt)]">
            <span className="font-medium">Wat nodig is om mee te doen: </span>
            {t.oordeel.nodig}
          </p>
        )}
        <Vereisten lijst={t.oordeel.vereisten} gelezen={t.oordeel.documenten_gelezen} />
        {t.map && (
          <p className="m-0 text-[12.5px]">
            <a href={t.map.link} target="_blank" rel="noopener" className="underline underline-offset-2">
              Map in Dropbox met fiche en documenten
            </a>
          </p>
        )}
        <p className="m-0 text-[11.5px] text-[var(--inkt-vaag)]">
          Gevonden op: {t.past.join("; ") || "zoekprofiel"}
          {" · "}oordeel van {t.oordeel.door}
          {t.oordeel.datum ? ` (${datum(t.oordeel.datum)})` : ""}
          {t.oordeel.dossier ? " · tenderfiche klaar" : ""}
        </p>
      </div>
    </article>
  );
}

function Opdrachten({ f, toon }: { f: Firma; toon: string }) {
  const n = tel(f);
  const filter = (["ja", "als", "nee"] as const).includes(toon as OordeelStatus) ? (toon as OordeelStatus) : null;
  const zichtbaar = f.treffers.filter((t) => (filter ? t.oordeel.status === filter : t.oordeel.status !== "nee"));
  const knop = (waarde: string, label: string, aantal: number, klasse: string) => (
    <a
      href={link(f.code, waarde)}
      className={klasse + (toon === waarde || (!filter && waarde === "open") ? " ring-2 ring-[var(--inkt)]/20" : "")}
    >
      {label} {aantal}
    </a>
  );
  return (
    <section id="opdrachten" className="paneel mt-4 scroll-mt-4">
      <div className="kop flex flex-wrap items-center justify-between gap-2">
        <h2>Gevonden opdrachten</h2>
        <div className="flex flex-wrap gap-1.5">
          {knop("open", "Kansen", n.ja + n.als, "chip accent")}
          {knop("ja", "Kan meedoen", n.ja, "chip goed")}
          {knop("als", "Als …", n.als, "chip let")}
          {knop("nee", "Kan niet", n.nee, "chip kritiek")}
        </div>
      </div>
      {zichtbaar.length === 0 ? (
        <p className="mt-3 text-[13px] text-[var(--inkt-zacht)]">
          {filter ? "Geen opdrachten in deze groep." : "Op dit moment geen opdracht waaraan deze firma kan meedoen."}
          {!filter && n.nee > 0 && (
            <>
              {" "}
              <a href={link(f.code, "nee")} className="underline">Bekijk de {n.nee} opdrachten die afvallen en waarom.</a>
            </>
          )}
        </p>
      ) : (
        <div className="mt-1">{zichtbaar.map((t) => <OpdrachtRij key={t.sleutel} t={t} />)}</div>
      )}
      {!filter && n.nee > 0 && zichtbaar.length > 0 && (
        <p className="mt-3 text-[12.5px] text-[var(--inkt-zacht)]">
          {n.nee} opdrachten vallen af.{" "}
          <a href={link(f.code, "nee")} className="underline">Toon ze met de reden.</a>
        </p>
      )}
    </section>
  );
}

function Situatie({ f }: { f: Firma }) {
  return (
    <section id="situatie" className="paneel mt-4 scroll-mt-4">
      <div className="kop">
        <h2>Situatie van de firma</h2>
      </div>
      <p className="mt-2 max-w-[75ch] text-[13.5px] text-[var(--inkt-zacht)]">{f.samenvatting}</p>
      <div className="mt-3 grid gap-2.5">
        {f.punten.map((p) => (
          <div key={p.onderwerp} className="grid gap-x-3 gap-y-0.5 sm:grid-cols-[180px_1fr]">
            <div className="flex items-center gap-2 text-[13px] font-medium">
              <i className={p.kleur === "rood" ? "rot k" : p.kleur === "oranje" ? "rot l" : "rot g"} />
              {p.onderwerp}
            </div>
            <div className="min-w-0 text-[13px]">
              <span className="text-[var(--inkt)]">{p.stand}.</span> <span className="text-[var(--inkt-zacht)]">{p.gevolg}</span>
            </div>
          </div>
        ))}
      </div>
      {f.nodig.length > 0 && (
        <div className="notitie let mt-4">
          <b className="font-medium">Nodig vóór een indiening: </b>
          {f.nodig.join(" · ")}
        </div>
      )}
    </section>
  );
}

function Codes({ lijst }: { lijst: [string, string][] }) {
  return (
    <div className="grid gap-1">
      {lijst.map(([code, label]) => (
        <div key={code} className="grid grid-cols-[86px_1fr] gap-2 text-[13px]">
          <span className="font-mono text-[12.5px] tabular-nums text-[var(--accent)]">{code}</span>
          <span>{label || "omschrijving niet in de lijst"}</span>
        </div>
      ))}
    </div>
  );
}

function Woorden({ lijst, doorstreept }: { lijst: string[]; doorstreept?: boolean }) {
  if (!lijst.length) return <span className="text-[12.5px] text-[var(--inkt-vaag)]">geen</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {lijst.map((w) => (
        <span key={w} className={"chip" + (doorstreept ? " kritiek line-through" : "")}>{w}</span>
      ))}
    </div>
  );
}

function Criteria({ f }: { f: Firma }) {
  const c = f.criteria;
  const OORDEEL: Record<string, string> = {
    gekozen: "chip goed",
    "in de scan": "chip goed",
    "niet gekozen": "chip kritiek",
    "te breed": "chip kritiek",
    "niet voor HDS": "chip kritiek",
    later: "chip",
    "andere route": "chip accent",
    "aan te raden": "chip let",
  };
  return (
    <section id="criteria" className="paneel mt-4 scroll-mt-4">
      <div className="kop">
        <h2>Zoekcriteria</h2>
      </div>

      {c.bosa.length > 0 && (
        <div className="mt-3 grid gap-3">
          {c.bosa.map((b) => (
            <div key={b.naam} className="rounded-[14px] border border-[var(--lijn)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[14px] font-medium">BOSA-profiel: {b.naam}</div>
                <span className={b.status.startsWith("nieuw") ? "chip goed" : b.status.includes("breed") ? "chip let" : "chip"}>{b.status}</span>
              </div>
              <div className="mt-1 text-[12px] text-[var(--inkt-vaag)]">
                Onderneming in BOSA: {b.onderneming} · {b.aard} · regio {b.regio.map(([k, n]) => `${n} (${k})`).join(", ")} · enkel lopende termijnen · mailt naar procurements@unabo.be
              </div>
              <div className="mt-3">
                <Codes lijst={b.cpv} />
              </div>
            </div>
          ))}
        </div>
      )}

      {c.bronnen_uitleg.length > 0 && (
        <div className="tabelwrap mt-3 overflow-x-auto">
          <table className="tabel">
            <thead>
              <tr>
                <th>Bron</th>
                <th>Wat</th>
                <th>Hoe</th>
              </tr>
            </thead>
            <tbody>
              {c.bronnen_uitleg.map((b) => (
                <tr key={b.bron}>
                  <td className="font-medium">{b.bron}</td>
                  <td className="text-[12.5px]">{b.wat}</td>
                  <td className="whitespace-nowrap text-[12.5px]">{b.hoe}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {c.waarom && (
        <div className="notitie accent mt-4">
          <b className="font-medium">Waarom deze keuze: </b>
          {c.waarom}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <span className="label">Scan bovenop {f.land === "BE" ? "BOSA" : "de bronnen"}</span>
          <div className="mt-2 grid gap-2 text-[13px]">
            <div>
              <span className="text-[var(--inkt-zacht)]">Bronnen: </span>
              {c.scan.bronnen.join(", ")}
            </div>
            {c.scan.regio.length > 0 && (
              <div>
                <span className="text-[var(--inkt-zacht)]">Regio: </span>
                {c.scan.regio.map(([k, n]) => `${n} (${k})`).join(", ")}
              </div>
            )}
            <div>
              <span className="text-[var(--inkt-zacht)]">Maximum: </span>
              {c.scan.max_bedrag ? `€ ${c.scan.max_bedrag.toLocaleString("nl-BE")} (excl. btw); daarboven vlag "te groot"` : "geen grens"}
            </div>
            {c.scan.cpv.length > 0 && (
              <div>
                <span className="text-[var(--inkt-zacht)]">CPV in de scan:</span>
                <div className="mt-1">
                  <Codes lijst={c.scan.cpv} />
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="grid min-w-0 content-start gap-3">
          <div>
            <span className="label">Trefwoorden</span>
            <div className="mt-1.5">
              <Woorden lijst={c.scan.trefwoorden} />
            </div>
          </div>
          <div>
            <span className="label">Uitsluiten (in de titel)</span>
            <div className="mt-1.5">
              <Woorden lijst={c.scan.uitsluiten} doorstreept />
            </div>
          </div>
          <div>
            <span className="label">Voorrang</span>
            <div className="mt-1.5 text-[13px]">{c.scan.voorrang.join(", ") || "geen"}</div>
          </div>
        </div>
      </div>

      {c.alternatieven.length > 0 && (
        <>
          <h3 className="mt-5 mb-1 font-serif text-[17px] font-medium">Andere mogelijkheden</h3>
          <div className="tabelwrap overflow-x-auto">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Mogelijkheid</th>
                  <th>Keuze</th>
                  <th>Waarom</th>
                </tr>
              </thead>
              <tbody>
                {c.alternatieven.map((a) => (
                  <tr key={a.optie}>
                    <td className="min-w-[200px] font-medium">{a.optie}</td>
                    <td>
                      <span className={OORDEEL[a.oordeel] || "chip"}>{a.oordeel}</span>
                    </td>
                    <td className="min-w-[260px] text-[12.5px]">{a.waarom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

/** Voor afdelingsteams: bedragen van het eigen vermogen uit de toelichtingen weglaten (het oordeel blijft). */
function zonderBedragen(f: Firma): Firma {
  const tekst = JSON.stringify(f).replace(/(eigen vermogen)( van)?\s*(:\s*)?€\s?-?[\d.]+(,\d+)?/gi, "$1 (bedrag enkel voor de directie)");
  return JSON.parse(tekst) as Firma;
}

export default async function AanbestedingenPagina({ searchParams }: { searchParams: Promise<Zoek> }) {
  const h = await headers();
  const toegang = aanbestedingFirmas(h.get("x-authentik-groups"));
  const volledig = toegang === "alle";
  if (!toegang) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="paneel">
          <h2>Geen toegang</h2>
          <p className="mt-2 text-[13px] text-zinc-500">Openbare aanbestedingen zijn enkel zichtbaar voor de directie en het salesteam.</p>
        </div>
      </main>
    );
  }
  const sp = await searchParams;
  const m = laatste();
  if (!m) {
    return (
      <main className="mx-auto max-w-5xl px-6 pb-10">
        <div className="kopbalk">
          <h1 className="h1-glas">Openbare aanbestedingen</h1>
        </div>
        <div className="paneel mt-4">
          <p className="text-[13px] text-zinc-500">Nog geen stand ontvangen van De Tenderwachter. Die komt na zijn eerstvolgende ronde.</p>
        </div>
      </main>
    );
  }
  // Afdelingsteams zien enkel hun eigen firma, zonder overzicht, samenwerkingen of financiële situatie.
  const firmas = volledig ? m.firmas : m.firmas.filter((f) => (toegang as string[]).includes(f.code)).map(zonderBedragen);
  const firma = firmas.find((f) => f.code === sp.firma) || (!volledig && firmas.length === 1 ? firmas[0] : null);
  const samen = volledig ? m.samen || [] : [];
  const toonSamen = volledig && sp.firma === "samen";
  const totaal = firmas.reduce((n, f) => n + tel(f).ja + tel(f).als, 0);
  return (
    <main className="mx-auto max-w-6xl px-6 pb-10">
      <div className="kopbalk">
        <h1 className="h1-glas">Openbare aanbestedingen</h1>
        <p className="text-[12.5px] text-zinc-500">
          {totaal} kansen over {firmas.length} firma{firmas.length === 1 ? "" : "&apos;s"} · bijgewerkt {datum(m.bijgewerkt)} door De Tenderwachter
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {m.bronnen.map((b) => (
          <span key={b.bron} className={b.status === "ok" ? "chip" : b.status === "oud" ? "chip let" : "chip kritiek"} title={b.uitleg}>
            {b.bron} · {datum(b.datum)}
            {b.status === "oud" ? " · ouder dan een week" : b.status === "fout" ? " · fout" : ""}
          </span>
        ))}
      </div>
      {(volledig || firmas.length > 1) && <Tabs firmas={firmas} actief={toonSamen ? "samen" : firma?.code || null} samen={samen.length} />}
      {toonSamen ? (
        <Samen lijst={samen} />
      ) : !firma ? (
        <>
          {samen.length > 0 && (
            <div className="notitie accent mt-4">
              <b className="font-medium">{samen.length} opdracht{samen.length > 1 ? "en" : ""} waarop meerdere firma&apos;s samen kunnen inschrijven. </b>
              <a href={link("samen")} className="underline">Bekijk wie welke dienst levert.</a>
            </div>
          )}
          <Overzicht firmas={firmas} toonKnelpunt={volledig} />
          <p className="mt-3 max-w-[80ch] text-[12.5px] text-[var(--inkt-zacht)]">
            Elke opdracht krijgt een oordeel: kan meedoen, kan meedoen als een voorwaarde vervuld is, of kan niet meedoen, telkens met de
            reden. Het oordeel steunt op de situatie van de firma (erkenning, eigen vermogen, titels, taal, regio, termijn).
            &quot;Kan meedoen&quot; staat er pas als de vereisten in de opdrachtdocumenten nagekeken zijn; bij &quot;kan niet&quot; staat
            telkens wat nodig is om wel mee te kunnen doen. Opdrachten onder € 140.000 zonder bekendmaking verschijnen nergens: daarvoor moet een firma door
            het bestuur uitgenodigd worden.
          </p>
        </>
      ) : (
        <>
          <nav className="mt-4 flex gap-4 text-[13px]">
            <a href="#opdrachten" className="text-[var(--inkt-zacht)] hover:text-[var(--inkt)]">Opdrachten</a>
            {volledig && <a href="#situatie" className="text-[var(--inkt-zacht)] hover:text-[var(--inkt)]">Situatie</a>}
            <a href="#criteria" className="text-[var(--inkt-zacht)] hover:text-[var(--inkt)]">Zoekcriteria</a>
          </nav>
          <Opdrachten f={firma} toon={sp.toon || "open"} />
          {volledig && <Situatie f={firma} />}
          <Criteria f={firma} />
        </>
      )}
    </main>
  );
}
