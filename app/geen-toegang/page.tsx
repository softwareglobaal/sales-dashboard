export const dynamic = "force-dynamic";

// Wat de bezoeker ziet als hij een afdeling opvraagt waar hij niet bij mag.
// Bewust zonder cijfers of namen: de melding mag niet verklappen wat er staat.
export default function GeenToegang() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <div className="rounded-xl border border-zinc-300 bg-white p-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
          Geen toegang
        </p>
        <h1 className="mt-2 text-xl font-semibold text-zinc-900">
          Deze afdeling staat niet voor jou open
        </h1>
        <p className="mt-3 max-w-md text-sm text-zinc-600">
          Je account is niet aan deze afdeling toegewezen. Vraag Siyan om je aan de
          juiste groep toe te voegen als je hier wél bij moet.
        </p>
        <a
          href="/"
          className="mt-6 inline-block rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:border-zinc-500"
        >
          Terug naar het overzicht
        </a>
      </div>
    </main>
  );
}
