export const dynamic = "force-dynamic";

type Line = { firm: string; dot?: string; text: React.ReactNode };

function Member({
  initials,
  name,
  role,
  badgeClass,
  gradient,
  lines,
}: {
  initials: string;
  name: string;
  role: string;
  badgeClass: string;
  gradient: string;
  lines: Line[];
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center gap-3">
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-[15px] font-bold text-white"
          style={{ background: gradient }}
        >
          {initials}
        </div>
        <div>
          <div className="text-[16.5px] font-bold leading-tight text-zinc-900">{name}</div>
          <span className={"mt-1 inline-block rounded-md px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide " + badgeClass}>
            {role}
          </span>
        </div>
      </div>
      <div>
        {lines.map((l, i) => (
          <div
            key={i}
            className={"flex items-baseline gap-3 py-2.5 text-[13px] " + (i > 0 ? "border-t border-zinc-100" : "")}
          >
            <span className="flex min-w-[120px] shrink-0 items-center gap-2 font-semibold text-zinc-700">
              {l.dot && <span className="h-[7px] w-[7px] rounded-full" style={{ background: l.dot }} />}
              {l.firm}
            </span>
            <span className="text-zinc-600">{l.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const UNABO = "#16a34a";
const TKN = "#ea6a1e";
const EE = "#9333ea";
const HARCH = "#2f6bed";
const CONTRAX = "#0d9488";
const HARMONIE = "#64748b";

export default function SalesTeamPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Sales team</h1>
        <p className="text-sm text-zinc-500">Wie is verantwoordelijk voor wat</p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Member
          initials="SY"
          name="Siyan"
          role="Head of Sales"
          badgeClass="bg-blue-50 text-blue-700"
          gradient="linear-gradient(150deg,#2b50d6,#5b7bff)"
          lines={[
            { firm: "Team", text: "Leiding & opvolging van het volledige sales-team; sales-strategie." },
            { firm: "Alle firma's", text: "Overziet UNABO, TKN-Buro, Energie Efficiënt, H-Architects, Contrax & HarmonieBouw." },
          ]}
        />
        <Member
          initials="JO"
          name="Joey"
          role="Sales & offertes"
          badgeClass="bg-green-50 text-green-700"
          gradient="linear-gradient(150deg,#12a150,#38c172)"
          lines={[
            { firm: "UNABO", dot: UNABO, text: "Alle offertes + coördinatie sales-proces" },
            { firm: "TKN-Buro", dot: TKN, text: "Alle offertes + coördinatie sales-proces" },
            { firm: "Contrax", dot: CONTRAX, text: <>Klant <b>Yannick Technics</b></> },
            { firm: "Energie Eff.", dot: EE, text: "Offertes opmaken" },
          ]}
        />
        <Member
          initials="SH"
          name="Shelton"
          role="Opvolging & call-support"
          badgeClass="bg-orange-50 text-orange-700"
          gradient="linear-gradient(150deg,#ea6a1e,#f59247)"
          lines={[
            { firm: "UNABO & TKN", dot: UNABO, text: "Call-ondersteuning voor opvolgingen (met Joey)" },
            { firm: "H-Architects", dot: HARCH, text: "Opvolging" },
            { firm: "Contrax", dot: CONTRAX, text: <>Klant <b>Emjee</b></> },
            { firm: "HarmonieBouw", dot: HARMONIE, text: "Opvolging" },
          ]}
        />
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-700">Dekking per firma / klant</h3>
        <p className="mb-2 text-xs text-zinc-400">Snel overzicht van wie wat opvolgt</p>
        {[
          { firm: "UNABO", dot: UNABO, text: <>Offertes & coördinatie <b className="text-zinc-800">Joey</b> · opvolging <b className="text-zinc-800">Shelton</b></> },
          { firm: "TKN-Buro", dot: TKN, text: <>Offertes & coördinatie <b className="text-zinc-800">Joey</b> · opvolging <b className="text-zinc-800">Shelton</b></> },
          { firm: "Energie Efficiënt", dot: EE, text: <>Offertes <b className="text-zinc-800">Joey</b></> },
          { firm: "H-Architects", dot: HARCH, text: <>Opvolging <b className="text-zinc-800">Shelton</b></> },
          { firm: "Contrax", dot: CONTRAX, text: <>Yannick Technics → <b className="text-zinc-800">Joey</b> · Emjee → <b className="text-zinc-800">Shelton</b></> },
          { firm: "HarmonieBouw", dot: HARMONIE, text: <>Opvolging <b className="text-zinc-800">Shelton</b></> },
        ].map((r, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-zinc-100 py-2.5 text-[13px] last:border-b-0">
            <span className="flex min-w-[150px] items-center gap-2 font-semibold text-zinc-700">
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: r.dot }} />
              {r.firm}
            </span>
            <span className="flex-1 text-right text-zinc-500">{r.text}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
