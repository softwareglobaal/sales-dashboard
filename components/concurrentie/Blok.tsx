/**
 * Een paneel dat je met de kop open- en dichtklapt. Native <details>, dus geen
 * javascript nodig en het werkt ook voor de pagina gehydrateerd is. Het aantal
 * staat als chip in de kop, zodat een dichtgeklapt blok nog zegt wat erin zit.
 *
 * `extra(i, n)` markeert rij i als "voorbij de eerste n": samen met <Ingekort>
 * blijft zo'n rij verborgen tot iemand "Toon alle" kiest.
 */
export function Blok({
  titel,
  aantal,
  open = true,
  children,
}: {
  titel: string;
  aantal?: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="paneel">
      <details className="opklap" open={open}>
        <summary className="kop">
          <h2 style={{ fontSize: 18 }}>{titel}</h2>
          <span className="flex shrink-0 items-center gap-2">
            {aantal && <span className="chip">{aantal}</span>}
            <svg className="pijl" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 3l5 5-5 5" />
            </svg>
          </span>
        </summary>
        {children}
      </details>
    </div>
  );
}

export function extra(i: number, n: number): { "data-extra"?: string } {
  return i >= n ? { "data-extra": "" } : {};
}
