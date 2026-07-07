import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Zelfstandige server-output (server.js + getracede node_modules) voor de Docker-image.
  output: "standalone",
  // better-sqlite3 is een native module: niet bundelen, maar als extern pakket mee tracen.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
