import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { headers } from "next/headers";
import { afdelingenVoor, AFDELING_VAN_PAD } from "@/lib/toegang";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
    <html
      lang="nl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#d7dde7] text-zinc-900">
        <div className="flex min-h-screen">
          <Sidebar afdelingen={paden} />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </body>
    </html>
  );
}
