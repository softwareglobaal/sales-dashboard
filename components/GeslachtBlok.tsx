import { num } from "@/lib/format";
import { Card } from "@/components/ui";
import type { GenderSplit } from "@/lib/gender";

// Geslacht van de contactpersoon per aanvraag, uit het persoonsveld "Geslacht" in Pipedrive.
// Man/Vrouw-aandeel is berekend op de aanvragen waar het veld is ingevuld.
export function GeslachtBlok({ data, periodLabel }: { data: GenderSplit; periodLabel: string }) {
  const { rows, totaal, ingevuld } = data;
  const vulgraad = totaal > 0 ? Math.round((ingevuld / totaal) * 100) : 0;
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

  return (
    <Card title="Geslacht (demografie)">
      <div className={"notitie mb-4 " + (vulgraad < 50 ? "let" : "goed")} style={{ padding: "10px 14px", fontSize: 13 }}>
        Geslacht ingevuld bij <b>{num(ingevuld)}</b> van {num(totaal)} aanvragen ({vulgraad}%) · {periodLabel}.
        {vulgraad < 50 && <> Vul het veld &ldquo;Geslacht&rdquo; in op de contactpersoon in Pipedrive; de cijfers worden betrouwbaarder naarmate meer contacten het hebben.</>}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {rows.map((r) => {
          const bekend = r.label !== "Onbekend";
          const aandeel = bekend ? pct(r.aanvragen, ingevuld) : pct(r.aanvragen, totaal);
          return (
            <div key={r.label} className="kaart">
              <div className="label">{r.label}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="kpi-groot">{num(r.aanvragen)}</span>
                <span className="text-[12px] text-[var(--inkt-vaag)]">
                  {aandeel}% {bekend ? "van de ingevulde" : "van alle aanvragen"}
                </span>
              </div>
              <div className="staaf mt-2">
                <i style={{ width: `${aandeel}%`, background: bekend ? "var(--accent)" : "var(--inkt-vaag)" }} />
              </div>
              <div className="mt-2 text-[12px] text-[var(--inkt-zacht)]">
                {num(r.gewonnen)} gewonnen{r.aanvragen > 0 && <> · conversie {pct(r.gewonnen, r.aanvragen)}%</>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-[var(--inkt-vaag)]">
        Per aanvraag in de periode (aanmaakdatum), geslacht van de gekoppelde contactpersoon. Gewonnen = aanvragen uit deze periode die
        intussen gewonnen zijn.
      </p>
    </Card>
  );
}
