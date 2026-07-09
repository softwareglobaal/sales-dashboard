"use client";

import { useEffect, useRef, useState } from "react";
import { BE_VIEWBOX, BE_PROVINCES, projectLatLng } from "@/lib/belgiumGeo";
import type { RegionPoint, B2BOffice } from "@/lib/queries";

export type OurOffice = { label: string; address: string; city: string; lat: number; lng: number; confirmed: boolean };

const STATUS = {
  won: { color: "#16a34a", label: "Project (gewonnen)" },
  open: { color: "#ea580c", label: "Aanvraag (open)" },
  lost: { color: "#dc2626", label: "Verloren" },
} as const;
const B2B_COLOR = "#7c3aed";
// elk kantoor krijgt zijn eigen kleur + gebouwtype
const OFFICE_PALETTE = ["#2563eb", "#0891b2", "#db2777", "#4f46e5", "#0d9488", "#ca8a04", "#a21caf", "#b45309", "#334155", "#0284c7"];
const W = "#ffffff";
// een kantoorgebouw-icoon (10 varianten), getekend in een [-6..6]-vak rond de oorsprong
function building(idx: number, color: string) {
  const b = { stroke: "rgba(0,0,0,0.28)", strokeWidth: 0.4, vectorEffect: "non-scaling-stroke" as const };
  switch (idx % 10) {
    case 0: // kantoortoren
      return (
        <>
          <rect x={-3} y={-6} width={6} height={12} rx={0.5} fill={color} {...b} />
          {[-4.2, -1.7, 0.8, 3.3].map((y, i) => (
            <g key={i}>
              <rect x={-2} y={y} width={1.5} height={1.1} fill={W} />
              <rect x={0.5} y={y} width={1.5} height={1.1} fill={W} />
            </g>
          ))}
        </>
      );
    case 1: // huis
      return (
        <>
          <path d="M-5 -1 L0 -5.5 L5 -1 Z" fill={color} {...b} />
          <rect x={-4} y={-1} width={8} height={7} rx={0.4} fill={color} {...b} />
          <rect x={-1.1} y={2.2} width={2.2} height={3.8} fill={W} />
          <rect x={-3} y={0.2} width={1.6} height={1.6} fill={W} />
          <rect x={1.4} y={0.2} width={1.6} height={1.6} fill={W} />
        </>
      );
    case 2: // breed laag gebouw
      return (
        <>
          <rect x={-6} y={0} width={12} height={6} rx={0.4} fill={color} {...b} />
          <rect x={-2.5} y={-3} width={5} height={3} fill={color} {...b} />
          <rect x={-1} y={2.5} width={2} height={3.5} fill={W} />
          {[-5, -3, 3, 4.6].map((x, i) => (
            <rect key={i} x={x} y={1.5} width={1.4} height={1.4} fill={W} />
          ))}
        </>
      );
    case 3: // twee torens
      return (
        <>
          <rect x={-5} y={-3} width={4.2} height={9} rx={0.4} fill={color} {...b} />
          <rect x={0.8} y={-6} width={4.2} height={12} rx={0.4} fill={color} {...b} />
          {[-1, 2, 4.5].map((y, i) => (
            <rect key={i} x={-4} y={y} width={2.4} height={1} fill={W} />
          ))}
          {[-4, -1, 2, 4.5].map((y, i) => (
            <rect key={"b" + i} x={2} y={y} width={2.4} height={1} fill={W} />
          ))}
        </>
      );
    case 4: // fabriek
      return (
        <>
          <rect x={-6} y={-1} width={12} height={7} rx={0.3} fill={color} {...b} />
          <path d="M-6 -1 L-4 -4 L-2 -1 Z M-2 -1 L0 -4 L2 -1 Z M2 -1 L4 -4 L6 -1 Z" fill={color} {...b} />
          <rect x={3.4} y={-6} width={1.5} height={3} fill={color} {...b} />
          {[-5, -2.5, 0, 2.5].map((x, i) => (
            <rect key={i} x={x} y={1.5} width={1.6} height={2.5} fill={W} />
          ))}
        </>
      );
    case 5: // appartementsblok
      return (
        <>
          <rect x={-4} y={-5} width={8} height={11} rx={0.4} fill={color} {...b} />
          {[-3.6, -1.4, 0.8, 3].map((y, r) =>
            [-3, -1, 1.2].map((x, c) => <rect key={r + "-" + c} x={x} y={y} width={1.6} height={1.3} fill={W} />)
          )}
        </>
      );
    case 6: // villa
      return (
        <>
          <path d="M-6 0 L-3 -3.5 L0 0 Z M0 0 L3 -3.5 L6 0 Z" fill={color} {...b} />
          <rect x={-6} y={0} width={12} height={6} rx={0.4} fill={color} {...b} />
          <rect x={-1} y={2.5} width={2} height={3.5} fill={W} />
          {[-4.5, 3].map((x, i) => (
            <rect key={i} x={x} y={1.5} width={1.6} height={1.6} fill={W} />
          ))}
        </>
      );
    case 7: // winkel met luifel
      return (
        <>
          <rect x={-5} y={-4} width={10} height={10} rx={0.4} fill={color} {...b} />
          <rect x={-5.6} y={-0.5} width={11.2} height={1.8} fill={W} />
          <rect x={-1.4} y={2} width={2.8} height={4} fill={W} />
          {[-4, 2.6].map((x, i) => (
            <rect key={i} x={x} y={-3} width={1.8} height={1.8} fill={W} />
          ))}
        </>
      );
    case 8: // loods met boogdak
      return (
        <>
          <path d="M-6 6 L-6 -1 A6 4 0 0 1 6 -1 L6 6 Z" fill={color} {...b} />
          <rect x={-1.3} y={2} width={2.6} height={4} fill={W} />
          {[-4.2, 2.4].map((x, i) => (
            <rect key={i} x={x} y={0} width={1.8} height={1.8} fill={W} />
          ))}
        </>
      );
    default: // modern trapgebouw
      return (
        <>
          <rect x={-6} y={2} width={5} height={4} fill={color} {...b} />
          <rect x={-2.5} y={-2} width={5} height={8} fill={color} {...b} />
          <rect x={1} y={-6} width={5} height={12} fill={color} {...b} />
          {[-1, 1.5, 4].map((y, i) => (
            <rect key={i} x={2} y={y} width={2.6} height={1} fill={W} />
          ))}
        </>
      );
  }
}

// Referentielabels voor oriëntatie: provincies (groot/vaag) + grote steden (klein).
const PROVINCE_LABELS: [string, number, number][] = [
  ["ANTWERPEN", 51.18, 4.78],
  ["OOST-VL.", 51.02, 3.78],
  ["WEST-VL.", 51.02, 3.05],
  ["VLAAMS-BRABANT", 50.83, 4.78],
  ["LIMBURG", 50.98, 5.42],
];
const CITY_LABELS: [string, number, number][] = [
  ["Antwerpen", 51.22, 4.4],
  ["Gent", 51.05, 3.72],
  ["Brugge", 51.21, 3.22],
  ["Leuven", 50.88, 4.7],
  ["Hasselt", 50.93, 5.34],
  ["Genk", 50.97, 5.5],
  ["Kortrijk", 50.83, 3.27],
  ["Mechelen", 51.03, 4.48],
  ["Sint-Niklaas", 51.16, 4.14],
  ["Turnhout", 51.32, 4.95],
  ["Oostende", 51.23, 2.92],
  ["Aalst", 50.94, 4.04],
  ["Brussel", 50.85, 4.35],
];

const euro = (n: number) => new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);
const [VBW, VBH] = BE_VIEWBOX.split(" ").slice(2).map(Number);
const K_MIN = 1;
const K_MAX = 9;

const diamond = (cx: number, cy: number, s: number) => `M${cx} ${(cy - s).toFixed(1)}L${(cx + s).toFixed(1)} ${cy}L${cx} ${(cy + s).toFixed(1)}L${(cx - s).toFixed(1)} ${cy}Z`;

type Sel = { kind: "deal"; d: RegionPoint } | { kind: "b2b"; d: B2BOffice } | { kind: "office"; d: OurOffice; color: string } | null;

export function BelgiumMap({
  points,
  b2bOffices,
  ourOffices,
  colorBy = "status",
  firmaColors,
}: {
  points: RegionPoint[];
  b2bOffices: B2BOffice[];
  ourOffices: OurOffice[];
  colorBy?: "status" | "firma";
  firmaColors?: Record<string, string>;
}) {
  const [sel, setSel] = useState<Sel>(null);
  const [show, setShow] = useState({ projects: true, b2b: false, offices: true, labels: true });
  const pointColor = (p: RegionPoint) => (colorBy === "firma" ? firmaColors?.[p.firma || ""] ?? "#64748b" : STATUS[p.status].color);
  const [t, setT] = useState({ k: 1, x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef({ active: false, sx: 0, sy: 0, moved: false });

  const clamp = (nx: number, ny: number, k: number) => ({
    k,
    x: Math.min(0, Math.max(VBW * (1 - k), nx)),
    y: Math.min(0, Math.max(VBH * (1 - k), ny)),
  });
  const zoomTo = (sx: number, sy: number, factor: number) =>
    setT((prev) => {
      const k = Math.min(K_MAX, Math.max(K_MIN, prev.k * factor));
      const wx = (sx - prev.x) / prev.k;
      const wy = (sy - prev.y) / prev.k;
      return clamp(sx - wx * k, sy - wy * k, k);
    });
  const toUser = (cx: number, cy: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: VBW / 2, y: VBH / 2, s: 1 };
    const pt = svg.createSVGPoint();
    pt.x = cx;
    pt.y = cy;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y, s: ctm.a };
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { x, y } = toUser(e.clientX, e.clientY);
      zoomTo(x, y, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  const onDown = (e: React.PointerEvent) => {
    drag.current = { active: true, sx: e.clientX, sy: e.clientY, moved: false };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.sx;
    const dy = e.clientY - drag.current.sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
    drag.current.sx = e.clientX;
    drag.current.sy = e.clientY;
    const { s } = toUser(e.clientX, e.clientY);
    setT((prev) => clamp(prev.x + dx / s, prev.y + dy / s, prev.k));
  };
  const onUp = () => (drag.current.active = false);
  const click = (fn: () => void) => () => {
    if (drag.current.moved) return;
    fn();
  };

  const jit = (id: number) => [(((id * 31) % 9) - 4) * 0.7, (((id * 17) % 9) - 4) * 0.7] as const;
  const dotR = 4 / t.k;
  const dmS = 4.6 / t.k;

  const toggle = (key: keyof typeof show) => setShow((s) => ({ ...s, [key]: !s[key] }));
  const Chip = ({ k, color, label, shape }: { k: keyof typeof show; color: string; label: string; shape: "dot" | "diamond" | "building" }) => (
    <button
      onClick={() => toggle(k)}
      className={"flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition " + (show[k] ? "text-zinc-700" : "text-zinc-400 opacity-60")}
    >
      <svg width="13" height="13" viewBox="-7 -7 14 14">
        {shape === "dot" && <circle r="4.5" fill={color} />}
        {shape === "diamond" && <path d={diamond(0, 0, 4.8)} fill={color} />}
        {shape === "building" && building(0, color)}
      </svg>
      {label}
    </button>
  );

  return (
    <div className="relative overflow-hidden rounded-xl bg-[#f6f8fb] ring-1 ring-black/[0.04]">
      <svg
        ref={svgRef}
        viewBox={BE_VIEWBOX}
        className={"h-auto w-full touch-none select-none " + (drag.current.active ? "cursor-grabbing" : "cursor-grab")}
        role="img"
        aria-label="Kaart van Vlaanderen en Brussel"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        <g transform={`translate(${t.x} ${t.y}) scale(${t.k})`}>
          {BE_PROVINCES.map((pr) => (
            <path key={pr.name} d={pr.d} fill="#e9eef5" stroke="#c3ccd9" strokeWidth={0.8} fillRule="evenodd" vectorEffect="non-scaling-stroke">
              <title>{pr.name}</title>
            </path>
          ))}

          {/* projectlocaties */}
          {show.projects &&
            points.map((p, i) => {
              const [x, y] = projectLatLng(p.lat, p.lng);
              const [jx, jy] = jit(p.id);
              const isSel = sel?.kind === "deal" && sel.d.id === p.id;
              return (
                <circle
                  key={"p" + p.id + i}
                  cx={x + jx}
                  cy={y + jy}
                  r={isSel ? dotR * 1.5 : dotR}
                  fill={pointColor(p)}
                  fillOpacity={0.85}
                  stroke={isSel ? "#0f172a" : "#fff"}
                  strokeWidth={isSel ? 1.6 : 0.8}
                  vectorEffect="non-scaling-stroke"
                  className="cursor-pointer"
                  onClick={click(() => setSel({ kind: "deal", d: p }))}
                >
                  <title>{p.client} — {p.city}</title>
                </circle>
              );
            })}

          {/* B2B-kantoren (diamant) */}
          {show.b2b &&
            b2bOffices.map((o, i) => {
              const [x, y] = projectLatLng(o.lat, o.lng);
              const [jx, jy] = jit(o.id);
              const isSel = sel?.kind === "b2b" && sel.d.id === o.id;
              return (
                <path
                  key={"b" + o.id + i}
                  d={diamond(x + jx, y + jy, isSel ? dmS * 1.4 : dmS)}
                  fill={B2B_COLOR}
                  fillOpacity={0.9}
                  stroke={isSel ? "#0f172a" : "#fff"}
                  strokeWidth={isSel ? 1.6 : 0.8}
                  vectorEffect="non-scaling-stroke"
                  className="cursor-pointer"
                  onClick={click(() => setSel({ kind: "b2b", d: o }))}
                >
                  <title>{o.name} — {o.count} deals</title>
                </path>
              );
            })}

          {/* onze kantoren (elk eigen gebouw-icoon + kleur) */}
          {show.offices &&
            ourOffices.map((o, i) => {
              const [x, y] = projectLatLng(o.lat, o.lng);
              const color = OFFICE_PALETTE[i % OFFICE_PALETTE.length];
              const isSel = sel?.kind === "office" && sel.d.label === o.label && sel.d.address === o.address;
              const s = (isSel ? 1.5 : 1.15) / t.k;
              return (
                <g
                  key={"o" + i}
                  transform={`translate(${x} ${y}) scale(${s})`}
                  className="cursor-pointer"
                  onClick={click(() => setSel({ kind: "office", d: o, color }))}
                >
                  {building(i, color)}
                  <circle r={7} fill="transparent" />
                  <title>{o.label} — {o.city}</title>
                </g>
              );
            })}

          {/* onze-kantoor-namen (labels bij de gebouwen) */}
          {show.offices &&
            ourOffices.map((o, i) => {
              const [x, y] = projectLatLng(o.lat, o.lng);
              return (
                <text
                  key={"ol" + i}
                  x={x + 7 / t.k}
                  y={y + 3 / t.k}
                  fontSize={9 / t.k}
                  fontWeight={600}
                  fill="#1e293b"
                  stroke="#f6f8fb"
                  strokeWidth={2.5}
                  paintOrder="stroke"
                  style={{ pointerEvents: "none" }}
                >
                  {o.label}
                </text>
              );
            })}

          {/* referentielabels: provincies + grote steden */}
          {show.labels && (
            <g style={{ pointerEvents: "none" }}>
              {PROVINCE_LABELS.map(([name, lat, lng]) => {
                const [x, y] = projectLatLng(lat, lng);
                return (
                  <text
                    key={"pl" + name}
                    x={x}
                    y={y}
                    fontSize={13 / t.k}
                    fontWeight={700}
                    letterSpacing={1 / t.k}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fillOpacity={0.75}
                  >
                    {name}
                  </text>
                );
              })}
              {CITY_LABELS.map(([name, lat, lng]) => {
                const [x, y] = projectLatLng(lat, lng);
                return (
                  <text
                    key={"cl" + name}
                    x={x}
                    y={y}
                    fontSize={8.5 / t.k}
                    fontWeight={600}
                    textAnchor="middle"
                    fill="#475569"
                    stroke="#f6f8fb"
                    strokeWidth={2.2 / t.k}
                    paintOrder="stroke"
                  >
                    {name}
                  </text>
                );
              })}
            </g>
          )}
        </g>
      </svg>

      {/* laag-toggles (dubbelen als legende) */}
      <div className="absolute left-2 top-2 flex flex-col gap-0.5 rounded-lg bg-white/85 p-1 shadow-sm ring-1 ring-black/5 backdrop-blur">
        <Chip k="projects" color={colorBy === "firma" ? "#64748b" : STATUS.won.color} label="Projecten" shape="dot" />
        <Chip k="b2b" color={B2B_COLOR} label={`B2B-kantoren (${b2bOffices.length})`} shape="diamond" />
        <Chip k="offices" color="#334155" label="Onze kantoren" shape="building" />
        <button
          onClick={() => toggle("labels")}
          className={"flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition " + (show.labels ? "text-zinc-700" : "text-zinc-400 opacity-60")}
        >
          <span className="grid h-3 w-3 place-items-center text-[9px] text-zinc-500">Aa</span>
          Namen
        </button>
        {colorBy === "firma" && firmaColors && show.projects && (
          <div className="mt-0.5 border-t border-zinc-100 px-2 pt-1">
            <div className="mb-0.5 text-[9.5px] font-medium uppercase tracking-wide text-zinc-400">Firma</div>
            {Object.entries(firmaColors).map(([f, c]) => (
              <span key={f} className="flex items-center gap-1.5 py-px text-[11px] text-zinc-600">
                <span className="h-2 w-2 rounded-full" style={{ background: c }} />
                {f}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* zoom-knoppen */}
      <div className="absolute bottom-2 right-2 flex flex-col overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/10">
        <button onClick={() => zoomTo(VBW / 2, VBH / 2, 1.4)} className="grid h-8 w-8 place-items-center text-lg text-zinc-600 hover:bg-zinc-50" aria-label="Inzoomen">+</button>
        <button onClick={() => zoomTo(VBW / 2, VBH / 2, 1 / 1.4)} className="grid h-8 w-8 place-items-center border-t border-zinc-100 text-lg text-zinc-600 hover:bg-zinc-50" aria-label="Uitzoomen">−</button>
        {t.k > 1.001 && (
          <button onClick={() => setT({ k: 1, x: 0, y: 0 })} className="grid h-8 w-8 place-items-center border-t border-zinc-100 text-[11px] text-zinc-500 hover:bg-zinc-50" aria-label="Terugzetten" title="Terugzetten">⤢</button>
        )}
      </div>
      <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-white/80 px-2 py-0.5 text-[10.5px] text-zinc-400 ring-1 ring-black/5">
        Scroll of + / − om te zoomen · sleep om te verschuiven
      </div>

      {/* popup */}
      {sel && (
        <div className="absolute right-2 top-2 w-[min(20rem,88%)] rounded-xl border border-zinc-200 bg-white p-3.5 shadow-lg">
          <div className="mb-2 flex items-start justify-between gap-2">
            {sel.kind === "deal" && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium text-white" style={{ background: STATUS[sel.d.status].color }}>
                {STATUS[sel.d.status].label}
              </span>
            )}
            {sel.kind === "b2b" && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium text-white" style={{ background: B2B_COLOR }}>
                B2B-kantoor
              </span>
            )}
            {sel.kind === "office" && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium text-white" style={{ background: sel.color }}>
                <svg width="12" height="12" viewBox="-7 -7 14 14">{building(ourOffices.findIndex((o) => o.label === sel.d.label && o.address === sel.d.address), "#ffffff")}</svg>
                Ons kantoor{!sel.d.confirmed ? " (te bevestigen)" : ""}
              </span>
            )}
            <button onClick={() => setSel(null)} className="text-zinc-400 hover:text-zinc-700" aria-label="Sluiten">✕</button>
          </div>

          {sel.kind === "deal" && (
            <>
              <div className="text-[14px] font-semibold text-zinc-900">{sel.d.client}</div>
              <div className="mt-0.5 text-[12.5px] text-zinc-600">{sel.d.address}</div>
              <dl className="mt-2.5 space-y-1 text-[12px]">
                {sel.d.firma && <Row k="Firma" v={sel.d.firma} />}
                {sel.d.pipeline && <Row k="Pipeline" v={sel.d.pipeline} />}
                <Row k="Status" v={STATUS[sel.d.status].label} />
                <Row k="Waarde" v={sel.d.value > 0 ? euro(sel.d.value) : "—"} />
                {sel.d.products.length > 0 && <Row k="Producten" v={sel.d.products.join(", ")} />}
              </dl>
              {sel.d.url && <PdLink url={sel.d.url} />}
            </>
          )}
          {sel.kind === "b2b" && (
            <>
              <div className="text-[14px] font-semibold text-zinc-900">{sel.d.name}</div>
              {sel.d.city && <div className="mt-0.5 text-[12.5px] text-zinc-600">{sel.d.city}</div>}
              <dl className="mt-2.5 space-y-1 text-[12px]">
                <Row k="Deals (zonder projectadres)" v={String(sel.d.count)} />
              </dl>
              {sel.d.url && <PdLink url={sel.d.url} label="Open organisatie ↗" />}
            </>
          )}
          {sel.kind === "office" && (
            <>
              <div className="text-[14px] font-semibold text-zinc-900">{sel.d.label}</div>
              <div className="mt-0.5 text-[12.5px] text-zinc-600">{sel.d.address}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-zinc-400">{k}</dt>
      <dd className="text-right text-zinc-700">{v}</dd>
    </div>
  );
}
function PdLink({ url, label = "Open in Pipedrive ↗" }: { url: string; label?: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-zinc-700">
      {label}
    </a>
  );
}
