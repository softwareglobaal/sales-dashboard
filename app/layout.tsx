import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { aantalWachtend } from "@/lib/content";
import { introGezien, HANDLEIDING } from "@/lib/intro";
import { IntroVraag } from "@/components/intro/IntroVraag";
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
  const h = await headers();
  const toegestaan = afdelingenVoor(h.get("x-authentik-groups"));
  // Introductievraag: enkel bij de eerste bezoek van een gebruiker (lib/intro.ts).
  const gebruiker = h.get("x-authentik-username") || (process.env.TOEGANG_DEV === "1" ? "lokaal" : "");
  const toonIntro = !!gebruiker && !introGezien(gebruiker);
  const voornaam = (h.get("x-authentik-name") || "").split(" ")[0];
  const paden = Object.entries(AFDELING_VAN_PAD)
    .filter(([, afdeling]) => toegestaan.has(afdeling))
    .map(([pad]) => pad);
  return (
    <html lang="nl" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Thema vóór de eerste weergave: eigen keuze (localStorage), anders het toestel. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('thema');if(t!=='donker'&&t!=='licht'){t=matchMedia('(prefers-color-scheme: dark)').matches?'donker':'licht'}document.documentElement.dataset.thema=t}catch(e){document.documentElement.dataset.thema='licht'}",
          }}
        />
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
          <Sidebar afdelingen={paden} wachtend={aantalWachtend()} />
          <div className="min-w-0">{children}</div>
          {toonIntro && <IntroVraag naam={voornaam} handleiding={HANDLEIDING} />}
        </div>
      </body>
    </html>
  );
}
