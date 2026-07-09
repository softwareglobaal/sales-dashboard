export const dynamic = "force-dynamic";

import lossReasons from "@/config/lossReasons.json";

// Kerndefinities zoals ze in het dashboard gebruikt worden.
// "(controleren)" = definitie nog te bevestigen met Mehdi / afhankelijk van Pipedrive-veld.
type Term = { term: string; def: React.ReactNode; check?: boolean };

const BEGRIPPEN: Term[] = [
  {
    term: "Aanvraag",
    def: (
      <>
        Een <b>nieuwe lead/deal</b>, geteld op de datum waarop hij is aangemaakt in Pipedrive (<code>add_time</code>). Dit is
        het instroommoment — los van of hij later gewonnen of verloren wordt.
      </>
    ),
  },
  {
    term: "Offerte",
    def: (
      <>
        Een deal die de <b>offerte-fase</b> heeft bereikt (op basis van de fase-historiek in Pipedrive). De teller kijkt naar
        de eerste keer dat een deal in een offerte-fase kwam.
      </>
    ),
  },
  {
    term: "Gemiddelde tijd aanvraag → offerte",
    def: (
      <>
        Aantal dagen tussen het aanmaken van de aanvraag en het moment dat de deal de offerte-fase bereikte, gemiddeld over
        alle deals waarvoor beide momenten bekend zijn (via de fase-historiek). Wordt exact berekend, niet meer indicatief.
      </>
    ),
  },
  {
    term: "Gewonnen",
    def: (
      <>
        Deal met status <b>won</b>, geteld op <code>won_time</code>. Staat gelijk aan een <b>getekende offerte / project</b>.
      </>
    ),
  },
  {
    term: "Verloren",
    def: (
      <>
        Deal met status <b>lost</b>, geteld op het verliesmoment. Elke verloren deal heeft (idealiter) een verliesreden — zie
        hieronder.
      </>
    ),
  },
  {
    term: "Conversie %",
    def: (
      <>
        Aandeel van de aanvragen dat uiteindelijk gewonnen wordt. Let op: aanvraag en winst kunnen in verschillende maanden
        vallen, dus over korte periodes is dit cijfer ruwer dan over een heel jaar.
      </>
    ),
  },
  {
    term: "Bundel vs. los",
    def: (
      <>
        <b>Bundel</b> = een UNABO-deal met producten uit meerdere afdelingen (bv. engineering + een andere dienst samen).{" "}
        <b>Los</b> = enkel engineering. Bij TKN-Buro bestaat dit onderscheid niet (altijd los).
      </>
    ),
  },
  {
    term: "Engineering-waarde",
    def: (
      <>
        Binnen een bundel: enkel het deel van de dealwaarde dat aan <b>engineering-producten</b> toebehoort. Bij een losse deal
        is dat vrijwel de volledige dealwaarde.
      </>
    ),
  },
  {
    term: "Scope: Alles / UNABO Eng / TKN-Buro",
    def: (
      <>
        Filter bovenaan de Engineering-tab. <b>UNABO Eng</b> = enkel engineering-deals van UNABO; <b>TKN-Buro</b> = alle
        TKN-deals; <b>Alles</b> = beide samen (met vergelijking UNABO vs TKN).
      </>
    ),
  },
  {
    term: "Tekenwerk vs. Stabiliteitsstudie (TKN)",
    def: (
      <>
        Verdeling binnen TKN-Buro tussen tekenwerk-opdrachten en stabiliteitsstudies, op basis van de producten in de deal.
      </>
    ),
    check: true,
  },
  {
    term: "Kanaal (hoofd / subkanaal)",
    def: (
      <>
        Hoe de lead bij ons terechtkwam. Tweelaags: een <b>hoofdkanaal</b> (bv. website, telefonie, doorverwijzing) met
        daaronder een <b>subkanaal</b> voor meer detail.
      </>
    ),
  },
  {
    term: "Excl. btw",
    def: <>Alle bedragen in het dashboard zijn exclusief btw, tenzij anders vermeld.</>,
  },
  {
    term: "Projectadres vs. firma-adres",
    def: (
      <>
        Op de kaart: <b>projectadres</b> = de locatie van het bouwproject (uit de deal-titel, vooral B2C). <b>Firma-adres</b> =
        het kantooradres van een B2B-klant (aparte laag). Onze eigen kantoren vormen een derde laag.
      </>
    ),
  },
  {
    term: "Geslacht",
    def: <>Placeholder — dit veld bestaat nog niet in Pipedrive. De sectie vult zich zodra het veld ingevuld wordt.</>,
    check: true,
  },
];

export default function WoordenboekPage() {
  const map = (lossReasons as any).map as Record<string, string>;
  const hoofdredenen = (lossReasons as any)._hoofdredenen as string[];

  // Groepeer alle (genormaliseerde) varianten per hoofd-reden.
  const variantsByMain: Record<string, string[]> = {};
  for (const main of hoofdredenen) variantsByMain[main] = [];
  for (const [variant, main] of Object.entries(map)) {
    if (!variantsByMain[main]) variantsByMain[main] = [];
    variantsByMain[main].push(variant);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Woordenboek</h1>
        <p className="text-sm text-zinc-500">
          Wat betekenen de begrippen en cijfers in dit dashboard? Items met{" "}
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">controleren</span>{" "}
          zijn nog te bevestigen of wachten op een Pipedrive-veld.
        </p>
      </header>

      {/* Begrippen */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-zinc-900">Begrippen</h2>
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {BEGRIPPEN.map((t, i) => (
            <div
              key={t.term}
              className={"flex flex-col gap-1 px-5 py-4 sm:flex-row sm:gap-6 " + (i > 0 ? "border-t border-zinc-100" : "")}
            >
              <div className="flex min-w-[200px] shrink-0 items-start gap-2">
                <span className="font-semibold text-zinc-900">{t.term}</span>
                {t.check && (
                  <span className="mt-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    controleren
                  </span>
                )}
              </div>
              <div className="text-[13.5px] leading-relaxed text-zinc-600">{t.def}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Verliesredenen */}
      <section className="mb-8">
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">Verliesredenen</h2>
        <p className="mb-3 text-xs text-zinc-500">
          Alle (oude, rommelige) redenen uit Pipedrive worden samengebracht onder {hoofdredenen.length} hoofd-redenen. Zo
          blijven de grafieken leesbaar. Nieuwe/onbekende redenen tonen onder hun eigen naam tot ze hier ingedeeld zijn.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {hoofdredenen.map((main) => (
            <div key={main} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="mb-2 font-semibold text-zinc-900">{main}</div>
              {variantsByMain[main].length === 0 ? (
                <div className="text-xs text-zinc-400">Nog geen varianten ingedeeld.</div>
              ) : (
                <ul className="space-y-1 text-[12.5px] text-zinc-500">
                  {variantsByMain[main].map((v) => (
                    <li key={v} className="flex items-start gap-1.5">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-300" />
                      <span>{v}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
