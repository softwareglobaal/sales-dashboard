import Link from "next/link";
import { afdeling } from "@/lib/afdelingen";
import { Suspense } from "react";
import { SubNav } from "@/components/SubNav";
import { Kpi } from "@/components/ui";
import { VergelijkingPerSite, KernReeks, ParamKeuze, InklapTabel } from "@/components/WebsiteGrafieken";
import { num, pct } from "@/lib/format";
import { geoStatus } from "@/lib/geoip";
import { BE_VIEWBOX, BE_PROVINCES, projectLatLng } from "@/lib/belgiumGeo";
import {
  PERIODES, isPeriode, bereik, heeftMetingen, zichtbareSites, kern, perSite, nuOnline, reeksPerSite, reeksKern,
  uurRaster, kanalen, kanaalPerSite, bronnen, instappaginas, uitstappaginas, paginas, paden, paginaKeuze, landen,
  regios, steden, kliksoorten, topKlikken, klikkaart, sectieAandacht, scrolldiepte, verdeling, snelheid, recent,
  paginaMaat, laatsteMeting, type Periode, type Kern,
} from "@/lib/websitesQueries";

export const dynamic = "force-dynamic";

// Tab Websites (spec §15): bezoekers, herkomst, locatie en gedrag op de eigen sites,
// uit de eigen meting (public/m.js -> /api/meet -> data/websites.db).

const PAD = "/websites";

const LANDNAAM = new Intl.DisplayNames(["nl"], { type: "region" });
const landNaam = (c: string | null) => {
  if (!c) return "Onbekend";
  try {
    return LANDNAAM.of(c) || c;
  } catch {
    return c;
  }
};

function duur(s: number) {
  if (!s) return "0s";
  const m = Math.floor(s / 60);
  return m ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}
function verschil(nu: number, vorig: number) {
  if (!vorig) return nu ? "nieuw t.o.v. vorige periode" : "geen gegevens vorige periode";
  const d = (nu - vorig) / vorig;
  return `${d >= 0 ? "+" : "−"}${Math.abs(Math.round(d * 100))}% t.o.v. vorige periode`;
}

// Kanalen in vaste volgorde met een vaste kleur uit het categorische palet; alles
// daarbuiten valt samen onder "Overig" (grijs), nooit een negende kleur.
const KANAAL_KLEUR: [string, string][] = [
  ["Zoekmachine (organisch)", "#2a78d6"],
  ["Google Ads", "#eb6834"],
  ["Direct", "#1baf7a"],
  ["AI-assistent", "#eda100"],
  ["Sociale media", "#e87ba4"],
  ["Verwijzende site", "#008300"],
  ["Eigen zustersite", "#4a3aa7"],
  ["E-mail", "#e34948"],
];
const kanaalKleur = (k: string) => KANAAL_KLEUR.find(([n]) => n === k)?.[1] || "#b5b0a8";

const KLIKSOORT: Record<string, string> = {
  link: "Interne link", uitgaand: "Link naar andere site", tel: "Telefoonnummer", mail: "E-mailadres",
  whatsapp: "WhatsApp", download: "Download", knop: "Knop", formulier: "Formulier verzonden", overig: "Klik naast een link",
};

type Zoek = { site?: string; periode?: string; pagina?: string; apparaat?: string; dienst?: string };

function href(sp: Zoek, wijziging: Partial<Zoek>) {
  const p = new URLSearchParams();
  const alles = { ...sp, ...wijziging };
  for (const [k, v] of Object.entries(alles)) if (v) p.set(k, v);
  if (wijziging.site !== undefined || wijziging.periode !== undefined) p.delete("pagina");
  return `${PAD}?${p.toString()}`;
}

function Pil({ actief, naar, children, kleur }: { actief: boolean; naar: string; children: React.ReactNode; kleur?: string }) {
  return (
    <Link
      href={naar}
      scroll={false}
      style={actief ? { background: "var(--donker)", color: "var(--donker-tekst)" } : undefined}
      className={
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] transition " +
        (actief ? "bg-zinc-900 text-white" : "border border-black/10 bg-white/70 text-zinc-600 hover:bg-white")
      }
    >
      {kleur && <i style={{ width: 8, height: 8, borderRadius: 9, background: kleur, display: "inline-block" }} />}
      {children}
    </Link>
  );
}

function Paneel({ id, titel, uitleg, children, breed }: { id?: string; titel: string; uitleg?: string; children: React.ReactNode; breed?: boolean }) {
  return (
    <section id={id} className={"paneel scroll-mt-44 " + (breed ? "lg:col-span-2" : "")}>
      <div className="kop" style={{ display: "block" }}>
        <h2 style={{ fontSize: 18 }}>{titel}</h2>
        {uitleg && <p className="mt-1 text-[12.5px] leading-snug text-zinc-500">{uitleg}</p>}
      </div>
      {children}
    </section>
  );
}

function Leeg({ tekst = "Nog geen metingen in deze periode." }: { tekst?: string }) {
  return <p className="py-6 text-center text-[13px] text-zinc-400">{tekst}</p>;
}

/** Horizontale staven: het label links, de waarde rechts, de staaf relatief tot de grootste. */
function Staven({ rijen, eenheid }: { rijen: { label: React.ReactNode; waarde: number; sub?: string; kleur?: string; titel?: string }[]; eenheid?: string }) {
  if (!rijen.length) return <Leeg />;
  const max = Math.max(...rijen.map((r) => r.waarde), 1);
  return (
    <ul className="space-y-2">
      {rijen.map((r, i) => (
        <li key={i} title={r.titel}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate text-zinc-800">{r.label}</span>
            <span className="shrink-0 tabular-nums text-zinc-600">
              {num(r.waarde)}{eenheid ? ` ${eenheid}` : ""}{r.sub ? <span className="ml-1.5 text-zinc-400">{r.sub}</span> : null}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-black/[.05]">
            <div className="h-1.5 rounded-full" style={{ width: `${Math.max(2, (r.waarde / max) * 100)}%`, background: r.kleur || "#3987e5" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Tabel({ koppen, rijen, rechts = [], max }: { koppen: string[]; rijen: React.ReactNode[][]; rechts?: number[]; max?: number }) {
  if (!rijen.length) return <Leeg />;
  if (max && rijen.length > max) return <InklapTabel koppen={koppen} rijen={rijen} rechts={rechts} max={max} />;
  return (
    <div className="tabelwrap">
      <table className="tabel">
        <thead>
          <tr>{koppen.map((k, i) => <th key={k} className={rechts.includes(i) ? "num" : ""}>{k}</th>)}</tr>
        </thead>
        <tbody>
          {rijen.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} className={rechts.includes(j) ? "num" : ""}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SiteLabel = ({ sleutel, sites }: { sleutel: string; sites: { sleutel: string; naam: string; kleur: string }[] }) => {
  const s = sites.find((x) => x.sleutel === sleutel);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <i style={{ width: 8, height: 8, borderRadius: 9, background: s?.kleur || "#999", display: "inline-block" }} />
      {s?.naam || sleutel}
    </span>
  );
};

/** Sessies per weekdag x uur, één kleurtint van licht naar donker. */
function UurRaster({ cellen }: { cellen: { weekdag: number; uur: number; n: number }[] }) {
  const max = Math.max(...cellen.map((c) => c.n), 1);
  const stappen = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
  const dagen = ["ma", "di", "wo", "do", "vr", "za", "zo"];
  return (
    <div className="overflow-x-auto">
      <div style={{ display: "grid", gridTemplateColumns: "28px repeat(24, minmax(14px, 1fr))", gap: 2, minWidth: 420 }}>
        <span />
        {Array.from({ length: 24 }, (_, u) => (
          <span key={u} className="text-center text-[10px] text-zinc-400">{u % 3 === 0 ? u : ""}</span>
        ))}
        {dagen.map((d, i) => (
          <div key={d} style={{ display: "contents" }}>
            <span className="text-[11px] leading-[18px] text-zinc-500">{d}</span>
            {Array.from({ length: 24 }, (_, u) => {
              const n = cellen.find((c) => c.weekdag === i + 1 && c.uur === u)?.n || 0;
              const kleur = n ? stappen[Math.min(stappen.length - 1, Math.floor((n / max) * (stappen.length - 1) + 0.0001))] : "rgba(22,21,15,.05)";
              return <span key={u} title={`${d} ${u}u–${u + 1}u: ${num(n)} sessies`} style={{ height: 18, borderRadius: 4, background: kleur }} />;
            })}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11.5px] text-zinc-400">Belgische tijd. Donkerder = meer sessies (max. {num(max)} in één uurvak).</p>
    </div>
  );
}

/** Belgiëkaart met een bol per gemeente; grootte = sessies. */
function KaartBelgie({ punten }: { punten: { stad: string | null; lat: number | null; lon: number | null; sessies: number; conversies: number }[] }) {
  // De kaart dekt Vlaanderen en Brussel; wat erbuiten valt staat in de tabellen.
  const be = punten.filter((p) => {
    if (p.lat == null || p.lon == null) return false;
    const [x, y] = projectLatLng(p.lat, p.lon);
    return x >= 0 && x <= 1000 && y >= 0 && y <= 387;
  });
  const max = Math.max(...be.map((p) => p.sessies), 1);
  return (
    <svg viewBox={BE_VIEWBOX} className="h-auto w-full" role="img" aria-label="Bezoekers per gemeente in België">
      {BE_PROVINCES.map((p) => (
        <path key={p.name} d={p.d} fill="rgba(22,21,15,.05)" stroke="rgba(22,21,15,.18)" strokeWidth={1}>
          <title>{p.name}</title>
        </path>
      ))}
      {[...be].sort((a, b) => b.sessies - a.sessies).map((p, i) => {
        const [x, y] = projectLatLng(p.lat!, p.lon!);
        const r = 4 + Math.sqrt(p.sessies / max) * 22;
        return (
          <circle key={i} cx={x} cy={y} r={r} fill="#2a78d6" fillOpacity={0.55} stroke="#fff" strokeWidth={2}>
            <title>{`${p.stad}: ${num(p.sessies)} sessies${p.conversies ? `, ${num(p.conversies)} met contactactie` : ""}`}</title>
          </circle>
        );
      })}
    </svg>
  );
}

/**
 * Klikkaart: de pagina als lange strook, met de secties op hun gemeten plaats, de
 * klikken als punten en rechts hoeveel bezoekers tot op die hoogte scrollden.
 */
function Klikkaart({ klikken, secties, totaal, maat }: {
  klikken: { x: number; y: number; soort: string; tekst: string | null }[];
  secties: { naam: string; gezien: number; gemMs: number; y: number; h: number }[];
  totaal: number;
  maat: { docH: number; vw: number; scrolls: number[] };
}) {
  const B = 360;
  const verhouding = maat.vw ? Math.min(14, Math.max(1.2, maat.docH / maat.vw)) : 4;
  const H = Math.round(B * verhouding);
  const reik = (d: number) => (maat.scrolls.length ? maat.scrolls.filter((s) => s >= d).length / maat.scrolls.length : 0);
  const conversie = new Set(["tel", "mail", "whatsapp", "formulier"]);
  return (
    <svg viewBox={`0 0 ${B + 70} ${H}`} className="w-full" style={{ maxHeight: 1100 }} role="img" aria-label="Klikkaart van de pagina">
      <rect x={0} y={0} width={B} height={H} rx={10} fill="#fff" stroke="rgba(22,21,15,.12)" />
      {secties.filter((s) => s.y != null && s.h).map((s, i) => {
        const y = (s.y / 1000) * H, h = Math.max(14, (s.h / 1000) * H);
        return (
          <g key={s.naam}>
            <rect x={1} y={y} width={B - 2} height={h} fill={i % 2 ? "rgba(22,21,15,.035)" : "rgba(42,120,214,.04)"} />
            <text x={8} y={y + 14} fontSize={10} fill="#5f5a52">
              {s.naam.length > 42 ? s.naam.slice(0, 41) + "…" : s.naam}
            </text>
            <title>{`${s.naam}: gezien door ${totaal ? Math.round((s.gezien / totaal) * 100) : 0}% · gemiddeld ${duur(Math.round((s.gemMs || 0) / 1000))} in beeld`}</title>
          </g>
        );
      })}
      {klikken.map((k, i) => (
        <circle key={i} cx={(k.x / 1000) * B} cy={(k.y / 1000) * H} r={conversie.has(k.soort) ? 6 : 5}
          fill={conversie.has(k.soort) ? "#eb6834" : "#e34948"} fillOpacity={conversie.has(k.soort) ? 0.85 : 0.28}>
          <title>{`${KLIKSOORT[k.soort] || k.soort}${k.tekst ? `: ${k.tekst}` : ""}`}</title>
        </circle>
      ))}
      {Array.from({ length: 10 }, (_, i) => {
        const d = (i + 1) * 10;
        const a = reik(d);
        return (
          <g key={d}>
            <rect x={B + 10} y={(i / 10) * H} width={14} height={H / 10 - 2} rx={3} fill="#1c5cab" fillOpacity={0.1 + a * 0.8} />
            <text x={B + 28} y={(i / 10) * H + 12} fontSize={10} fill="#5f5a52">{Math.round(a * 100)}%</text>
            <title>{`${Math.round(a * 100)}% van de bezoekers scrolde tot ${d}% van de pagina`}</title>
          </g>
        );
      })}
    </svg>
  );
}

function Leegstand({ sites, geo }: { sites: { naam: string; sleutel: string; url: string; gemeten: boolean }[]; geo: ReturnType<typeof geoStatus> }) {
  return (
    <div className="paneel">
      <div className="kop" style={{ display: "block" }}>
        <h2 style={{ fontSize: 18 }}>De meting is klaar, er zijn nog geen bezoeken binnen</h2>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-zinc-600">
          Zodra het meetscript op een site staat, verschijnen hier de eerste bezoekers binnen enkele seconden. Het script
          plaatst geen cookies en slaat geen IP-adressen op, dus er is geen cookiebanner voor nodig.
        </p>
      </div>
      <Tabel
        koppen={["Site", "Adres", "Meting"]}
        rijen={sites.map((s) => [s.naam, <a key="a" href={s.url} className="underline decoration-black/20" target="_blank">{s.url.replace("https://", "")}</a>,
          s.gemeten ? <span key="c" className="chip goed">ontvangt gegevens</span> : <span key="c" className="chip">wacht op eerste bezoek</span>])}
      />
      <p className="mt-4 text-[12px] text-zinc-500">
        Script op een site: <code className="rounded bg-black/5 px-1.5 py-0.5">{'<script defer src="https://meet.globaal.be/m.js" data-site="sleutel"></script>'}</code>
      </p>
      <p className="mt-2 text-[12px] text-zinc-500">
        Locatiedatabank: {geo.klaar ? `klaar (${geo.datum})` : "wordt bij het eerste bezoek opgehaald"}
        {geo.fout ? ` · laatste fout: ${geo.fout}` : ""}
      </p>
    </div>
  );
}

export default async function WebsitesPage({ searchParams }: { searchParams: Promise<Zoek> }) {
  const sp = await searchParams;
  const periode: Periode = isPeriode(sp.periode) ? sp.periode : "30d";
  const perMaand = periode === "12m";
  const alleSites = zichtbareSites();
  // site mag een lijst zijn ("regulariseren,mijnregularisatie"): zo opent een dienst
  // met meerdere sites (spec §17) meteen op al zijn sites samen.
  const gevraagd = (sp.site || "").split(",").filter(Boolean);
  const gekozenLijst = alleSites.filter((s) => gevraagd.includes(s.sleutel));
  const gekozen = gekozenLijst.length === 1 ? gekozenLijst[0] : undefined;
  const sites = gekozenLijst.length ? gekozenLijst.map((s) => s.sleutel) : alleSites.map((s) => s.sleutel);
  const vanDienst = sp.dienst ? afdeling(sp.dienst) : undefined;
  // Doorklik vanaf een dienst: van een gedeelde site (unabo.be) telt enkel het deel
  // over die dienst. Sites zonder woorden in de config tellen volledig mee.
  const scope: Record<string, string[]> = Object.fromEntries(
    (vanDienst?.kanalen.websites || []).filter((w) => w.paden?.length).map((w) => [w.site, w.paden!]),
  );
  const b = bereik(periode, scope);
  const geo = geoStatus();
  const laatste = laatsteMeting();

  const Kop = (
    <div className="kopbalk">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="h1-glas">Websites</h1>
          <p className="text-[12.5px] text-zinc-500">
            Bezoekers, herkomst, locatie en gedrag op onze eigen sites · {b.label} ({b.van.split("-").reverse().join("/")} tot {b.tot.split("-").reverse().join("/")})
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PERIODES.map((p) => (
            <Pil key={p.key} actief={p.key === periode} naar={href(sp, { periode: p.key })}>{p.label}</Pil>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {vanDienst && (
          <Link href={`/${vanDienst.pad}/kanalen`} className="chip accent" style={{ padding: "6px 13px", fontSize: 12.5 }}>
            ← {vanDienst.naam}
          </Link>
        )}
        {Object.entries(scope)
          .filter(([site]) => sites.includes(site))
          .map(([site, woorden]) => (
            <span key={site} className="chip" style={{ padding: "6px 13px", fontSize: 12.5 }}>
              {alleSites.find((x) => x.sleutel === site)?.naam || site}: enkel pagina&apos;s over {woorden.slice(0, 3).join(", ")}
              {woorden.length > 3 ? "…" : ""}
            </span>
          ))}
        <Pil actief={gekozenLijst.length === 0} naar={href(sp, { site: "" })}>Alle sites</Pil>
        {alleSites.map((s) => {
          const l = laatste.find((x) => x.site === s.sleutel);
          return (
            <Pil key={s.sleutel} actief={gevraagd.includes(s.sleutel)} naar={href(sp, { site: s.sleutel })} kleur={s.kleur}>
              {s.naam}
              {!l && <span className="text-[10.5px] opacity-60">(geen meting)</span>}
            </Pil>
          );
        })}
      </div>
    </div>
  );

  if (!heeftMetingen()) {
    return (
      <main className="mx-auto max-w-7xl px-6 pb-10">
        {Kop}
        <div className="mt-4"><Leegstand sites={alleSites} geo={geo} /></div>
      </main>
    );
  }

  const k = kern(sites, b);
  const online = nuOnline(sites);
  const vergelijking = !gekozen ? perSite(sites, b) : [];
  const kleurSites = alleSites.map((s) => ({ sleutel: s.sleutel, naam: s.naam, kleur: s.kleur }));
  const kanaalRijen = kanalen(sites, b);
  const kps = !gekozen ? kanaalPerSite(sites, b) : [];
  const bronRijen = bronnen(sites, b);
  const instap = instappaginas(sites, b);
  const uitstap = uitstappaginas(sites, b);
  const paginaRijen = paginas(sites, b);
  const stappen = paden(sites, b);
  const landRijen = landen(sites, b);
  const regioRijen = regios(sites, b);
  const stadRijen = steden(sites, b);
  const soorten = kliksoorten(sites, b);
  const klikRijen = topKlikken(sites, b);
  const scroll = scrolldiepte(sites, b);
  const snel = snelheid(sites, b);
  const live = recent(sites);
  const tech = {
    apparaat: verdeling(sites, b, "apparaat"),
    browser: verdeling(sites, b, "browser"),
    os: verdeling(sites, b, "os"),
    taal: verdeling(sites, b, "taal"),
  };
  const totaalSessies = k.nu.sessies || 1;

  // Klikkaart: één pagina van één site.
  const keuze = gekozen ? paginaKeuze([gekozen.sleutel], b) : [];
  const pagina = gekozen ? (keuze.find((p) => p.pad === sp.pagina)?.pad ?? keuze[0]?.pad) : undefined;
  const apparaat = sp.apparaat === "mobiel" ? "mobiel" : "desktop";
  const kaart = gekozen && pagina
    ? {
        klikken: klikkaart(gekozen.sleutel, pagina, b, apparaat),
        aandacht: sectieAandacht(gekozen.sleutel, pagina, b, apparaat),
        maat: paginaMaat(gekozen.sleutel, pagina, b, apparaat),
        klikLijst: topKlikken([gekozen.sleutel], b, pagina),
        scroll: scrolldiepte([gekozen.sleutel], b, pagina),
      }
    : null;

  const KernKpis = ({ n, v }: { n: Kern; v: Kern }) => (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Kpi label="Bezoekers" value={num(n.bezoekers)} sub={verschil(n.bezoekers, v.bezoekers)} />
      <Kpi label="Sessies" value={num(n.sessies)} sub={`${n.paginasPerSessie.toFixed(1).replace(".", ",")} pagina's per sessie`} />
      <Kpi label="Paginaweergaven" value={num(n.weergaven)} sub={verschil(n.weergaven, v.weergaven)} />
      <Kpi label="Gem. actieve tijd" value={duur(n.gemDuurS)} sub={`vorige periode ${duur(v.gemDuurS)}`} />
      <Kpi label="Betrokken sessies" value={pct(n.betrokkenPct)} sub={`bounce ${pct(1 - n.betrokkenPct)} · ${pct(n.terugkerendPct)} terugkerend`} />
      <Kpi label="Contactacties" value={num(n.conversies)} sub={`bel-, mail- en formulieracties · ${online} nu online`} />
    </div>
  );

  return (
    <main className="mx-auto max-w-7xl px-6 pb-10">
      {Kop}
      <Suspense>
        <SubNav
          items={[
            { id: "overzicht", label: "Overzicht" },
            ...(!gekozen ? [{ id: "vergelijking", label: "Vergelijking" }] : []),
            { id: "herkomst", label: "Herkomst" },
            { id: "paginas", label: "Pagina's" },
            { id: "locatie", label: "Locatie" },
            { id: "gedrag", label: "Klikken & aandacht" },
            { id: "techniek", label: "Toestel & snelheid" },
            { id: "live", label: "Live" },
          ]}
        />
      </Suspense>

      <div className="mt-4 space-y-4">
        <section id="overzicht" className="scroll-mt-44 space-y-4">
          <KernKpis n={k.nu} v={k.vorig} />
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Paneel titel={gekozen ? `Verloop ${gekozen.naam}` : gekozenLijst.length ? `Verloop ${gekozenLijst.map((x) => x.naam).join(" + ")}` : "Verloop alle sites samen"} uitleg={perMaand ? "Per maand." : "Per dag."}>
                <KernReeks data={reeksKern(sites, b, perMaand)} />
              </Paneel>
            </div>
            <Paneel titel="Wanneer komen ze?" uitleg="Sessies per weekdag en uur.">
              <UurRaster cellen={uurRaster(sites, b)} />
            </Paneel>
          </div>
        </section>

        {!gekozen && (
          <section id="vergelijking" className="scroll-mt-44 space-y-4">
            <Paneel titel="Bezoekers per site" uitleg="Unieke bezoekers per dag. Klik op een site bovenaan voor alle details van die site.">
              <VergelijkingPerSite data={reeksPerSite(sites, b, perMaand)} sites={kleurSites.filter((s) => sites.includes(s.sleutel))} />
            </Paneel>
            <Paneel titel="Sites naast elkaar">
              <Tabel
                koppen={["Site", "Bezoekers", "Verschil", "Sessies", "Weergaven", "Pag./sessie", "Actieve tijd", "Betrokken", "Scroll", "Contactacties", "Mobiel", "België", "Grootste kanaal"]}
                rechts={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]}
                rijen={[...vergelijking].sort((a, c) => c.bezoekers - a.bezoekers).map((r) => [
                  <Link key="s" href={href(sp, { site: r.site })} className="hover:underline"><SiteLabel sleutel={r.site} sites={kleurSites} /></Link>,
                  num(r.bezoekers),
                  <span key="v" className="text-zinc-500">{r.vorigBezoekers ? `${r.bezoekers >= r.vorigBezoekers ? "+" : "−"}${Math.abs(Math.round(((r.bezoekers - r.vorigBezoekers) / r.vorigBezoekers) * 100))}%` : "–"}</span>,
                  num(r.sessies), num(r.weergaven), r.paginasPerSessie.toFixed(1).replace(".", ","), duur(r.gemDuurS),
                  pct(r.betrokkenPct), `${r.gemScroll}%`, num(r.conversies), pct(r.mobielPct), pct(r.bePct), r.topKanaal || "–",
                ])}
              />
            </Paneel>
            <Paneel titel="Herkomst per site" uitleg="Aandeel van de sessies per kanaal. Zo zie je welke site op Google leunt en welke op advertenties of direct verkeer.">
              <div className="space-y-3">
                {sites.map((s) => {
                  const rijen = kps.filter((r) => r.site === s);
                  const tot = rijen.reduce((a, r) => a + r.n, 0);
                  if (!tot) return null;
                  const groep = new Map<string, number>();
                  for (const r of rijen) {
                    const naam = KANAAL_KLEUR.some(([n]) => n === r.kanaal) ? r.kanaal : "Overig";
                    groep.set(naam, (groep.get(naam) || 0) + r.n);
                  }
                  const volgorde = [...KANAAL_KLEUR.map(([n]) => n), "Overig"].filter((n) => groep.has(n));
                  return (
                    <div key={s} className="grid items-center gap-3" style={{ gridTemplateColumns: "170px 1fr 60px" }}>
                      <span className="truncate text-[13px]"><SiteLabel sleutel={s} sites={kleurSites} /></span>
                      <div className="flex h-5 gap-[2px] overflow-hidden rounded-[4px]">
                        {volgorde.map((n) => (
                          <div key={n} title={`${n}: ${num(groep.get(n)!)} sessies (${Math.round((groep.get(n)! / tot) * 100)}%)`}
                            style={{ width: `${(groep.get(n)! / tot) * 100}%`, background: kanaalKleur(n) }} />
                        ))}
                      </div>
                      <span className="text-right text-[12px] tabular-nums text-zinc-500">{num(tot)}</span>
                    </div>
                  );
                })}
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-[11.5px] text-zinc-600">
                  {[...KANAAL_KLEUR, ["Overig", "#b5b0a8"]].map(([n, c]) => (
                    <span key={n} className="inline-flex items-center gap-1.5"><i style={{ width: 10, height: 10, borderRadius: 3, background: c, display: "inline-block" }} />{n}</span>
                  ))}
                </div>
              </div>
            </Paneel>
          </section>
        )}

        <section id="herkomst" className="scroll-mt-44 grid gap-4 lg:grid-cols-2">
          <Paneel titel="Kanalen" uitleg="Hoe bezoekers binnenkwamen. Google Ads herkennen we aan de advertentieklik, niet aan een gok.">
            <Tabel
              koppen={["Kanaal", "Sessies", "Aandeel", "Betrokken", "Actieve tijd", "Met contactactie"]}
              rechts={[1, 2, 3, 4, 5]}
              rijen={kanaalRijen.map((r) => [
                <span key="k" className="inline-flex items-center gap-1.5"><i style={{ width: 8, height: 8, borderRadius: 9, background: kanaalKleur(r.kanaal), display: "inline-block" }} />{r.kanaal}</span>,
                num(r.sessies), pct(r.sessies / totaalSessies), pct(r.sessies ? r.betrokken / r.sessies : 0), duur(r.gemDuurS),
                r.conversies ? `${num(r.conversies)} (${pct(r.conversies / r.sessies)})` : "–",
              ])}
            />
          </Paneel>
          <Paneel titel="Bronnen en campagnes" uitleg="Welke zoekmachine, site of campagne precies. Direct verkeer staat hier niet bij.">
            <Staven rijen={bronRijen.map((r) => ({
              label: <>{r.bron}{r.campagne ? <span className="text-zinc-400"> · {r.campagne}</span> : null}<span className="ml-1.5 text-[11px] text-zinc-400">{r.kanaal}</span></>,
              waarde: r.sessies, kleur: kanaalKleur(r.kanaal), sub: r.conversies ? `· ${r.conversies} contact` : undefined,
            }))} eenheid="sessies" />
          </Paneel>
        </section>

        <section id="paginas" className="scroll-mt-44 space-y-4">
          <Paneel titel="Instappagina's" uitleg="De eerste pagina van een bezoek: waar mensen binnenkomen. Bounce = binnen 10 seconden weg zonder verder te klikken.">
            <Tabel
              koppen={[...(!gekozen ? ["Site"] : []), "Pagina", "Sessies", "Bounce", "Actieve tijd", "Pag./sessie", "Met contactactie"]}
              rechts={!gekozen ? [2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]}
              max={8}
              rijen={instap.map((r) => [
                ...(!gekozen ? [<SiteLabel key="s" sleutel={r.site} sites={kleurSites} />] : []),
                <code key="p" className="text-[12px]">{r.pad}</code>, num(r.sessies), pct(r.bounce), duur(r.gemDuurS),
                r.paginas.toFixed(1).replace(".", ","), r.conversies ? num(r.conversies) : "–",
              ])}
            />
          </Paneel>
          <Paneel titel="Meest bekeken pagina's" uitleg="Actieve tijd telt alleen wanneer het tabblad echt in beeld is. Scroll = gemiddeld hoe ver de pagina gelezen werd.">
            <Tabel
              koppen={[...(!gekozen ? ["Site"] : []), "Pagina", "Weergaven", "Sessies", "Actieve tijd", "Scroll", "Klikken"]}
              rechts={!gekozen ? [2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]}
              max={10}
              rijen={paginaRijen.map((r) => [
                ...(!gekozen ? [<SiteLabel key="s" sleutel={r.site} sites={kleurSites} />] : []),
                <span key="p" className="block max-w-[420px]"><code className="text-[12px]">{r.pad}</code>{r.titel && <span className="block truncate text-[11.5px] text-zinc-400">{r.titel}</span>}</span>,
                num(r.weergaven), num(r.bezoekers), duur(r.gemActiefS || 0), `${r.gemScroll}%`, num(r.klikken),
              ])}
            />
          </Paneel>
          <div className="grid gap-4 lg:grid-cols-2">
            <Paneel titel="Looproutes" uitleg="De vaakst gevolgde stap van de ene pagina naar de volgende.">
              <Staven rijen={stappen.map((r) => ({
                label: <span className="text-[12.5px]"><code>{r.van}</code> <span className="text-zinc-400">→</span> <code>{r.naar}</code></span>,
                waarde: r.n, kleur: kleurSites.find((s) => s.sleutel === r.site)?.kleur, titel: kleurSites.find((s) => s.sleutel === r.site)?.naam,
              }))} />
            </Paneel>
            <Paneel titel="Uitstappagina's" uitleg="De laatste pagina voor iemand vertrok.">
              <Staven rijen={uitstap.map((r) => ({
                label: <code className="text-[12.5px]">{r.pad}</code>, waarde: r.n,
                kleur: kleurSites.find((s) => s.sleutel === r.site)?.kleur, titel: kleurSites.find((s) => s.sleutel === r.site)?.naam,
              }))} eenheid="keer" />
            </Paneel>
          </div>
        </section>

        <section id="locatie" className="scroll-mt-44 space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Paneel titel="Bezoekers in Vlaanderen en Brussel" uitleg="Per gemeente (Wallonië en het buitenland staan in de tabellen), op basis van het IP-adres. Land en provincie kloppen; de gemeente is een benadering, want sommige providers tonen hun knooppunt (vaak Brussel of Antwerpen).">
                <KaartBelgie punten={stadRijen.filter((r) => r.land === "BE")} />
              </Paneel>
            </div>
            <Paneel titel="Landen">
              <Staven rijen={landRijen.map((r) => ({ label: landNaam(r.land), waarde: r.sessies, sub: pct(r.sessies / totaalSessies) }))} eenheid="sessies" />
            </Paneel>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Paneel titel="Regio en provincie">
              <Tabel
                koppen={["Land", "Regio", "Provincie", "Sessies", "Aandeel"]}
                rechts={[3, 4]}
                max={10}
                rijen={regioRijen.map((r) => [landNaam(r.land), r.regio || "–", r.provincie || "–", num(r.sessies), pct(r.sessies / totaalSessies)])}
              />
            </Paneel>
            <Paneel titel="Gemeenten">
              <Tabel
                koppen={["Gemeente", "Provincie / land", "Sessies", "Met contactactie"]}
                rechts={[2, 3]}
                max={10}
                rijen={stadRijen.slice(0, 50).map((r) => [r.stad, r.land === "BE" ? r.provincie || "België" : landNaam(r.land), num(r.sessies), r.conversies ? num(r.conversies) : "–"])}
              />
            </Paneel>
          </div>
        </section>

        <section id="gedrag" className="scroll-mt-44 space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Paneel titel="Soort klikken" uitleg="Telefoon, mail, WhatsApp en formulier tellen als contactactie.">
              <Staven rijen={soorten.map((r) => ({
                label: KLIKSOORT[r.soort] || r.soort, waarde: r.n,
                kleur: ["tel", "mail", "whatsapp", "formulier"].includes(r.soort) ? "#eb6834" : "#3987e5",
              }))} />
            </Paneel>
            <Paneel titel="Scrolldiepte" uitleg="Aandeel paginaweergaven dat minstens zo ver kwam.">
              <Staven rijen={scroll.stappen.map((s) => ({ label: s.p === 100 ? "Tot onderaan" : `${s.p}% van de pagina`, waarde: Math.round(s.aandeel * 100) }))} eenheid="%" />
              <p className="mt-3 text-[11.5px] text-zinc-400">Op {num(scroll.n)} paginaweergaven.</p>
            </Paneel>
            <Paneel titel="Meest aangeklikt">
              <Staven rijen={klikRijen.slice(0, 12).map((r) => ({
                label: <>{r.tekst || r.doel || "(zonder tekst)"}<span className="ml-1.5 text-[11px] text-zinc-400">{KLIKSOORT[r.soort] || r.soort}{!gekozen ? ` · ${kleurSites.find((s) => s.sleutel === r.site)?.naam}` : ""}</span></>,
                waarde: r.n, titel: r.doel || undefined,
                kleur: ["tel", "mail", "whatsapp", "formulier"].includes(r.soort) ? "#eb6834" : "#3987e5",
              }))} />
            </Paneel>
          </div>

          <Paneel titel="Klikkaart en aandacht per pagina" uitleg="Waar op de pagina geklikt wordt (rood; oranje = contactactie), welke blokken het langst in beeld staan, en rechts hoeveel bezoekers tot die hoogte scrollden. Beweeg over een punt of blok voor details.">
            {!gekozen ? (
              <Leeg tekst="Kies bovenaan één site om de klikkaart per pagina te zien." />
            ) : !pagina || !kaart ? (
              <Leeg />
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <ParamKeuze naam="pagina" label="Pagina" waarde={pagina} opties={keuze.map((p) => ({ waarde: p.pad, label: `${p.pad} (${p.n})` }))} />
                  <ParamKeuze naam="apparaat" label="Scherm" waarde={apparaat} opties={[{ waarde: "desktop", label: "Computer" }, { waarde: "mobiel", label: "Gsm / tablet" }]} />
                  <span className="text-[12px] text-zinc-400">{num(kaart.maat.n)} weergaven · {num(kaart.klikken.length)} klikken met positie</span>
                </div>
                {kaart.maat.n === 0 ? (
                  <Leeg tekst="Geen weergaven op dit schermtype." />
                ) : (
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,430px)_1fr]">
                    <Klikkaart klikken={kaart.klikken} secties={kaart.aandacht.rijen} totaal={kaart.aandacht.totaal} maat={kaart.maat} />
                    <div className="space-y-5">
                      <div>
                        <h3 className="mb-2 text-[13px] font-medium text-zinc-700">Aandacht per blok</h3>
                        <Tabel
                          koppen={["Blok", "Gezien door", "Gem. in beeld"]}
                          rechts={[1, 2]}
                          rijen={kaart.aandacht.rijen.map((s) => [s.naam, pct(kaart.aandacht.totaal ? s.gezien / kaart.aandacht.totaal : 0), duur(Math.round((s.gemMs || 0) / 1000))])}
                        />
                      </div>
                      <div>
                        <h3 className="mb-2 text-[13px] font-medium text-zinc-700">Klikken op deze pagina</h3>
                        <Staven rijen={kaart.klikLijst.slice(0, 12).map((r) => ({
                          label: <>{r.tekst || r.doel || "(zonder tekst)"}<span className="ml-1.5 text-[11px] text-zinc-400">{KLIKSOORT[r.soort] || r.soort}</span></>,
                          waarde: r.n, titel: r.doel || undefined,
                          kleur: ["tel", "mail", "whatsapp", "formulier"].includes(r.soort) ? "#eb6834" : "#3987e5",
                        }))} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Paneel>
        </section>

        <section id="techniek" className="scroll-mt-44 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Paneel titel="Toestel">
              <Staven rijen={tech.apparaat.map((r) => ({ label: r.waarde === "mobiel" ? "Gsm" : r.waarde === "tablet" ? "Tablet" : "Computer", waarde: r.n, sub: pct(r.n / totaalSessies) }))} />
            </Paneel>
            <Paneel titel="Browser">
              <Staven rijen={tech.browser.map((r) => ({ label: r.waarde || "Onbekend", waarde: r.n, sub: pct(r.n / totaalSessies) }))} />
            </Paneel>
            <Paneel titel="Besturingssysteem">
              <Staven rijen={tech.os.map((r) => ({ label: r.waarde || "Onbekend", waarde: r.n, sub: pct(r.n / totaalSessies) }))} />
            </Paneel>
            <Paneel titel="Taal van de browser">
              <Staven rijen={tech.taal.map((r) => ({ label: r.waarde ? new Intl.DisplayNames(["nl"], { type: "language" }).of(r.waarde) || r.waarde : "Onbekend", waarde: r.n, sub: pct(r.n / totaalSessies) }))} />
            </Paneel>
          </div>
          <Paneel titel="Laadsnelheid" uitleg="Gemeten bij echte bezoekers (75e percentiel, zoals Google het beoordeelt). Groen = goed volgens Google.">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                { l: "Grootste element (LCP)", v: snel.lcp, goed: 2500, fmt: (x: number) => `${(x / 1000).toFixed(1).replace(".", ",")} s` },
                { l: "Reactie op klik (INP)", v: snel.inp, goed: 200, fmt: (x: number) => `${x} ms` },
                { l: "Verspringen (CLS)", v: snel.cls, goed: 0.1, fmt: (x: number) => x.toFixed(2).replace(".", ",") },
                { l: "Eerste byte (TTFB)", v: snel.ttfb, goed: 800, fmt: (x: number) => `${x} ms` },
                { l: "Volledig geladen", v: snel.laad, goed: 3000, fmt: (x: number) => `${(x / 1000).toFixed(1).replace(".", ",")} s` },
              ].map((m) => (
                <div key={m.l} className="rounded-2xl border border-black/5 bg-white/60 p-3">
                  <span className="label">{m.l}</span>
                  <div className="mt-1 text-[22px] font-medium tabular-nums">{m.v == null ? "–" : m.fmt(m.v)}</div>
                  {m.v != null && (
                    <span className={"chip mt-1 " + (m.v <= m.goed ? "goed" : "let")}>{m.v <= m.goed ? "✓ goed" : "! kan beter"}</span>
                  )}
                </div>
              ))}
            </div>
            {snel.traagste.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-[13px] font-medium text-zinc-700">Traagste pagina's</h3>
                <Tabel
                  koppen={[...(!gekozen ? ["Site"] : []), "Pagina", "Metingen", "Gem. LCP", "Gem. volledig geladen"]}
                  rechts={!gekozen ? [2, 3, 4] : [1, 2, 3]}
                  rijen={snel.traagste.map((r) => [
                    ...(!gekozen ? [<SiteLabel key="s" sleutel={r.site} sites={kleurSites} />] : []),
                    <code key="p" className="text-[12px]">{r.pad}</code>, num(r.n),
                    r.lcp ? `${(r.lcp / 1000).toFixed(1).replace(".", ",")} s` : "–", r.laad ? `${(r.laad / 1000).toFixed(1).replace(".", ",")} s` : "–",
                  ])}
                />
              </div>
            )}
          </Paneel>
        </section>

        <section id="live" className="scroll-mt-44">
          <Paneel titel={`Live · ${online} ${online === 1 ? "bezoeker" : "bezoekers"} actief in de laatste 5 minuten`} uitleg="De 25 meest recente paginaweergaven. Ververs de pagina voor de nieuwste stand.">
            <Tabel
              koppen={["Tijd", ...(!gekozen ? ["Site"] : []), "Pagina", "Waar", "Kanaal", "Toestel"]}
              max={10}
              rijen={live.map((r) => [
                new Date(r.ts).toLocaleTimeString("nl-BE", { timeZone: "Europe/Brussels", hour: "2-digit", minute: "2-digit" }) +
                  (Date.now() - r.ts > 86400000 ? ` · ${new Date(r.ts).toLocaleDateString("nl-BE", { timeZone: "Europe/Brussels", day: "numeric", month: "short" })}` : ""),
                ...(!gekozen ? [<SiteLabel key="s" sleutel={r.site} sites={kleurSites} />] : []),
                <code key="p" className="text-[12px]">{r.pad}</code>,
                [r.stad, r.land && r.land !== "BE" ? landNaam(r.land) : null].filter(Boolean).join(", ") || "–",
                r.kanaal || "–", r.apparaat === "mobiel" ? "Gsm" : r.apparaat === "tablet" ? "Tablet" : "Computer",
              ])}
            />
          </Paneel>
        </section>

        <p className="text-[11.5px] text-zinc-400">
          Eigen meting zonder cookies; IP-adressen worden niet bewaard. Bezoekers worden per kalendermaand herkend.
          IP-geolocatie door <a href="https://db-ip.com" className="underline" target="_blank">DB-IP.com</a> (CC BY 4.0){geo.datum ? `, databank van ${geo.datum}` : ""}.
          Eigen bezoeken uitsluiten: open een site één keer met <code>?meet=uit</code>.
        </p>
      </div>
    </main>
  );
}
