import { redirect } from "next/navigation";

// De tab heette tot 13 okt 2026 "Architecten"; sinds ook ingenieurs en studiebureaus erin
// staan heet hij "Opdrachtgevers". Oude links (/architecten#mv2) blijven werken.
export default function Page() {
  redirect("/opdrachtgevers");
}
