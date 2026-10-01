import { euro } from "@/lib/format";

// Historiek van het maanddoel: per voorbije maand van dit jaar een staafje met de
// behaalde omzet tegenover het doel. Groen = doel gehaald. Getal + procent staan erbij,
// zodat het niet enkel op kleur steunt.
export function MaandHistoriek({ doel, maanden }: { doel: number; maanden: { maand: string; omzet: number }[] }) {
  if (!maanden.length || doel <= 0) return null;
  return (
    <div>
      <div className="label" style={{ marginBottom: 6 }}>
        Eerdere maanden
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${maanden.length}, minmax(0, 1fr))` }}>
        {maanden.map((m) => {
          const pct = Math.round((m.omzet / doel) * 100);
          const gehaald = m.omzet >= doel;
          return (
            <div key={m.maand} title={`${m.maand}: ${euro(m.omzet)} van ${euro(doel)} (${pct}%)`} className="flex flex-col items-center gap-1">
              <div className="relative w-full overflow-hidden rounded" style={{ height: 34, background: "rgba(22,21,15,.07)" }}>
                <div
                  className="absolute bottom-0 left-0 right-0"
                  style={{ height: `${Math.min(100, pct)}%`, background: gehaald ? "var(--goed)" : "var(--accent)", opacity: 0.85 }}
                />
              </div>
              <span className="text-[10.5px] text-zinc-500">{m.maand}</span>
              <span className="text-[10.5px] tabular-nums" style={{ color: gehaald ? "var(--goed)" : "var(--inkt-zacht)" }}>
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
