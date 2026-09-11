import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { headers } from "next/headers";
import { afdelingenVoor, AFDELING_VAN_PAD } from "@/lib/toegang";

export const metadata: Metadata = {
  title: "Sales & Marketing Dashboard",
  description: "Pipedrive & Google Ads data op één plek",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // De zijbalk moet weten welke afdelingen open staan. Dat wordt hier aan de
  // serverkant bepaald uit de forward-auth-header; de browser krijgt alleen de
  // uitkomst. middleware.ts bewaakt de adressen zelf.
  const toegestaan = afdelingenVoor((await headers()).get("x-authentik-groups"));
  const paden = Object.entries(AFDELING_VAN_PAD)
    .filter(([, afdeling]) => toegestaan.has(afdeling))
    .map(([pad]) => pad);
  return (
    <html lang="nl" className="h-full antialiased">
      <head>
        {/* Lettertypen van de huisstijl (Newsreader + Instrument Sans), zie app/glas.css */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=Instrument+Sans:wght@400;500;600&display=swap"
        />
      </head>
      <body className="min-h-full">
        <div className="scene" aria-hidden="true">
          <i className="b1" />
          <i className="b2" />
          <i className="b3" />
          <i className="b4" />
        </div>
        <div className="app-sales">
          <Sidebar afdelingen={paden} />
          <div className="min-w-0">{children}</div>
        </div>
      </body>
    </html>
  );
}
