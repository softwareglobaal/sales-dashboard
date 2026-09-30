import { DienstPagina } from "@/components/dienst/DienstPagina";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ periode?: string; firma?: string }> }) {
  return <DienstPagina pad="engineering" tab="overzicht" searchParams={await searchParams} />;
}
