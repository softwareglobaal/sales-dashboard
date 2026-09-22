// IP -> land, regio, gemeente voor de websitemeting (spec §15).
//
// Bron: DB-IP "IP to City Lite" (CC BY 4.0, maandelijks vernieuwd, geen sleutel nodig).
// Het bestand is ~130 MB. De bekende lezer (`maxmind`) laadt het volledig in het
// geheugen; op deze server (swap vol) is dat niet verantwoord. Deze lezer leest
// daarom rechtstreeks uit het bestand met pread en houdt alleen een kleine
// paginacache bij. Formaat: https://maxmind.github.io/MaxMind-DB/
//
// Nauwkeurigheid: IP-locatie is op gemeenteniveau een schatting. In België wijst
// een deel van de mobiele en sommige vaste verbindingen naar het knooppunt van de
// provider (vaak Brussel of Antwerpen). Land en provincie zijn betrouwbaar,
// de gemeente is een indicatie. Fijner dan gemeente kan niet zonder de bezoeker
// om zijn locatie te vragen.

import fs from "fs";
import path from "path";
import zlib from "zlib";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

const MAP = path.join(process.cwd(), "data", "geo");
const BESTAND = path.join(MAP, "dbip-city-lite.mmdb");
const MAX_LEEFTIJD_MS = 35 * 24 * 3600 * 1000;

export type Geo = {
  land: string | null; // ISO-code, bv. BE
  regio: string | null; // eerste bestuurlijke laag, bv. Flanders
  provincie: string | null;
  stad: string | null;
  lat: number | null;
  lon: number | null;
};

const PAGINA = 4096;

class MmdbLezer {
  private fd: number;
  private cache = new Map<number, Buffer>();
  private nodeCount: number;
  private recordSize: number;
  private nodeBytes: number;
  private treeSize: number;
  private dataStart: number;
  private ipv4Start = 0;

  constructor(bestand: string) {
    this.fd = fs.openSync(bestand, "r");
    const grootte = fs.fstatSync(this.fd).size;
    const staart = Math.min(grootte, 128 * 1024);
    const buf = Buffer.alloc(staart);
    fs.readSync(this.fd, buf, 0, staart, grootte - staart);
    const marker = Buffer.from([0xab, 0xcd, 0xef, ...Buffer.from("MaxMind.com")]);
    const pos = buf.lastIndexOf(marker);
    if (pos < 0) throw new Error("Geen geldig MMDB-bestand");
    const metaStart = grootte - staart + pos + marker.length;
    const meta = this.decodeer(metaStart, metaStart).waarde as Record<string, unknown>;
    this.nodeCount = Number(meta.node_count);
    this.recordSize = Number(meta.record_size);
    this.nodeBytes = (this.recordSize * 2) / 8;
    this.treeSize = this.nodeCount * this.nodeBytes;
    this.dataStart = this.treeSize + 16;
    if (Number(meta.ip_version) === 6) {
      let node = 0;
      for (let i = 0; i < 96 && node < this.nodeCount; i++) node = this.record(node, 0);
      this.ipv4Start = node;
    }
  }

  private byte(off: number): number {
    const p = Math.floor(off / PAGINA);
    let blok = this.cache.get(p);
    if (!blok) {
      blok = Buffer.alloc(PAGINA);
      fs.readSync(this.fd, blok, 0, PAGINA, p * PAGINA);
      if (this.cache.size > 3000) this.cache.delete(this.cache.keys().next().value as number);
      this.cache.set(p, blok);
    }
    return blok[off - p * PAGINA];
  }

  private bytes(off: number, n: number): Buffer {
    const b = Buffer.alloc(n);
    for (let i = 0; i < n; i++) b[i] = this.byte(off + i);
    return b;
  }

  private record(node: number, bit: number): number {
    const o = node * this.nodeBytes;
    const b = (i: number) => this.byte(o + i);
    if (this.recordSize === 24) {
      return bit === 0 ? (b(0) << 16) | (b(1) << 8) | b(2) : (b(3) << 16) | (b(4) << 8) | b(5);
    }
    if (this.recordSize === 28) {
      return bit === 0
        ? ((b(3) >> 4) & 0x0f) * 0x1000000 + ((b(0) << 16) | (b(1) << 8) | b(2))
        : (b(3) & 0x0f) * 0x1000000 + ((b(4) << 16) | (b(5) << 8) | b(6));
    }
    return bit === 0
      ? this.bytes(o, 4).readUInt32BE(0)
      : this.bytes(o + 4, 4).readUInt32BE(0);
  }

  private decodeer(off: number, basis: number): { waarde: unknown; volgende: number } {
    const ctrl = this.byte(off++);
    let type = ctrl >> 5;
    if (type === 1) {
      const s = (ctrl >> 3) & 3, v = ctrl & 7;
      let p: number;
      if (s === 0) p = (v << 8) | this.byte(off);
      else if (s === 1) p = ((v << 16) | (this.byte(off) << 8) | this.byte(off + 1)) + 2048;
      else if (s === 2) p = (v * 0x1000000 + ((this.byte(off) << 16) | (this.byte(off + 1) << 8) | this.byte(off + 2))) + 526336;
      else p = this.bytes(off, 4).readUInt32BE(0);
      return { waarde: this.decodeer(basis + p, basis).waarde, volgende: off + s + 1 };
    }
    if (type === 0) type = 7 + this.byte(off++);
    let grootte = ctrl & 0x1f;
    if (grootte === 29) grootte = 29 + this.byte(off++);
    else if (grootte === 30) { grootte = 285 + ((this.byte(off) << 8) | this.byte(off + 1)); off += 2; }
    else if (grootte === 31) { grootte = 65821 + ((this.byte(off) << 16) | (this.byte(off + 1) << 8) | this.byte(off + 2)); off += 3; }

    const uint = () => {
      let n = 0;
      for (let i = 0; i < grootte; i++) n = n * 256 + this.byte(off + i);
      return n;
    };
    switch (type) {
      case 2: return { waarde: this.bytes(off, grootte).toString("utf8"), volgende: off + grootte };
      case 3: return { waarde: this.bytes(off, 8).readDoubleBE(0), volgende: off + 8 };
      case 4: return { waarde: this.bytes(off, grootte), volgende: off + grootte };
      case 5: case 6: case 9: case 10: return { waarde: uint(), volgende: off + grootte };
      case 8: return { waarde: grootte ? this.bytes(off, grootte).readIntBE(0, Math.min(grootte, 6)) : 0, volgende: off + grootte };
      case 7: {
        const m: Record<string, unknown> = {};
        for (let i = 0; i < grootte; i++) {
          const k = this.decodeer(off, basis);
          const w = this.decodeer(k.volgende, basis);
          m[String(k.waarde)] = w.waarde;
          off = w.volgende;
        }
        return { waarde: m, volgende: off };
      }
      case 11: {
        const a: unknown[] = [];
        for (let i = 0; i < grootte; i++) {
          const w = this.decodeer(off, basis);
          a.push(w.waarde);
          off = w.volgende;
        }
        return { waarde: a, volgende: off };
      }
      case 14: return { waarde: grootte !== 0, volgende: off };
      case 15: return { waarde: this.bytes(off, 4).readFloatBE(0), volgende: off + 4 };
      default: return { waarde: null, volgende: off + grootte };
    }
  }

  zoek(ip: string): Record<string, unknown> | null {
    const bits = ipBits(ip);
    if (!bits) return null;
    let node = bits.length === 32 ? this.ipv4Start : 0;
    for (let i = 0; i < bits.length && node < this.nodeCount; i++) node = this.record(node, bits[i]);
    if (node <= this.nodeCount) return null;
    const off = this.treeSize + (node - this.nodeCount);
    return this.decodeer(off, this.dataStart).waarde as Record<string, unknown>;
  }
}

function ipBits(ip: string): number[] | null {
  const v4 = ip.replace(/^::ffff:/i, "");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) {
    const bits: number[] = [];
    for (const d of v4.split(".").map(Number)) for (let i = 7; i >= 0; i--) bits.push((d >> i) & 1);
    return bits;
  }
  if (!ip.includes(":")) return null;
  const [kop, staart] = ip.split("::");
  const a = kop ? kop.split(":") : [];
  const b = staart !== undefined && staart ? staart.split(":") : [];
  const groepen = [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill("0"), ...b];
  if (groepen.length !== 8) return null;
  const bits: number[] = [];
  for (const g of groepen) {
    const n = parseInt(g || "0", 16);
    for (let i = 15; i >= 0; i--) bits.push((n >> i) & 1);
  }
  return bits;
}

let lezer: MmdbLezer | null = null;
let bezig = false;
let laatsteFout: string | null = null;

async function download() {
  if (bezig) return;
  bezig = true;
  try {
    fs.mkdirSync(MAP, { recursive: true });
    const nu = new Date();
    const maanden = [0, 1].map((terug) => {
      const d = new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth() - terug, 1));
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    });
    for (const m of maanden) {
      const res = await fetch(`https://download.db-ip.com/free/dbip-city-lite-${m}.mmdb.gz`);
      if (!res.ok || !res.body) continue;
      const tmp = BESTAND + ".nieuw";
      await pipeline(Readable.fromWeb(res.body as never), zlib.createGunzip(), fs.createWriteStream(tmp));
      fs.renameSync(tmp, BESTAND);
      lezer = null;
      laatsteFout = null;
      return;
    }
    laatsteFout = "DB-IP-bestand niet gevonden voor " + maanden.join(" / ");
  } catch (e) {
    laatsteFout = e instanceof Error ? e.message : String(e);
  } finally {
    bezig = false;
  }
}

/** Status voor de pagina: staat de locatiedatabank klaar? */
export function geoStatus(): { klaar: boolean; fout: string | null; datum: string | null } {
  try {
    const st = fs.statSync(BESTAND);
    return { klaar: true, fout: laatsteFout, datum: st.mtime.toISOString().slice(0, 10) };
  } catch {
    return { klaar: false, fout: laatsteFout, datum: null };
  }
}

/** Zoekt de locatie op. Start de download als het bestand ontbreekt of verouderd is. */
export function zoekGeo(ip: string): Geo | null {
  let st: fs.Stats | null = null;
  try {
    st = fs.statSync(BESTAND);
  } catch {}
  if (!st || Date.now() - st.mtimeMs > MAX_LEEFTIJD_MS) void download();
  if (!st) return null;
  try {
    if (!lezer) lezer = new MmdbLezer(BESTAND);
    const r = lezer.zoek(ip) as {
      country?: { iso_code?: string };
      subdivisions?: { names?: Record<string, string> }[];
      city?: { names?: Record<string, string> };
      location?: { latitude?: number; longitude?: number };
    } | null;
    if (!r) return null;
    const naam = (n?: Record<string, string>) => (n ? n.nl || n.en || Object.values(n)[0] || null : null);
    return {
      land: r.country?.iso_code || null,
      regio: naam(r.subdivisions?.[0]?.names),
      provincie: naam(r.subdivisions?.[1]?.names),
      stad: naam(r.city?.names),
      lat: r.location?.latitude ?? null,
      lon: r.location?.longitude ?? null,
    };
  } catch (e) {
    laatsteFout = e instanceof Error ? e.message : String(e);
    lezer = null;
    return null;
  }
}
