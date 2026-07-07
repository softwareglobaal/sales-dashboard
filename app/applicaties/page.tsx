import { ACCOUNTS } from "@/lib/accounts";

export const dynamic = "force-dynamic";

type App = { name: string; url: string; desc: string; tile: string; mono: string };

const APPS: App[] = [
  { name: "PandaDoc", url: "https://app.pandadoc.com", desc: "Offertes & documenten opmaken en versturen", tile: "#22b07d", mono: "PD" },
  { name: "Google Ads", url: "https://ads.google.com", desc: "Advertentiecampagnes (SEA)", tile: "#4285f4", mono: "GA" },
  { name: "Google Contacts", url: "https://contacts.google.com", desc: "Contactenbeheer", tile: "#1a73e8", mono: "GC" },
  { name: "Canva", url: "https://www.canva.com", desc: "Visuals & design", tile: "#00c4cc", mono: "C" },
];

function AppCard({ name, url, desc, tile, mono }: App) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3.5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:shadow-md"
    >
      <div
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[13px] font-bold text-white"
        style={{ background: tile }}
      >
        {mono}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 font-semibold text-zinc-900">
          {name}
          <span className="text-zinc-300 transition group-hover:text-zinc-500">↗</span>
        </div>
        <div className="truncate text-[12.5px] text-zinc-500">{desc}</div>
      </div>
    </a>
  );
}

export default function ApplicatiesPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Applicaties</h1>
        <p className="text-sm text-zinc-500">Platformen &amp; tools die het sales-team gebruikt — klik om te openen</p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Pipedrive — alle firma's */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center gap-3.5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#1f1f1f] text-[13px] font-bold text-white">
              PD
            </div>
            <div>
              <div className="font-semibold text-zinc-900">Pipedrive</div>
              <div className="text-[12.5px] text-zinc-500">CRM — alle firma&#39;s / accounts</div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ACCOUNTS.map((a) => (
              <a
                key={a.key}
                href={`https://${a.domain}.pipedrive.com`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2.5 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm transition hover:border-zinc-200 hover:bg-white"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />
                <span className="font-medium text-zinc-800">{a.name}</span>
                <span className="ml-auto text-zinc-300 transition group-hover:text-zinc-500">↗</span>
              </a>
            ))}
          </div>
        </div>

        {APPS.map((a) => (
          <AppCard key={a.name} {...a} />
        ))}
      </div>

      <p className="mt-4 text-xs text-zinc-400">
        Tip: laat me weten als er tools bij moeten (bv. boekhouding, mailing). Toevoegen is één regel in deze lijst.
      </p>
    </main>
  );
}
