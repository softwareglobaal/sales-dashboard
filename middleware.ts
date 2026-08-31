import { NextRequest, NextResponse } from "next/server";
import { magPad } from "@/lib/toegang";

// Twee sloten, allebei op basis van de forward-auth-header van het platform;
// de app zelf heeft bewust geen eigen login.
//
// 1. Alleen-lezen-vergrendeling (2026-07-14): kijkers zoals Joey en Shelton
//    mogen filteren en lezen, maar geen wijzigingen maken. Alles wat geen
//    GET/HEAD is op de API vereist een naam uit EDITOR_USERS.
//
// 2. Toegang per afdeling (2026-08-28): wie geen `wp-<afdeling>` of `wp-alles`
//    heeft, komt niet bij de gegevens van die afdeling -- niet via de pagina en
//    niet via de API. Tot nu toe zag iedereen die door de login kwam alles.
const EDITORS = (process.env.EDITOR_USERS || "akadmin,mehdi,siyan")
  .split(",")
  .map((u) => u.trim().toLowerCase())
  .filter(Boolean);

export function middleware(req: NextRequest) {
  const groepen = req.headers.get("x-authentik-groups");
  const pad = req.nextUrl.pathname;

  // De API draagt dezelfde afdelingen als de pagina's: /api/energy/... telt als
  // /energy. Zonder deze regel zou het slot alleen op de voorkant zitten.
  const teToetsen = pad.startsWith("/api/") ? pad.slice(4) : pad;

  if (!magPad(teToetsen, groepen)) {
    if (pad.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Geen toegang tot deze afdeling." },
        { status: 403 },
      );
    }
    return NextResponse.rewrite(new URL("/geen-toegang", req.url), { status: 403 });
  }

  if (req.method === "GET" || req.method === "HEAD") {
    return NextResponse.next();
  }
  const wie = (req.headers.get("x-authentik-username") || "").toLowerCase();
  if (!EDITORS.includes(wie)) {
    return NextResponse.json(
      { error: "Alleen-lezen account: wijzigingen zijn hier niet toegestaan." },
      { status: 403 },
    );
  }
  return NextResponse.next();
}

// Alles behalve de statische bestanden van Next en het pictogram.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|geen-toegang).*)"],
};
