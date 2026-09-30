import { DienstPagina } from "@/components/dienst/DienstPagina";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <DienstPagina pad="plaatsbeschrijving" tab="concurrentie" searchParams={{}} />;
}
