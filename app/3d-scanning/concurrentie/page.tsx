import { DienstPagina } from "@/components/dienst/DienstPagina";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <DienstPagina pad="3d-scanning" tab="concurrentie" searchParams={{}} />;
}
