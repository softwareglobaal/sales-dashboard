import { laadProjecten, samenvatting } from "@/lib/haProjecten";
import { uitQuery, type Query } from "@/lib/haProjectenFilter";
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
        <Kpi label="Opgeleverd in beeld" value={num(s.inBeeld)} sub="afgewerkt gebouw op foto" />
        <Kpi label="Niet in beeld" value={num(s.nietInBeeld)} sub="werf, opmeting of niets" />
        <Kpi label="Onzeker" value={num(s.onzeker)} sub="niet uit te maken" />
        <Kpi label="Te fotograferen" value={num(s.teFotograferen)} sub="nee of onzeker, niet opgezegd" />
        <Kpi label="Zonder camerafoto" value={num(s.zonderCamerafoto)} sub="alleen plannen of niets" />
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
            <h4>Hoe “opgeleverd in beeld” bepaald is</h4>
            <p className="lede" style={{ fontSize: 13 }}>
              De oude kolom “foto’s aanwezig” telde élk beeldbestand in de projectmap, plannen en
              schermafdrukken inbegrepen, en stond daardoor bij bijna elk dossier op “ja”. Daarom
              zijn de beelden in twee hopen verdeeld. Een <b>camerafoto</b> is een jpg, jpeg, heic of
              heif waarvan de bestandsnaam niet op tekenwerk wijst; alles wat png is, of plan, gevel,
              snede, render, 3d, export, pagina of schermafbeelding in de naam draagt, telt als
              tekening of schermafdruk. De kolom Foto’s toont alleen die camerafoto’s —{" "}
              {num(s.camerafotos)} in totaal, tegenover 161.387 beeldbestanden in de oude telling.
            </p>
            <p className="lede" style={{ fontSize: 13, marginTop: 8 }}>
              Daarna is er <b>met het oog gekeken</b>. Van elk project zijn de drie recentste
              camerafoto’s als thumbnail op een contactblad gezet en bekeken. “Ja” betekent: een
              afgewerkte gevel of een afgewerkt interieur staat op de foto, zonder stellingen, puin
              of bouwmateriaal. “Nee” betekent: alleen werf, bestaande toestand vóór de werken,
              opmeting — of geen enkele camerafoto. “Onzeker” is wat er tussenin valt. Een gevel in
              de steigers is nee, en een mapnaam als “4. Foto’s oplevering” is op zichzelf nooit
              genoeg voor een ja.
            </p>
            <p className="lede" style={{ fontSize: 13, marginTop: 8 }}>
              Uitkomst: {num(s.inBeeld)} ja, {num(s.nietInBeeld)} nee, {num(s.onzeker)} onzeker.
              {" "}{num(s.zonderCamerafoto)} projecten hebben geen enkele camerafoto in de map.
              De knop “Te fotograferen” zet nee en onzeker samen, zonder de opgezegde dossiers:{" "}
              {num(s.teFotograferen)} projecten.
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
            {bron.beoordeling && (
              <p className="lede" style={{ fontSize: 13, marginTop: 8 }}>
                De beeldbeoordeling dateert van {datum(bron.beoordeling.datum)} en is gemaakt met
                scripts/h-architects-oplevering.py: de Dropbox opnieuw doorlopen, de camerafoto’s
                eruit gehaald, van elk project de drie recentste als thumbnail opgehaald en op{" "}
                {num(bron.beoordeling.contactbladen ?? 0)} contactbladen bekeken
                {bron.beoordeling.thumbnails
                  ? ` (${num(bron.beoordeling.thumbnails)} thumbnails)`
                  : ""}
                . De contactbladen zelf staan buiten de repo; ze bevatten klantmateriaal.
              </p>
            )}
            <p className="notitie let" style={{ marginTop: 10 }}>
              Deze telling is een momentopname en ververst zichzelf niet. Draai
              scripts/h-architects-projecten.py opnieuw na een nieuwe Dropbox-doorloop en daarna
              scripts/h-architects-oplevering.py voor de beoordeling. De lijst bevat klant- en
              medewerkersnamen in de mapnamen en blijft daarom binnen dit dashboard, achter de
              login.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
