#!/usr/bin/env python3
"""
Het architectenregister ophalen en klaarzetten -- Orde van Architecten, Vlaamse Raad.

Eenmalig werk, geen onderdeel van de draaiende app: het bronbestand wordt met de
hand ververst, net als dat van VEKA. Zie data-bronnen/README-architecten.md voor
de methode, de afspraken en de beperkingen.

    python3 scripts/architecten-register.py sitemap    # profiel-URL's ophalen
    python3 scripts/architecten-register.py ophalen    # elke profielpagina lezen (hervatbaar)
    python3 scripts/architecten-register.py exporteren # bronbestand schrijven

Eerlijk gedrag, en dat is geen vrijblijvende opmerking:
  - eigen User-Agent met contactdomein
  - robots.txt van vind.architect.be staat alles toe (lege Disallow, geen crawl-delay)
  - de lijst komt uit hun eigen sitemap, niet uit geraden URL's
  - pauze tussen de verzoeken, en hervatbaar zodat een herstart niets herhaalt
  - alleen lezen: geen formulier, geen login, geen omzeiling van blokkades
"""

import json, os, re, sys, threading, time, queue, html
import urllib.request, urllib.error

UA = "Mozilla/5.0 (compatible; HArchitectsConcurrentieMonitor/1.0; +https://h-architects.be)"
PAUZE = 0.5
WERKERS = 5

HIER = os.path.dirname(os.path.abspath(__file__))
WERKMAP = os.path.join(HIER, "..", "data-bronnen", ".architecten-werk")
LIJST = os.path.join(WERKMAP, "profielen.txt")
UIT = os.path.join(WERKMAP, "architecten-ruw.ndjson")
SITEMAP = "https://vind.architect.be/sitemap.xml"

VELD = re.compile(
    r"<dt[^>]*>\s*([^<]{1,40}?)\s*</dt>\s*<dd[^>]*>([\s\S]*?)</dd>", re.I
)


def tekst(s: str) -> str:
    s = re.sub(r"<(script|style|svg)[^>]*>[\s\S]*?</\1>", " ", s)
    s = re.sub(r"<br\s*/?>", " | ", s)
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def haal(url, pogingen=3):
    for p in range(pogingen):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code in (404, 410):
                return None
            time.sleep(2 + p * 3)
        except Exception:
            time.sleep(2 + p * 3)
    return None


def ontleed(url: str, h: str) -> dict:
    stam = url.rsplit("/", 1)[-1]
    # Het inhoudsblok begint bij de kruimelpad-link naar het profiel zelf.
    i = h.find("<main")
    kern = h[i:] if i > 0 else h
    j = kern.find("Gemaakt door Rekall")
    if j > 0:
        kern = kern[:j]

    naam = ""
    m = re.search(r"<h1[^>]*>([\s\S]*?)</h1>", kern)
    if m:
        naam = tekst(m.group(1))

    # De site merkt de contactgegevens van het lid zelf met data-contact-type.
    # Dat is betrouwbaarder dan elke mailto/href van de pagina meepakken: de
    # voettekst bevat het adres van de Orde zelf.
    contact = {}
    for a in re.findall(r'<a\b[^>]*data-contact-type="([a-z]+)"[^>]*href="([^"]+)"', kern):
        contact.setdefault(a[0], a[1])
    for a in re.findall(r'<a\b[^>]*href="([^"]+)"[^>]*data-contact-type="([a-z]+)"', kern):
        contact.setdefault(a[1], a[0])

    email = contact.get("email", "").replace("mailto:", "").split("?")[0].strip()
    telefoon = (contact.get("phone") or contact.get("mobile") or "").replace("tel:", "").strip()
    site = contact.get("website", "").strip()

    velden = {}
    for k, v in VELD.findall(kern):
        velden[tekst(k).rstrip(":").lower()] = tekst(v)

    # Het adres staat niet in de dl maar in een eigen blok onder <h2>Adres</h2>.
    adres = ""
    ma = re.search(r"<h2[^>]*>\s*Adres\s*</h2>([\s\S]{0,600}?)</div>", kern, re.I)
    if ma:
        regels = [tekst(p) for p in re.findall(r"<p[^>]*>([\s\S]*?)</p>", ma.group(1))]
        adres = " | ".join(r for r in regels if r)

    postcode, gemeente, straat = "", "", ""
    # laatste regel is "3000 Leuven"; alles daarvoor is straat en busnummer
    mm = re.search(r"\b([1-9]\d{3})\s+([A-Za-zÀ-ÿ][^|]*)$", adres)
    if mm:
        postcode = mm.group(1)
        gemeente = mm.group(2).strip(" |")
        straat = adres[: mm.start()].strip(" |")
    else:
        straat = adres

    vennoten = []
    mv = re.search(r"<h2[^>]*>\s*Vennoten\s*</h2>([\s\S]*?)\n\s*</div>\s*</div>", kern, re.I)
    if mv:
        vennoten = re.findall(r'href="/[a-z0-9-]+/([AB]\d{6})"', mv.group(1))

    return {
        "stamnummer": stam,
        "url": url,
        "naam": naam,
        "email": email,
        "telefoon": telefoon,
        "website": site,
        "straat": straat,
        "postcode": postcode,
        "gemeente": gemeente,
        "tabel": velden.get("tabel", ""),
        "type": velden.get("type", ""),
        "rechtsvorm": velden.get("rechtsvorm", ""),
        "vennoten": vennoten,
        "adres_ruw": adres,
    }


def ophalen():
    os.makedirs(WERKMAP, exist_ok=True)
    if not os.path.exists(LIJST):
        raise SystemExit("draai eerst: architecten-register.py sitemap")
    urls = [l.strip() for l in open(LIJST) if l.strip()]
    # Rechtspersonen (B) eerst: dat zijn de bureaus, en dus de eigenlijke markt.
    urls.sort(key=lambda u: (0 if re.search(r"/B\d{6}$", u) else 1, u))

    gedaan = set()
    if os.path.exists(UIT):
        for l in open(UIT):
            try:
                gedaan.add(json.loads(l)["stamnummer"])
            except Exception:
                pass
    todo = [u for u in urls if u.rsplit("/", 1)[-1] not in gedaan]
    print(f"{len(urls)} profielen, {len(gedaan)} al opgehaald, {len(todo)} te gaan", flush=True)

    q = queue.Queue()
    for u in todo:
        q.put(u)
    slot = threading.Lock()
    uit = open(UIT, "a", encoding="utf8")
    teller = {"n": len(gedaan), "fout": 0}

    def werker():
        while True:
            try:
                u = q.get_nowait()
            except queue.Empty:
                return
            t0 = time.time()
            h = haal(u)
            if h is None:
                with slot:
                    teller["fout"] += 1
            else:
                r = ontleed(u, h)
                with slot:
                    uit.write(json.dumps(r, ensure_ascii=False) + "\n")
                    teller["n"] += 1
                    if teller["n"] % 250 == 0:
                        uit.flush()
                        print(f"  {teller['n']} opgehaald, {teller['fout']} fout", flush=True)
            rest = PAUZE - (time.time() - t0)
            if rest > 0:
                time.sleep(rest)

    draden = [threading.Thread(target=werker, daemon=True) for _ in range(WERKERS)]
    for d in draden:
        d.start()
    for d in draden:
        d.join()
    uit.close()
    print(f"KLAAR: {teller['n']} profielen, {teller['fout']} fout", flush=True)



from collections import Counter

BRONBESTAND = os.path.join(HIER, "..", "data-bronnen", "architecten-orde-2026-09.json")
OPGEHAALD = "2026-09-09"

# Gratis e-mailproviders: daar staat geen bedrijfssite achter, dus zo'n domein
# zegt niets over de zichtbaarheid van dat bureau. Zelfde lijst-gedachte als bij
# het VEKA-register.
GRATIS = {
    "telenet.be", "skynet.be", "gmail.com", "gmail.be", "googlemail.com",
    "hotmail.com", "hotmail.be", "hotmail.fr", "outlook.com", "outlook.be",
    "live.be", "live.com", "live.nl", "msn.com", "yahoo.com", "yahoo.fr",
    "yahoo.co.uk", "icloud.com", "me.com", "mac.com", "aol.com", "mail.com",
    "gmx.net", "gmx.com", "gmx.be", "proximus.be", "scarlet.be", "base.be",
    "belgacom.net", "pandora.be", "edpnet.be", "voo.be", "online.be",
    "dommel.be", "yucom.be", "fulladsl.be", "busmail.net", "protonmail.com",
    "proton.me", "pt.lu", "orange.be", "mobistar.be", "tiscali.be",
    "chello.be", "advalvas.be", "planetinternet.be", "village.uunet.be",
}

# Sociale profielen zijn geen website. Wie alleen Instagram opgeeft, valt terug
# op zijn e-maildomein -- en anders op niets, en dat is dan ook het antwoord.
SOCIAAL = {
    "instagram.com", "facebook.com", "linkedin.com", "youtube.com", "twitter.com",
    "x.com", "pinterest.com", "tiktok.com", "behance.net", "houzz.com",
    "houzz.be", "vimeo.com", "issuu.com", "archdaily.com", "architectura.be",
}


def gastheer(url: str) -> str:
    h = re.sub(r"^https?://", "", (url or "").strip().lower())
    h = h.split("/")[0].split("?")[0].split("#")[0].split(":")[0]
    h = h.rstrip(".")
    if h.startswith("www."):
        h = h[4:]
    return h


def is_sociaal(h: str) -> bool:
    return any(h == s or h.endswith("." + s) for s in SOCIAAL)


def leid_domein_af(website: str, email: str) -> str:
    h = gastheer(website)
    if h and not is_sociaal(h) and "." in h:
        return h
    if email and "@" in email:
        d = email.split("@")[-1].strip().lower().rstrip(".")
        if d.startswith("www."):
            d = d[4:]
        if d and d not in GRATIS and not is_sociaal(d) and "." in d:
            return d
    return ""


SOORT = {"Rechtspersoon": "vennootschap", "Natuurlijke persoon": "persoon"}


def exporteren():
    records = []
    gezien = set()
    for regel in open(UIT, encoding="utf8"):
        r = json.loads(regel)
        if r["stamnummer"] in gezien:
            continue
        gezien.add(r["stamnummer"])
        records.append({
            "stamnummer": r["stamnummer"],
            "naam": r["naam"],
            "soort": SOORT.get(r["type"], ""),
            "rechtsvorm": r["rechtsvorm"],
            "straat": r["straat"],
            "postcode": r["postcode"],
            "gemeente": r["gemeente"],
            "provincie": r["tabel"],
            "telefoon": r["telefoon"],
            "email": r["email"],
            "website": r["website"],
            "domein": leid_domein_af(r["website"], r["email"]),
            "profiel_url": r["url"],
            "vennoten": r.get("vennoten") or [],
        })

    records.sort(key=lambda r: (r["provincie"], r["gemeente"], r["naam"]))

    prov = Counter(r["provincie"] or "onbekend" for r in records)
    soort = Counter(r["soort"] or "onbekend" for r in records)
    domeinen = {r["domein"] for r in records if r["domein"]}

    uit = {
        "bron": "Orde van Architecten — Vlaamse Raad, publiek ledenregister",
        "bron_url": "https://vind.architect.be",
        "opgehaald": OPGEHAALD,
        "methode": (
            "Alle profiel-URL's uit de eigen sitemap van vind.architect.be, daarna elke "
            "profielpagina één keer opgehaald met een eigen User-Agent. robots.txt van die "
            "site staat crawlen volledig toe (Disallow leeg). Alleen lezen: geen zoekformulier, "
            "geen login, geen omzeiling van blokkades."
        ),
        "beperkingen": (
            "Inschrijvingen uit de reeks 9xxxxx (recente en buitenlandse vennootschappen) hebben "
            "bij de Orde zelf geen adres en dus geen provincie of gemeente. De provincie is de "
            "tabel waarop iemand ingeschreven staat, niet noodzakelijk waar hij werkt. Een "
            "domein is afgeleid uit de opgegeven website, en anders uit het e-maildomein zolang "
            "dat geen gratis provider is."
        ),
        "aantallen": {
            "inschrijvingen": len(records),
            "per_provincie": dict(prov.most_common()),
            "per_soort": dict(soort.most_common()),
            "met_website": sum(1 for r in records if r["website"]),
            "met_domein": sum(1 for r in records if r["domein"]),
            "unieke_domeinen": len(domeinen),
            "zonder_provincie": prov.get("onbekend", 0),
        },
        "records": records,
    }
    with open(BRONBESTAND, "w", encoding="utf8") as f:
        json.dump(uit, f, ensure_ascii=False, indent=1)
    print(json.dumps(uit["aantallen"], ensure_ascii=False, indent=1))
    print("geschreven naar", BRONBESTAND)




# ---------------------------------------------------------------------------
def sitemap():
    """De profiel-URL's uit de eigen sitemap van de Orde. 11.965 stuks in sep 2026."""
    os.makedirs(WERKMAP, exist_ok=True)
    xml = haal(SITEMAP)
    if xml is None:
        raise SystemExit("sitemap niet op te halen")
    locs = re.findall(r"<loc>(https://vind\.architect\.be/[^<]+)</loc>", xml)
    prof = [l for l in locs if re.search(r"/[AB]\d{6}$", l)]
    with open(LIJST, "w", encoding="utf8") as f:
        f.write("\n".join(prof))
    print(f"{len(prof)} profiel-URL's in {LIJST}")


if __name__ == "__main__":
    stap = sys.argv[1] if len(sys.argv) > 1 else ""
    if stap == "sitemap":
        sitemap()
    elif stap == "ophalen":
        ophalen()
    elif stap == "exporteren":
        exporteren()
    else:
        raise SystemExit(__doc__)
