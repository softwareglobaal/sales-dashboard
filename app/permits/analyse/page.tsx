import { DienstPagina } from "@/components/dienst/DienstPagina";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; firma?: string; rs?: string }>;
}) {
  return <DienstPagina pad="permits" tab="analyse" searchParams={await searchParams} />;
}
