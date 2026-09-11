export const dynamic = "force-dynamic";

// Wat de bezoeker ziet als hij een afdeling opvraagt waar hij niet bij mag.
// Bewust zonder cijfers of namen: de melding mag niet verklappen wat er staat.
export default function GeenToegang() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <div className="paneel">
        <div className="slot-scherm">
          <div className="kader">
            <span className="ico">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            </span>
            <h2>Deze afdeling staat niet voor jou open</h2>
            <p>
              Je account is niet aan deze afdeling toegewezen. Vraag Siyan om je aan de juiste groep toe te voegen
              als je hier wél bij moet.
            </p>
            <a href="/" className="knop-donker" style={{ marginTop: 22 }}>
              Terug naar het overzicht
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
