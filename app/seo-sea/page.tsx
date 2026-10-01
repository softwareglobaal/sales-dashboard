import Link from "next/link";
import { AFDELINGEN, afdeling, bereik, isDienstPeriode, maandOpties, type Afdeling } from "@/lib/afdelingen";
import { adsHasData, getAdsSyncInfo, adsAccountLabel } from "@/lib/adsQueries";
import { adsPerDienst, heeftCampagnes, type DienstAdsRij } from "@/lib/adsPerDienst";
import { adsConfigured, adsAccountsForPipedrive } from "@/lib/googleAdsConfig";
import { euro, num, pct } from "@/lib/format";
import { Kpi } from "@/components/ui";
import { SubNav } from "@/components/SubNav";
import { SyncFreshness } from "@/components/SyncFreshness";
import { MaandKeuze } from "@/components/dienst/MaandKeuze";
import { dienstHref } from "@/components/dienst/DienstKop";

export const dynamic = "force-dynamic";

// SEO / SEA (spec §17): wat kost Google Ads per campagne en per dienst? Wat
// kost één aanvraag? Kosten uit Google Ads; aanvragen uit de dienstlaag
// (lib/afdelingen.ts), via lib/adsPerDienst.ts. De periodes zijn die van de
// dienstpagina's: dit jaar, vorig jaar of één maand.

const PATH = "/seo-sea";
// De Pipedrive-account waarvan de leads bij deze pagina horen. Daar hangen
// meerdere Google Ads-accounts onder (config/ads.json): UNABO en, sinds
// 23 september 2026, UNABO Regularisatie.
const PIPEDRIVE = "unabo";

const CHANNEL_LABELS: Record<string, string> = {
  SEARCH: "Zoeken",
  PERFORMANCE_MAX: "Performance Max",
  DISPLAY: "Display",
  VIDEO: "Video",
  SHOPPING: "Shopping",
  MULTI_CHANNEL: "Multi-channel",
  DEMAND_GEN: "Demand Gen",
  LOCAL: "Lokaal",
};
const channelLabel = (c: string) => CHANNEL_LABELS[c] || c.replaceAll("_", " ").toLowerCase();
const adsLabel = (syncKey: string) => adsAccountLabel(syncKey.replace(/^ads:/, ""));
const datumNl = (d: string) => d.slice(0, 10).split("-").reverse().join("/");
const kortDatum = (d: string) => datumNl(d).slice(0, 5);
const euroOf = (n: number | null) => (n == null ? "—" : euro(n));
// Aandeel in het budget: een kleine dienst toont "<1%" in plaats van een misleidende 0%.
const aandeelTekst = (a: number) => (a > 0 && a < 0.01 ? "<1%" : pct(a));

type Zoek = { periode?: string; dienst?: string };

function href(sp: Zoek, wijzig: Partial<Zoek> = {}, anker = ""): string {
  const alles = { ...sp, ...wijzig };
  const p = new URLSearchParams();
  if (alles.periode && alles.periode !== "ytd") p.set("periode", alles.periode);
  if (alles.dienst) p.set("dienst", alles.dienst);
  const s = p.toString();
  return PATH + (s ? `?${s}` : "") + anker;
}

function Pil({ actief, naar, children }: { actief: boolean; naar: string; children: React.ReactNode }) {
  return (
    <Link href={naar} className={actief ? "chip donker" : "chip"} style={{ padding: "6px 13px", fontSize: 12.5 }} scroll={false}>
      {children}
    </Link>
  );
}

function StatusChip({ status }: { status: string }) {
  if (status === "ENABLED") return <span className="chip goed">Actief</span>;
  if (status === "PAUSED") return <span className="chip">Gepauzeerd</span>;
  if (status === "REMOVED") return <span className="chip">Verwijderd</span>;
  return <span className="chip">{status.toLowerCase()}</span>;
}

function DienstStatus({ r }: { r: DienstAdsRij }) {
  if (r.actief > 0) return <span className="chip goed">{r.actief} actief</span>;
  if (r.campagnes > 0) return <span className="chip">gepauzeerd</span>;
  return <span className="chip let">geen campagne</span>;
}

/** Eén cijfer in een dienstkaart. */
function Cijfer({ label, waarde, nadruk }: { label: string; waarde: string; nadruk?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-t border-black/5 py-1.5 text-[12.5px]">
      <span className="text-zinc-500">{label}</span>
      <span className={"tabular-nums " + (nadruk ? "font-semibold text-zinc-900" : "text-zinc-800")}>{waarde}</span>
    </div>
  );
}

export default async function SeoSeaPage({ searchParams }: { searchParams: Promise<{ period?: string; periode?: string; dienst?: string }> }) {
  const raw = await searchParams;
  // `period` is de oude parameter; dit jaar en vorig jaar blijven zo werken.
  const gevraagd = raw.periode ?? raw.period;
  const periode = isDienstPeriode(gevraagd) ? gevraagd : "ytd";
  const vanDienst: Afdeling | undefined = raw.dienst ? afdeling(raw.dienst) : undefined;
  const sp: Zoek = { periode, dienst: vanDienst?.pad };
  const b = bereik(periode);

  const accounts = adsAccountsForPipedrive(PIPEDRIVE);
  // Diensten met minstens één campagne: die krijgen een filterknop.
  const dienstPillen: Afdeling[] = AFDELINGEN.filter((a) => a.kanalen.ads.length && heeftCampagnes(a.kanalen.ads));
  const accountKeys = accounts.map((a) => a.key);
  const label = accounts.map((a) => a.label).join(" + ") || PIPEDRIVE;

  const Header = () => (
    <>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="h1-glas">SEO / SEA</h1>
          <p className="text-[12.5px] text-zinc-500">Google Ads ({label}) · kosten per campagne en per dienst</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Pil actief={periode === "ytd"} naar={href(sp, { periode: "ytd" })}>
          Dit jaar
        </Pil>
        <Pil actief={periode === "prev_year"} naar={href(sp, { periode: "prev_year" })}>
          Vorig jaar
        </Pil>
        <MaandKeuze opties={maandOpties()} huidig={periode} basis={href(sp, { periode: "" })} />
        {dienstPillen.length > 1 && (
          <>
            <span className="mx-1 hidden h-5 w-px bg-black/10 sm:inline-block" aria-hidden="true" />
            <Pil actief={!vanDienst} naar={href(sp, { dienst: "" })}>
              Alle diensten
            </Pil>
            {dienstPillen.map((d) => (
              <Pil key={d.pad} actief={vanDienst?.pad === d.pad} naar={href(sp, { dienst: d.pad })}>
                {d.naam}
              </Pil>
            ))}
          </>
        )}
      </div>
    </>
  );

  // Doorklik vanaf een dienst (spec §17): de hele pagina filtert op die dienst.
  const DienstBanner = () =>
    vanDienst ? (
      <div className="notitie mt-3 flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
        <span>
          Enkel de campagnes voor <b className="font-medium">{vanDienst.naam}</b>
        </span>
        <span className="flex flex-wrap gap-3">
          <Link href={`/${vanDienst.pad}/kanalen`} className="font-medium underline">
            ← terug naar {vanDienst.naam}
          </Link>
          <Link href={href(sp, { dienst: "" })} className="font-medium underline">
            Alle diensten
          </Link>
        </span>
      </div>
    ) : null;

  // 1) Niet geconfigureerd (geen credentials) of 2) nog geen data gesynct
  if (!adsConfigured() || !adsHasData(accountKeys)) {
    const err = adsConfigured() ? getAdsSyncInfo().find((s) => s.status === "error" && accountKeys.includes(s.account_key.replace(/^ads:/, ""))) : undefined;
    return (
      <main className="mx-auto max-w-7xl px-6 pb-10">
        <div className="kopbalk pb-4">
          <Header />
          <DienstBanner />
        </div>
        <div className="paneel">
          <div className="leeg">
            {adsConfigured() ? (
              <>
                <h2>Nog geen Google Ads-data</h2>
                <p className="lede mt-2">Klik op &ldquo;Data verversen&rdquo; (zijbalk) om de campagnes van {label} op te halen.</p>
                {err && <p className="mt-3 text-xs text-red-600">Laatste fout: {err.message}</p>}
              </>
            ) : (
              <>
                <h2>Google Ads nog niet gekoppeld</h2>
                <p className="lede mt-2">
                  Zet de <code>GOOGLE_ADS_*</code>-variabelen in <code>.env.local</code> (of op de VM) en klik daarna op &ldquo;Data verversen&rdquo;.
                </p>
              </>
            )}
          </div>
        </div>
      </main>
    );
  }

  const syncInfo = getAdsSyncInfo().filter((s) => accountKeys.includes(s.account_key.replace(/^ads:/, "")));
  const errs = syncInfo.filter((s) => s.status === "error");

  const venster = { van: b.van, tot: b.tot };
  const alles = adsPerDienst(venster, accountKeys);
  const zicht = vanDienst ? adsPerDienst(venster, accountKeys, vanDienst) : alles;
  const t = zicht.totaal;
  const firmaTekst = zicht.firmaNamen.join(" + ") || "UNABO";

  const metKost = zicht.campagnes.filter((c) => c.spend > 0 || c.status === "ENABLED");
  const zonderKost = zicht.campagnes.filter((c) => !(c.spend > 0 || c.status === "ENABLED"));
  // De splitsing binnen één account: enkel waar dat account voor meer dan één dienst betaalt.
  const splitsingen = vanDienst ? [] : alles.accounts.filter((a) => a.diensten.length > 1);
  const laatsteSync = (key: string) => syncInfo.find((s) => s.account_key === `ads:${key}`)?.last_sync;

  return (
    <main className="mx-auto max-w-7xl px-6 pb-10">
      <div className="kopbalk">
        <Header />
        <DienstBanner />
        <SubNav
          items={[
            { id: "overzicht", label: "Overzicht" },
            { id: "campagnes", label: "Per campagne" },
            { id: "diensten", label: "Per dienst" },
          ]}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-[11.5px]">
        <SyncFreshness />
        {accounts.map((a) => {
          const ls = laatsteSync(a.key);
          return (
            <span
              key={a.key}
              className="chip goed"
              title={`Google Ads ${a.customerId.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")}${ls ? ` · laatste sync ${new Date(ls).toLocaleString("nl-BE", { timeZone: "Europe/Brussels" })}` : ""}`}
            >
              Account: <b className="font-medium">{a.label}</b>
            </span>
          );
        })}
        <span className="chip">
          Periode: <b className="font-medium">{b.label}</b>
        </span>
      </div>
      {errs.map((e) => (
        <div key={e.account_key} className="notitie let mb-4 text-[12.5px]">
          Let op: de laatste Google Ads-sync van {adsLabel(e.account_key)} gaf een fout ({e.message}). De getoonde cijfers kunnen verouderd zijn.
        </div>
      ))}

      {/* Kerncijfers */}
      <section id="overzicht" className="mb-6 grid scroll-mt-40 grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="paneel donker flex flex-col gap-2">
          <div className="label">Advertentie&shy;kosten</div>
          <div className="kpi-groot">{euro(t.kost)}</div>
          <div className="mt-auto text-[11.5px] opacity-60">
            {num(t.actief)} actieve · {num(t.campagnes)} campagnes
          </div>
        </div>
        <Kpi label="Klikken" value={num(t.klikken)} sub={`CTR ${pct(t.vertoningen ? t.klikken / t.vertoningen : 0)} · ${euroOf(t.klikken ? t.kost / t.klikken : null)} per klik`} />
        <Kpi label="Vertoningen" value={num(t.vertoningen)} sub="impressies in de periode" />
        <Kpi
          label="Conversies (Google)"
          value={num(Math.round(t.conversies))}
          sub={t.conversies > 0 ? `${euro(t.kost / t.conversies)} per conversie` : "geen conversies"}
        />
      </section>

      {/* Kosten per campagne */}
      <section id="campagnes" className="paneel mb-6 scroll-mt-40">
        <div className="kop">
          <h2>{vanDienst ? `Campagnes voor ${vanDienst.naam}` : "Kosten per campagne"}</h2>
          <small>
            {b.label} · gesorteerd op kost · {num(t.actief)} actief
          </small>
        </div>
        {metKost.length === 0 ? (
          <p className="text-[13px] text-zinc-500">
            {vanDienst ? "Er loopt geen campagne voor deze dienst." : "Geen campagnes met kosten in deze periode."}
          </p>
        ) : (
          <div className="tabelwrap">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Campagne</th>
                  <th>Dienst · account</th>
                  <th className="num">Kost</th>
                  <th className="num">Klikken</th>
                  <th className="num">Vertoningen</th>
                  <th className="num">Conversies</th>
                  <th className="num">Kost/klik</th>
                  <th className="num">Kost/conv.</th>
                  <th className="num">Kost/aanvraag</th>
                </tr>
              </thead>
              <tbody>
                {metKost.map((c) => (
                  <tr key={`${c.accountKey}:${c.campaignId}`}>
                    <td style={{ minWidth: 230 }}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{c.name}</span>
                        <StatusChip status={c.status} />
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-zinc-500">
                        {channelLabel(c.channelType)}
                        {c.eersteDag && c.eersteDag > b.van && <> · kosten sinds {kortDatum(c.eersteDag)}</>}
                        {c.finalUrl && (
                          <>
                            {" · "}
                            <a href={c.finalUrl} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap underline" title={c.finalUrl}>
                              {c.finalUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").slice(0, 30)} ↗
                            </a>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap">
                      {c.afdeling ? (
                        <Link href={href(sp, { dienst: c.afdeling.pad })} className="font-medium hover:underline">
                          {c.afdeling.naam}
                        </Link>
                      ) : (
                        <span className="chip let">geen dienst</span>
                      )}
                      <div className="text-[11.5px] text-zinc-500">{c.accountLabel}</div>
                    </td>
                    <td className="num font-medium">{euro(c.spend)}</td>
                    <td className="num">{num(c.clicks)}</td>
                    <td className="num">{num(c.impressions)}</td>
                    <td className="num">{num(Math.round(c.conversions))}</td>
                    <td className="num">{c.clicks ? euro(c.spend / c.clicks) : "—"}</td>
                    <td className="num">{euroOf(c.costPerConv)}</td>
                    <td className="num font-medium">{euroOf(c.kostPerAanvraag)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {zonderKost.length > 0 && (
          <details className="mt-3 text-[12.5px] text-zinc-600">
            <summary className="cursor-pointer">
              {num(zonderKost.length)} gepauzeerde campagne{zonderKost.length === 1 ? "" : "s"} zonder kosten in deze periode
            </summary>
            <ul className="mt-2 flex flex-col gap-1">
              {zonderKost.map((c) => (
                <li key={`${c.accountKey}:${c.campaignId}`}>
                  {c.name} · {c.accountLabel} · {c.afdeling?.naam || "geen dienst"} · {channelLabel(c.channelType)}
                </li>
              ))}
            </ul>
          </details>
        )}
        <p className="mt-3 text-[11.5px] text-zinc-500">
          Kost per aanvraag staat bij een campagne enkel als zij de enige met kosten voor haar dienst is. Pipedrive weet niet via welke
          advertentie een aanvraag binnenkwam; bij meer campagnes voor één dienst staat de kost per aanvraag onder &ldquo;Per dienst&rdquo;.
          Conversies zijn wat Google op de site telt, aanvragen zijn deals in Pipedrive.
        </p>
      </section>

      {/* Per dienst */}
      <section id="diensten" className="mb-6 scroll-mt-40">
        {splitsingen.map((acc) => (
          <div key={acc.key} className="paneel mb-4">
            <div className="kop">
              <h2>
                {acc.label}-account:{" "}
                {acc.diensten.length === 2 ? acc.diensten.map((d) => d.rij.naam).join(" tegenover ") : `verdeling over ${acc.diensten.length} diensten`}
              </h2>
              <small>
                {euro(acc.kost)} in {b.label.toLowerCase()} · één account, {num(acc.diensten.length)} diensten
              </small>
            </div>
            <div className={"grid grid-cols-1 gap-3 sm:grid-cols-2" + (acc.diensten.length > 2 ? " lg:grid-cols-3" : "")}>
              {acc.diensten.map(({ rij, kost, aandeel }) => (
                <div key={rij.naam} className="kaart">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="n">{rij.naam}</div>
                    <DienstStatus r={rij} />
                  </div>
                  <div className="kpi-groot mt-2">{euro(kost)}</div>
                  <div className="staaf mt-2">
                    <i style={{ width: `${Math.round(aandeel * 100)}%` }} />
                  </div>
                  <div className="s mt-1 mb-2">
                    {aandeelTekst(aandeel)} van het budget van {acc.label}
                  </div>
                  <Cijfer label={`Aanvragen ${firmaTekst}`} waarde={rij.aanvragen == null ? "—" : num(rij.aanvragen)} />
                  <Cijfer label="Kost per aanvraag" waarde={euroOf(rij.kostPerAanvraag)} nadruk />
                  <Cijfer label="Conversies (Google)" waarde={num(Math.round(rij.conversies))} />
                  <Cijfer label="Kost per conversie" waarde={euroOf(rij.kostPerConversie)} />
                  <Cijfer label="Klikken" waarde={`${num(rij.klikken)} · ${rij.klikken ? euro(rij.kost / rij.klikken) : "—"} per klik`} />
                  <div className="voet">
                    <Link href={href(sp, { dienst: rij.afdeling?.pad || "" })} className="font-medium underline">
                      Campagnes
                    </Link>
                    {rij.afdeling && (
                      <Link href={dienstHref("/" + rij.afdeling.pad, { periode, firma: alles.firmaSleutels.length === 1 ? alles.firmaSleutels[0] : undefined })} className="text-zinc-600 underline">
                        Dienstpagina
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="paneel">
          <div className="kop">
            <h2>Per dienst</h2>
            <small>
              {b.label} · aanvragen van {firmaTekst}, zoals op de dienstpagina
            </small>
          </div>
          {zicht.diensten.length === 0 ? (
            <p className="text-[13px] text-zinc-500">
              Voor {vanDienst?.naam || "deze dienst"} is geen advertentiedienst ingesteld in <code>config/afdelingen.json</code> (kanalen.ads).
            </p>
          ) : (
            <div className="tabelwrap">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Dienst</th>
                    <th>Campagnes nu</th>
                    <th className="num">Kost</th>
                    <th className="num">Aandeel</th>
                    <th className="num">Klikken</th>
                    <th className="num">Conversies</th>
                    <th className="num">Aanvragen</th>
                    <th className="num">Kost/aanvraag</th>
                    <th className="num">Kost/conv.</th>
                  </tr>
                </thead>
                <tbody>
                  {zicht.diensten.map((r) => (
                    <tr key={r.naam}>
                      <td>
                        {r.afdeling ? (
                          <Link href={href(sp, { dienst: r.afdeling.pad })} className="font-medium hover:underline">
                            {r.naam}
                          </Link>
                        ) : (
                          <span className="font-medium">{r.naam}</span>
                        )}
                        {r.accounts.length > 0 && <div className="text-[11.5px] text-zinc-500">{r.accounts.join(" + ")}</div>}
                      </td>
                      <td>
                        <DienstStatus r={r} />
                      </td>
                      <td className="num font-medium">{r.kost > 0 ? euro(r.kost) : "—"}</td>
                      <td className="num">{r.kost > 0 ? aandeelTekst(r.aandeel) : "—"}</td>
                      <td className="num">{num(r.klikken)}</td>
                      <td className="num">{num(Math.round(r.conversies))}</td>
                      <td className="num">
                        {r.aanvragen == null ? "—" : num(r.aanvragen)}
                        {r.aanvragen != null && r.aanvragenVanaf > b.van && (
                          <div className="text-[11px] text-zinc-500">sinds {kortDatum(r.aanvragenVanaf)}</div>
                        )}
                      </td>
                      <td className="num font-medium">{euroOf(r.kostPerAanvraag)}</td>
                      <td className="num">{euroOf(r.kostPerConversie)}</td>
                    </tr>
                  ))}
                  {zicht.diensten.length > 1 && (
                    <tr className="totaal">
                      <td>Totaal</td>
                      <td />
                      <td className="num">{euro(t.kost)}</td>
                      <td className="num">{t.kost > 0 ? "100%" : "—"}</td>
                      <td className="num">{num(t.klikken)}</td>
                      <td className="num">{num(Math.round(t.conversies))}</td>
                      <td className="num" />
                      <td className="num" />
                      <td className="num">{t.conversies > 0 ? euro(t.kost / t.conversies) : "—"}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-[11.5px] text-zinc-500">
            Een campagne hoort bij de dienst die haar advertentiedienst noemt in <code>config/afdelingen.json</code> (kanalen.ads). Aanvragen =
            de aanvragen van {firmaTekst} voor die dienst, met dezelfde telling als de dienstpagina met firmafilter {firmaTekst}. Start de
            eerste campagne pas tijdens de periode, dan tellen de aanvragen vanaf die dag. Kost per aanvraag = advertentiekost ÷ die
            aanvragen; ook aanvragen via andere kanalen tellen mee. Een bundeldeal telt bij elke dienst, daarom geen totaal van de
            aanvragen. Diensten met &ldquo;geen campagne&rdquo; zijn kandidaten voor een campagne.
          </p>
        </div>
      </section>

      <p className="mt-10 text-center text-xs text-zinc-400">
        Advertentiecijfers uit Google Ads ({label}) · aanvragen uit Pipedrive via de dienstlaag · bedragen incl. Google Ads-kost, excl. btw.
      </p>
    </main>
  );
}
