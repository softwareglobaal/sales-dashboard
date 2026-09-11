export function UnderConstruction({ title }: { title: string }) {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6">
        <h1 className="h1-glas">{title}</h1>
        <p className="text-sm text-zinc-500">Afdelingsdashboard</p>
      </header>
      <div className="paneel">
        <div className="leeg">
          <span className="ico">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 20h4l10-10-4-4L4 16z" />
              <path d="m13 7 4 4" />
            </svg>
          </span>
          <h3>In aanbouw</h3>
          <p>Siyan werkt hieraan; dit dashboard volgt zodra de gegevens erachter kloppen.</p>
        </div>
      </div>
    </main>
  );
}
