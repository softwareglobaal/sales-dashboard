export function UnderConstruction({ title }: { title: string }) {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
        <p className="text-sm text-zinc-500">Afdelingsdashboard</p>
      </header>
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-16 text-center">
        <div className="text-4xl">🚧</div>
        <p className="mx-auto mt-4 max-w-md text-base font-medium text-zinc-700">
          Under construction — Siyan is doing his best to finish this as soon as possible.
        </p>
      </div>
    </main>
  );
}
