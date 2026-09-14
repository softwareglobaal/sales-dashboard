import { laadProjecten, samenvatting } from "@/lib/haProjecten";
import { uitQuery, RECENT_VANAF, type Query } from "@/lib/haProjectenFilter";
import { num } from "@/lib/format";
import { Kpi } from "@/components/ui";
import { Projectenlijst } from "./Projectenlijst";

/**
 * Projectenlijst H-Architects, met fototelling.
 *
 * Waarvoor: Mehdi moet snel kunnen zien welke gebouwen nog bezocht en
 * gefotografeerd moeten worden. De lijst verving een Excel-bestand; dit is
 * dezelfde telling, maar als pagina met een deelbare link.
 *
 * Servercomponent voor de gegevens, clientcomponent voor de filters. De 614
 * projecten gaan in één keer mee, zodat filteren geen herlaadbeurt kost.
 */

export const dynamic = "force-dynamic";

function datum(iso: string) {
  const [j, m, d] = iso.split("-");
  return `${d}/${m}/${j}`;
}

export default async function ProjectenPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const sp = await searchParams;
  const bron = laadProjecten();

  if (!bron) {
    return (
      <main className="mx-auto max-w-[1600px] px-6 py-8">
        <h1 className="h1-glas klein">
          Projecten <em>H-Architects</em>
        </h1>
        <div className="paneel" style={{ marginTop: 16 }}>
          <div className="leeg">
            <h3>De projectenlijst is nog niet ingelezen</h3>
            <p>
              Het bronbestand data-bronnen/h-architects-projecten-2026-09-14.json ontbreekt. Draai
              scripts/h-architects-projecten.py om het opnieuw uit de Excel te maken.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const s = samenvatting(bron.projecten);
  const begin = uitQuery(sp);
  const tab = (Array.isArray(sp.tab) ? sp.tab[0] : sp.tab) || "lijst";

  return (
    <main className="mx-auto max-w-[1600px] px-6 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="h1-glas klein">
          Projecten <em>H-Architects</em>
        </h1>
        <div style={{ fontSize: 12, color: "var(--inkt-vaag)" }}>
          Fototelling uit Dropbox op {datum(bron.telling)}, op de projectlijst van{" "}
          {datum(bron.projectlijst)}
        </div>
      </div>

      {/* Zes tegels in plaats van de vier van .kpis: auto-fit zodat ze op een
          smal scherm vanzelf naar twee kolommen zakken. */}
      <div
        className="kpis"
        style={{ marginTop: 20, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}
      >
        <Kpi label="Projecten" value={num(s.totaal)} sub="in de telling" />
        <Kpi label="Met foto" value={num(s.metFoto)} sub="minstens één beeldbestand" />
        <Kpi label="Zonder foto" value={num(s.zonderFoto)} sub="geen enkel beeld in de map" />
        <Kpi label="Opleveringsfoto's" value={num(s.metOplevering)} sub="beeld in een oplevermap" />
        <Kpi label={`Beeld van ${RECENT_VANAF} of later`} value={num(s.recentBeeld)} sub="recentste beeldbestand" />
        <Kpi label="Onbekend" value={num(s.onbekend)} sub="map niet leesbaar" />
      </div>

      <Projectenlijst projecten={bron.projecten} begin={begin} tabblad={tab} />

      <div className="paneel" style={{ marginTop: 16 }}>
        <div className="kop">
          <h2>Hoe deze lijst gelezen moet worden</h2>
          <small>Telling van {datum(bron.telling)}</small>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          <div>
            <h4>Wat “foto’s aanwezig” wel en niet betekent</h4>
            <p className="lede" style={{ fontSize: 13 }}>
              Geteld is elk beeldbestand in de projectmap (jpg, jpeg, png, heic, heif, webp),
              inclusief alle onderliggende mappen. De helft van de 161.387 beelden zijn png's:
              plannen, uitsneden, schermafdrukken, logo's en scans. “Ja” betekent dus niet dat er
              bruikbaar beeld van het gebouw is. Het scherpste signaal is de kolom
              Opleveringsfoto's, en daarna de kolom Recentste foto.
            </p>
            <p className="lede" style={{ fontSize: 13, marginTop: 8 }}>
              De sjabloonmap “4. Foto’s oplevering” staat in bijna elk dossier maar is meestal leeg:
              slechts {num(s.metOplevering)} van de {num(s.totaal)} projecten hebben er beeld in.
              Werffoto's zitten wel in de werfverslag- en opmetingsmappen, maar tonen het gebouw in
              aanbouw, niet afgewerkt. Ook projecten met weinig beelden zijn kandidaat: 99 projecten
              hebben er minder dan 10, 167 minder dan 25.
            </p>
          </div>

          <div>
            <h4>Wat niet te lezen was</h4>
            <p className="lede" style={{ fontSize: 13 }}>
              Bij {num(bron.onleesbareMappen.length)} projectmappen wil Dropbox de inhoud niet geven.
              Die staan als “onbekend” in de lijst, uitdrukkelijk niet als “nee”:
            </p>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13, color: "var(--inkt-zacht)" }}>
              {bron.onleesbareMappen.map((m) => (
                <li key={m.nummer}>
                  {m.nummer}: {m.project}
                </li>
              ))}
            </ul>
            <p className="lede" style={{ fontSize: 13, marginTop: 10 }}>
              Daarnaast geven vier gedeelde mappen nog altijd “not found” met dit Dropbox-account.
              Projecten die uitsluitend daar zitten, staan niet in deze lijst. Wie die mappen deelt
              met sls.siyan@globaal.be, kan de lijst laten aanvullen.
            </p>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12, color: "var(--inkt-vaag)" }}>
              {bron.gedeeldeMappen.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>

          <div>
            <h4>Herkomst en houdbaarheid</h4>
            <p className="lede" style={{ fontSize: 13 }}>
              De projecten komen uit de telling van {datum(bron.projectlijst)}; de mappen en
              bestanden zijn op {datum(bron.telling)} uit Dropbox gehaald (481.580 items). Van de{" "}
              {num(s.totaal)} projecten zijn er 611 aan een echte Dropbox-map gekoppeld; drie
              projecten hebben alleen een getekend contract en wijzen naar de contractmap. Staat
              een project in meerdere mappen, dan zijn de beelden van alle mappen samen geteld en
              wijst de link naar de hoofdmap.
            </p>
            <p className="lede" style={{ fontSize: 13, marginTop: 8 }}>
              Jaar komt uit het projectnummer. Type staat er alleen als het letterlijk uit de
              mapnaam of de bronmap blijkt; bij 302 projecten is er niet gegokt en blijft de kolom
              leeg. De mapnamen zijn brongegevens van wisselende kwaliteit; adres, postcode en
              gemeente zijn genormaliseerd, de ruwe mapnaam staat als laatste kolom zodat je altijd
              kunt terugkijken.
            </p>
            <p className="notitie let" style={{ marginTop: 10 }}>
              Deze telling is een momentopname en ververst zichzelf niet. Draai
              scripts/h-architects-projecten.py opnieuw na een nieuwe Dropbox-doorloop. De lijst
              bevat klant- en medewerkersnamen in de mapnamen en blijft daarom binnen dit dashboard,
              achter de login.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
