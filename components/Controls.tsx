"use client";

import { useRouter } from "next/navigation";

type Params = Record<string, string | undefined>;
type Option = { key: string; label: string };

function href(path: string, params: Params, overrides: Params): string {
  const merged = { ...params, ...overrides };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, String(v));
  const s = sp.toString();
  return s ? `${path}?${s}` : path;
}

// ---- gedeelde, sleek segmented-control stijl ----
const SEG_WRAP = "inline-flex items-center gap-0.5 rounded-xl bg-zinc-100/80 p-1 ring-1 ring-black/[0.04]";
const SEG_BASE = "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-150";
const SEG_INACTIVE = "text-zinc-500 hover:text-zinc-900";
const segActive = (accent: "blue" | "emerald" | "zinc" = "blue") =>
  "bg-white shadow-sm ring-1 " +
  (accent === "emerald"
    ? "text-emerald-700 ring-emerald-600/15"
    : accent === "zinc"
      ? "text-zinc-900 ring-black/[0.06]"
      : "text-zinc-900 ring-black/[0.06]");

// ---- sleek native-select shell met eigen chevron ----
function SelectShell({
  value,
  onChange,
  children,
  active,
  accent = "blue",
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  active: boolean;
  accent?: "blue" | "violet";
}) {
  const activeCls =
    accent === "violet" ? "border-violet-300 bg-violet-50/70 text-violet-700" : "border-blue-300 bg-blue-50/70 text-blue-700";
  return (
    <div className="relative inline-flex">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={
          "h-[36px] cursor-pointer appearance-none rounded-xl border pl-3.5 pr-8 text-[13px] font-medium transition-colors " +
          "focus:outline-none focus:ring-2 focus:ring-blue-500/20 " +
          (active ? activeCls : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300")
        }
      >
        {children}
      </select>
      <span
        className={
          "pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] " +
          (active ? (accent === "violet" ? "text-violet-500" : "text-blue-500") : "text-zinc-400")
        }
      >
        ▼
      </span>
    </div>
  );
}

// Periode-knoppen
export function PeriodSelector({
  options,
  current,
  params,
  path = "/",
}: {
  options: Option[];
  current: string;
  params: Params;
  path?: string;
}) {
  const router = useRouter();
  return (
    <div className={SEG_WRAP}>
      {options.map((o) => {
        const active = o.key === current;
        return (
          <button
            key={o.key}
            onClick={() => router.push(href(path, params, { period: o.key }))}
            className={SEG_BASE + " " + (active ? segActive("blue") : SEG_INACTIVE)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Maand-keuzelijst (2026)
export function MonthSelector({
  options,
  current,
  params,
  path = "/",
}: {
  options: Option[];
  current: string;
  params: Params;
  path?: string;
}) {
  const router = useRouter();
  const isMonth = /^2026-\d{2}$/.test(current);
  return (
    <SelectShell
      value={isMonth ? current : ""}
      active={isMonth}
      onChange={(v) => v && router.push(href(path, params, { period: v }))}
    >
      <option value="">Maand 2026…</option>
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </SelectShell>
  );
}

// Week-keuzelijst (2026)
export function WeekSelector({
  options,
  current,
  params,
  path = "/",
}: {
  options: Option[];
  current: string;
  params: Params;
  path?: string;
}) {
  const router = useRouter();
  const isWeek = /^wk:\d{4}-\d{2}-\d{2}$/.test(current);
  return (
    <SelectShell
      value={isWeek ? current : ""}
      active={isWeek}
      onChange={(v) => v && router.push(href(path, params, { period: v }))}
    >
      <option value="">Week 2026…</option>
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </SelectShell>
  );
}

// Maand/Week-schakelaar
export function GranularitySelector({
  current,
  params,
  path = "/",
}: {
  current: string;
  params: Params;
  path?: string;
}) {
  const router = useRouter();
  const opts = [
    { key: "month", label: "Per maand" },
    { key: "week", label: "Per week" },
  ];
  return (
    <div className={SEG_WRAP}>
      {opts.map((o) => {
        const active = o.key === current;
        return (
          <button
            key={o.key}
            onClick={() => router.push(href(path, params, { g: o.key }))}
            className={SEG_BASE + " " + (active ? segActive("zinc") : SEG_INACTIVE)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Firma-scope binnen Engineering (Alles / UNABO Eng / TKN-Buro)
export function ScopeSelector({
  current,
  params,
  path = "/engineering",
}: {
  current: string; // "" | "unabo" | "tkn"  ("" = alles)
  params: Params;
  path?: string;
}) {
  const router = useRouter();
  const opts = [
    { key: "", label: "Alles" },
    { key: "unabo", label: "UNABO Eng" },
    { key: "tkn", label: "TKN-Buro" },
  ];
  const cur = current === "unabo" || current === "tkn" ? current : "";
  return (
    <div className={SEG_WRAP}>
      {opts.map((o) => {
        const active = o.key === cur;
        return (
          <button
            key={o.key || "all"}
            onClick={() => router.push(href(path, params, { sc: o.key || undefined }))}
            className={SEG_BASE + " " + (active ? segActive("emerald") : SEG_INACTIVE)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Firma-keuze voor de globale kaart (Alle firma's / per account) — param "acc"
export function FirmaSelector({
  options,
  current,
  params,
  path = "/kaart",
}: {
  options: Option[]; // key "" = alle
  current: string;
  params: Params;
  path?: string;
}) {
  const router = useRouter();
  return (
    <div className={SEG_WRAP}>
      {options.map((o) => {
        const active = o.key === current || (o.key === "" && !current);
        return (
          <button
            key={o.key || "all"}
            onClick={() => router.push(href(path, params, { acc: o.key || undefined }))}
            className={SEG_BASE + " " + (active ? segActive("zinc") : SEG_INACTIVE)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Status-schakelaar voor de regio-kaart (Projecten / Aanvragen / Verloren / Alles)
export function RegionStatusSelector({
  current,
  params,
  path = "/engineering",
}: {
  current: string; // "won" | "open" | "lost" | "all"
  params: Params;
  path?: string;
}) {
  const router = useRouter();
  const opts = [
    { key: "won", label: "Projecten", txt: "text-emerald-700", dot: "bg-emerald-500" },
    { key: "open", label: "Aanvragen", txt: "text-orange-700", dot: "bg-orange-500" },
    { key: "lost", label: "Verloren", txt: "text-red-700", dot: "bg-red-500" },
    { key: "all", label: "Alles", txt: "text-blue-700", dot: "bg-blue-500" },
  ];
  const cur = ["won", "open", "lost", "all"].includes(current) ? current : "won";
  return (
    <div className={SEG_WRAP}>
      {opts.map((o) => {
        const active = o.key === cur;
        return (
          <button
            key={o.key}
            onClick={() => router.push(href(path, params, { rs: o.key }))}
            className={
              SEG_BASE + " inline-flex items-center gap-1.5 " + (active ? "bg-white shadow-sm ring-1 ring-black/[0.06] " + o.txt : SEG_INACTIVE)
            }
          >
            <span className={"h-1.5 w-1.5 rounded-full " + o.dot} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Thema-keuzelijst
export function ThemeSelector({
  options,
  current,
  params,
  path = "/",
}: {
  options: Option[];
  current: string;
  params: Params;
  path?: string;
}) {
  const router = useRouter();
  return (
    <SelectShell
      value={current || ""}
      active={!!current}
      accent="violet"
      onChange={(v) => router.push(href(path, params, { t: v || undefined }))}
    >
      <option value="">Alle thema&apos;s</option>
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </SelectShell>
  );
}

type PipelineOption = {
  account_key: string;
  accountName: string;
  pipeline: string;
  count: number;
};

// Keuzelijst voor de trechter
export function FunnelPicker({
  options,
  current,
  params,
  path = "/",
}: {
  options: PipelineOption[];
  current: string; // "account_key|||pipeline"
  params: Params;
  path?: string;
}) {
  const router = useRouter();
  return (
    <SelectShell
      value={current}
      active={false}
      onChange={(v) => {
        const [acc, pipe] = v.split("|||");
        router.push(href(path, params, { fa: acc, fp: pipe }));
      }}
    >
      {options.map((o) => (
        <option key={o.account_key + o.pipeline} value={`${o.account_key}|||${o.pipeline}`}>
          {o.accountName} — {o.pipeline} ({o.count})
        </option>
      ))}
    </SelectShell>
  );
}
