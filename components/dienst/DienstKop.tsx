import Link from "next/link";
import { afdeling as afdelingVan, firmasVan, maandOpties, type Afdeling } from "@/lib/afdelingen";
import { MaandKeuze } from "./MaandKeuze";

// Kop van elke dienstpagina (spec §17): titel, wie verkoopt/uitvoert/factureert,
// de subtabs en de filters. Elke dienst ziet er zo hetzelfde uit; alleen de config
// verschilt. De filters blijven staan bij het wisselen van subtab.

export type DienstZoek = { periode?: string; firma?: string };
export type Tab = "overzicht" | "kanalen" | "concurrentie" | "analyse";

export function dienstHref(pad: string, sp: DienstZoek, wijzig: Partial<DienstZoek> = {}): string {
  const p = new URLSearchParams();
  const alles = { ...sp, ...wijzig };
  if (alles.periode && alles.periode !== "ytd") p.set("periode", alles.periode);
  if (alles.firma) p.set("firma", alles.firma);
  const s = p.toString();
  return s ? `${pad}?${s}` : pad;
}

function Pil({ actief, naar, children }: { actief: boolean; naar: string; children: React.ReactNode }) {
  return (
    <Link href={naar} className={actief ? "chip donker" : "chip"} style={{ padding: "6px 13px", fontSize: 12.5 }} scroll={false}>
      {children}
    </Link>
  );
}

export function DienstKop({
  a,
  tab,
  sp,
  filters = true,
  ondertitel,
}: {
  a: Afdeling;
  tab: Tab;
  sp: DienstZoek;
  filters?: boolean;
  ondertitel?: string;
}) {
  const basis = "/" + a.pad;
  const tabs: { key: Tab | string; label: string; href: string }[] = [
    { key: "overzicht", label: "Overzicht", href: dienstHref(basis, sp) },
    { key: "kanalen", label: "Kanalen", href: dienstHref(basis + "/kanalen", sp) },
    { key: "concurrentie", label: "Concurrentie", href: a.concurrentie || basis + "/concurrentie" },
  ];
  tabs.push({ key: "analyse", label: "Analyse", href: dienstHref(basis + "/analyse", sp) });
  for (const e of a.extra || []) tabs.push({ key: e.href, label: e.label, href: e.href });

  const firmas = firmasVan(a);
  const periode = sp.periode || "ytd";
  const pagina = tab === "overzicht" ? basis : `${basis}/${tab}`;

  return (
    <div className="kopbalk">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="h1-glas">{a.naam}</h1>
          <p className="text-[12.5px] text-zinc-500">
            {ondertitel || (
              <>
                Verkoop <b className="font-medium text-zinc-700">{a.wie.verkoop}</b> · Uitvoering{" "}
                <b className="font-medium text-zinc-700">{a.wie.uitvoering}</b> · Factuur{" "}
                <b className="font-medium text-zinc-700">{a.wie.factuur}</b>
              </>
            )}
          </p>
        </div>
        <nav className="subtabs" style={{ marginBottom: 0, maxWidth: "100%", overflowX: "auto" }} aria-label="Onderdelen">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className={t.key === tab ? "actief" : ""}
              style={{
                whiteSpace: "nowrap",
                padding: "7px 16px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 500,
                background: t.key === tab ? "var(--donker)" : undefined,
                color: t.key === tab ? "var(--donker-tekst)" : "var(--inkt-zacht)",
              }}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      {filters && (
        <div className="flex flex-wrap items-center gap-2">
          <Pil actief={periode === "ytd"} naar={dienstHref(pagina, sp, { periode: "ytd" })}>
            Dit jaar
          </Pil>
          <Pil actief={periode === "prev_year"} naar={dienstHref(pagina, sp, { periode: "prev_year" })}>
            Vorig jaar
          </Pil>
          <MaandKeuze opties={maandOpties()} huidig={periode} basis={dienstHref(pagina, sp, { periode: "" })} />
          {firmas.length > 1 && (
            <>
              <span className="mx-1 h-5 w-px bg-black/10" aria-hidden="true" />
              <Pil actief={!sp.firma} naar={dienstHref(pagina, sp, { firma: "" })}>
                Alle firma&apos;s
              </Pil>
              {firmas.map((f) => (
                <Pil key={f.sleutel} actief={sp.firma === f.sleutel} naar={dienstHref(pagina, sp, { firma: f.sleutel })}>
                  {f.naam}
                </Pil>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Enkel de subtabs, voor de oudere pagina's met een eigen kop (Concurrentie,
 * Analyse, Verslaggevers). Zo wissel je overal op dezelfde manier van onderdeel.
 */
export function DienstTabs({ pad, tab }: { pad: string; tab: Tab | string }) {
  const a = afdelingVan(pad);
  if (!a) return null;
  const basis = "/" + a.pad;
  const tabs: { key: string; label: string; href: string }[] = [
    { key: "overzicht", label: "Overzicht", href: basis },
    { key: "kanalen", label: "Kanalen", href: basis + "/kanalen" },
    { key: "concurrentie", label: "Concurrentie", href: a.concurrentie || basis + "/concurrentie" },
  ];
  tabs.push({ key: "analyse", label: "Analyse", href: basis + "/analyse" });
  for (const e of a.extra || []) tabs.push({ key: e.href, label: e.label, href: e.href });
  return (
    <nav className="flex flex-wrap items-center gap-1 pt-4 text-[12.5px]" aria-label={`Onderdelen van ${a.naam}`}>
      <span className="mr-2 font-medium text-zinc-700">{a.naam}</span>
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={t.key === tab ? "chip donker" : "chip"}
          style={{ padding: "5px 12px" }}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
