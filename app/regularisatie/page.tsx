import { UnderConstruction } from "@/components/UnderConstruction";

export const dynamic = "force-dynamic";

// De afdelingspagina zelf wacht op een salesbron: regularisatiedossiers lopen
// nu nog door de H-Architects-pipeline zonder eigen label. De concurrentiemonitor
// eronder (/regularisatie/concurrentie) draait wel al.
export default function Page() {
  return <UnderConstruction title="Regularisatie" />;
}
