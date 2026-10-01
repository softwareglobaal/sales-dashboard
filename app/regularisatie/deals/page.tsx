import { DienstPagina } from "@/components/dienst/DienstPagina";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; firma?: string; status?: string; reden?: string }>;
}) {
  return <DienstPagina pad="regularisatie" tab="deals" searchParams={await searchParams} />;
}
