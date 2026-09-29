import { euro } from "@/lib/format";
import commissie from "@/config/commissie.json";

// Voortgang van de maandelijkse teambeloning (Joey & Shelton) voor één afdeling.
// Klikken op de balk klapt de regels open (<details>, dus geen client-JS nodig).

type Mijlpaal = { omzet: number; pot: number };
type Afdeling = {
  titel: string;
  omvat: string;
  vertrek: number;
  doel: number;
  breakeven?: number;
  mijlpalen: Mijlpaal[];
  extraRegels: string[];
};

const kort = (n: number) => `€ ${Math.round(n / 1000)}k`;

export function CommissieBalk({
  afdeling,
  omzet,
  maandLabel,
  dagenOver,
}: {
  afdeling: "engineering" | "energy";
  omzet: number;
  maandLabel: string;
  dagenOver: number | null; // null = afgesloten maand
}) {
  const cfg = commissie[afdeling] as Afdeling;
  const pct = (v: number) => Math.max(0, Math.min(100, (v / cfg.doel) * 100));
  const behaald = [...cfg.mijlpalen].reverse().find((m) => omzet >= m.omzet) || null;
  const volgende = cfg.mijlpalen.find((m) => omzet < m.omzet) || null;
  const pot = behaald?.pot || 0;

  return (
    <details id="teamdoel" className="paneel group mb-8 scroll-mt-40 cursor-pointer" style={{ padding: "18px 22px" }}>
      <summary className="list-none [&::-webkit-details-marker]:hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <div>
            <span className="label">
              {cfg.titel} · {maandLabel}
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="kpi-groot">{euro(omzet)}</span>
              <span className="text-[13px] text-[var(--inkt-vaag)]">van {euro(cfg.doel)}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="label">Teampot</span>
            <div className="mt-1 flex items-baseline justify-end gap-2">
              <span className="kpi-groot" style={{ color: pot > 0 ? "var(--goed)" : undefined }}>
                {euro(pot)}
              </span>
              <span className="text-[12px] text-[var(--inkt-vaag)]">
                {pot > 0 ? `${euro(pot / 2)} p.p.` : "nog geen mijlpaal"}
              </span>
            </div>
          </div>
        </div>

        {/* Balk met mijlpalen */}
        <div className="relative mt-4 mb-9">
          <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: "var(--vlak)" }}>
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{ width: `${pct(omzet)}%`, background: pot > 0 ? "var(--goed)" : "var(--accent)" }}
            />
          </div>
          {cfg.breakeven && (
            <div
              className="absolute -top-1.5 h-[22px] w-0 border-l-2 border-dashed"
              style={{ left: `${pct(cfg.breakeven)}%`, borderColor: "var(--inkt-zacht)" }}
              title={`Breakeven ${euro(cfg.breakeven)}`}
            />
          )}
          <div
            className="absolute -top-1 h-[18px] w-0 border-l border-dotted"
            style={{ left: `${pct(cfg.vertrek)}%`, borderColor: "var(--inkt-vaag)" }}
            title={`Vertrekpunt ${euro(cfg.vertrek)} per maand`}
          />
          {cfg.mijlpalen.map((m) => {
            const ok = omzet >= m.omzet;
            const laatste = m.omzet >= cfg.doel;
            return (
              <div
                key={m.omzet}
                className={"absolute top-3.5 flex flex-col text-[11px] leading-tight " + (laatste ? "items-end" : "items-center")}
                style={laatste ? { right: 0 } : { left: `${pct(m.omzet)}%`, transform: "translateX(-50%)" }}
              >
                <span className="h-1.5 w-px" style={{ background: "var(--inkt-vaag)" }} />
                <span style={{ color: ok ? "var(--goed)" : "var(--inkt-zacht)", fontWeight: ok ? 600 : 500 }}>
                  {kort(m.omzet)}
                </span>
                <span style={{ color: ok ? "var(--goed)" : "var(--inkt-vaag)" }}>{euro(m.pot)}</span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--inkt-zacht)]">
          <span>
            {volgende ? (
              <>
                Nog <b className="text-[var(--inkt)]">{euro(volgende.omzet - omzet)}</b> tot {kort(volgende.omzet)} (pot{" "}
                {euro(volgende.pot)})
              </>
            ) : (
              <b style={{ color: "var(--goed)" }}>Hoogste mijlpaal behaald</b>
            )}
            {dagenOver != null && <> · nog {dagenOver} {dagenOver === 1 ? "dag" : "dagen"} deze maand</>}
            {cfg.breakeven && <> · breakeven {euro(cfg.breakeven)} (streepjeslijn)</>}
          </span>
          <span className="chip">
            <span className="group-open:hidden">Regels tonen ▾</span>
            <span className="hidden group-open:inline">Regels verbergen ▴</span>
          </span>
        </div>
      </summary>

      {/* Regels */}
      <div className="mt-5 grid cursor-auto gap-5 border-t pt-5 text-[13px] md:grid-cols-2" style={{ borderColor: "var(--lijn)" }}>
        <div>
          <div className="label mb-2">Mijlpalen per maand</div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--inkt-vaag)]">
                <th className="py-1 font-medium">Omzet</th>
                <th className="py-1 text-right font-medium">Teampot</th>
                {commissie.verdeling.map((p) => (
                  <th key={p.naam} className="py-1 text-right font-medium">
                    {p.naam}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cfg.mijlpalen.map((m) => {
                const ok = behaald?.omzet === m.omzet;
                return (
                  <tr key={m.omzet} className="border-t" style={{ borderColor: "var(--lijn)", fontWeight: ok ? 600 : 400 }}>
                    <td className="py-1.5">{euro(m.omzet)}</td>
                    <td className="py-1.5 text-right">{euro(m.pot)}</td>
                    {commissie.verdeling.map((p) => (
                      <td key={p.naam} className="py-1.5 text-right">
                        {euro(m.pot * p.aandeel)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[12px] text-[var(--inkt-vaag)]">Telt mee: {cfg.omvat}.</p>
        </div>
        <div>
          <div className="label mb-2">Regels</div>
          <ul className="list-disc space-y-1.5 pl-4 text-[var(--inkt-zacht)]">
            {[...commissie.algemeneRegels, ...cfg.extraRegels].map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-[var(--inkt-vaag)]">{commissie.status}.</p>
        </div>
      </div>
    </details>
  );
}

// Welke maand de balk toont: de gekozen maand, anders de lopende maand.
export function commissieMaand(period: string): { maand: string; dagenOver: number | null } {
  const nu = new Date();
  const lopend = `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, "0")}`;
  const maand = /^\d{4}-\d{2}$/.test(period) ? period : lopend;
  if (maand !== lopend) return { maand, dagenOver: null };
  const laatsteDag = new Date(nu.getFullYear(), nu.getMonth() + 1, 0).getDate();
  return { maand, dagenOver: laatsteDag - nu.getDate() };
}
