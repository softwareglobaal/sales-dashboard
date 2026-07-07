import { euro } from "@/lib/format";

export function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-zinc-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold text-zinc-700">{title}</h3>
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
  const tones = {
    green: "border-green-200 bg-green-50",
    blue: "border-blue-200 bg-blue-50",
    amber: "border-amber-200 bg-amber-50",
  };
  return (
    <div className={"rounded-xl border p-4 " + tones[tone]}>
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-base font-bold leading-snug text-zinc-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-zinc-600">{sub}</div>}
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
      <span className={"text-sm " + (bold ? "font-semibold text-zinc-900" : "text-zinc-600")}>{label}</span>
      <span className="text-right">
        <span className={"block " + (bold ? "text-lg font-bold text-green-700" : "font-medium text-zinc-800")}>
          {euro(won)}
        </span>
        <span className="block text-xs text-zinc-400">open: {euro(open)}</span>
      </span>
    </div>
  );
}
