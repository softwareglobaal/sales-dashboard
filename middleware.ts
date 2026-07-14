import { NextRequest, NextResponse } from "next/server";

// Alleen-lezen-vergrendeling (2026-07-14): kijkers zoals Joey en Shelton
// mogen filteren en lezen, maar geen wijzigingen maken. Alles wat geen
// GET/HEAD is op de API (notities, sync, AI-analyse) vereist een naam uit
// EDITOR_USERS. De identiteit komt uit de forward-auth-header van het
// platform; de app zelf heeft bewust geen login.
const EDITORS = (process.env.EDITOR_USERS || "akadmin,mehdi,siyan")
  .split(",")
  .map((u) => u.trim().toLowerCase())
  .filter(Boolean);

export function middleware(req: NextRequest) {
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

export const config = { matcher: "/api/:path*" };
