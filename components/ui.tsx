import { euro } from "@/lib/format";

// Bouwstenen uit de gedeelde huisstijl (app/glas.css): .paneel, .kpi, .label,
// .groot, .delta, .notitie. Zelfde props als voorheen; alleen de opmaak is anders.

export function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="paneel kpi">
      <span className="label">{label}</span>
      <div className="groot" style={{ fontSize: 30 }}>{value}</div>
      {sub && <div className="delta">{sub}</div>}
    </div>
  );
}

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="paneel">
      <div className="kop">
        <h2 style={{ fontSize: 18 }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

export function Highlight({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "green" | "blue" | "amber";
}) {
  // Betekeniskleur: groen = goed, amber = let op; blauw was neutraal en wordt het accent.
  const tones = { green: "goed", blue: "accent", amber: "let" };
  return (
    <div className={"notitie " + tones[tone]} style={{ padding: "14px 16px" }}>
      <span className="label" style={{ color: "inherit", opacity: 0.75 }}>{label}</span>
      <div style={{ marginTop: 4, fontSize: 15, fontWeight: 500, lineHeight: 1.35, color: "var(--inkt)" }}>{value}</div>
      {sub && <div style={{ marginTop: 4, fontSize: 12, color: "var(--inkt-zacht)" }}>{sub}</div>}
    </div>
  );
}

export function CombineRow({
  label,
  won,
  open,
  bold,
}: {
  label: string;
  won: number;
  open: number;
  bold?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={"text-sm " + (bold ? "font-medium text-zinc-900" : "text-zinc-600")}>{label}</span>
      <span className="text-right tabular-nums">
        <span className={"block " + (bold ? "text-lg font-semibold text-emerald-700" : "font-medium text-zinc-800")}>
          {euro(won)}
        </span>
        <span className="block text-xs text-zinc-400">open: {euro(open)}</span>
      </span>
    </div>
  );
}
