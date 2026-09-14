#!/usr/bin/env python3
"""
Opleveringsfoto's van H-Architects: camerafoto's onderscheiden van tekenwerk en
per project beoordelen of het afgewerkte gebouw echt in beeld staat.

Aanleiding (feedback Mehdi/Siyan, 14 september 2026): de kolom "foto's aanwezig"
telde elk beeldbestand in de projectmap -- plannen, schermafdrukken, scans -- en
de kolom "opleveringsfoto's" keek alleen naar mapnamen (oplevering/completion/na).
Dat gaf 18 projecten en zegt niets over wat er op de foto staat. Mehdi wil weten
van welke gebouwen er een foto van het *afgewerkte* resultaat bestaat, zodat hij
de rest kan gaan fotograferen.

Het script is herhaalbaar en werkt in vier stappen:

    python3 scripts/h-architects-oplevering.py haal      # Dropbox doorlopen -> cache
    python3 scripts/h-architects-oplevering.py kies      # indelen + 3 recentste kiezen
    python3 scripts/h-architects-oplevering.py bladen    # thumbnails + contactbladen
    python3 scripts/h-architects-oplevering.py verwerk   # oordelen in de JSON zetten

Stap "haal" en "bladen" praten met de Dropbox-API (alleen-lezen, refresh-token uit
~/Claude/credentials.env, teamruimte als pad-wortel). Stap "kies" en "verwerk"
werken offline op de cache.

De cache, de thumbnails en de contactbladen staan buiten de repo (standaard onder
~/.cache/h-architects-oplevering, of --cache). Ze horen niet in git: er staan
klant- en medewerkersnamen in de paden en de beelden zijn klantmateriaal.

De beoordeling zelf gebeurt niet door dit script maar met het oog, op de
contactbladen; de uitkomst komt in oordelen.json (nummer -> ja/nee/onzeker +
bestand) en wordt door "verwerk" in de dashboard-JSON geschreven.
"""

import argparse, base64, concurrent.futures as cf, json, os, pathlib, re, sys, time
import urllib.error, urllib.parse, urllib.request

HIER = pathlib.Path(__file__).resolve().parent
REPO = HIER.parent
JSON_UIT = REPO / "data-bronnen" / "h-architects-projecten-2026-09-14.json"
CRED = pathlib.Path.home() / "Claude" / "credentials.env"
STANDAARD_CACHE = pathlib.Path.home() / ".cache" / "h-architects-oplevering"

API = "https://api.dropboxapi.com/2"
CONTENT = "https://content.dropboxapi.com/2"

# De mappen waarin het projectwerk staat (zelfde lijst als de telling van 14 sep).
WORTELS = [
    "/Work All/01. H-A WORK/0 Archive",
    "/Work All/01. H-A WORK/0 H-A Light projects",
    "/Work All/01. H-A WORK/0 H-A Standaard projects",
    "/Work All/01. H-A WORK/H-A New Projects(All)",
    "/Work All/01. H-A WORK/Nog te sorteren",
    "/Work All/01. H-A WORK/Overname project",
    "/Work All/01. H-A WORK/01. H-Architects Work",
    "/Work All/01. H-Architects ORG/0 H-A Contracts clients",
]

BEELD = (".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp")
# Een camerafoto is een cameraformaat (jpg/heic) zonder tekenwerk-woord in de naam.
CAMERA_EXT = (".jpg", ".jpeg", ".heic", ".heif")
# png is per definitie geen camerafoto: dat zijn uitsneden, plannen en schermbeelden.
TEKENWOORDEN = [
    "screenshot", "schermafbeelding", "schermafdruk", "screen shot", "scherm",
    "plan", "gevel", "snede", "doorsnede", "grondplan", "render", "3d",
    "pdf", "export", "pagina", "page ", "_page", "-page", "layout", "detail",
    "logo", "scan", "inplanting", "terrein", "kadaster", "gbg", "situatie",
]
# Uitzonderingen: deze woorden bevatten wel een tekenwoord maar zijn gewoon foto's.
GEEN_TEKENWOORD = ["bijgeknipt", "planten", "plantsoen", "plankenvloer"]

PROJECTNUMMER = re.compile(r"^(\d{4,5})[a-zA-Z]?(?=[\s._\-()]|$)")


# ---------------------------------------------------------------- Dropbox (lezen)
def _env():
    uit = {}
    for regel in CRED.read_text().splitlines():
        regel = regel.strip()
        if regel and not regel.startswith("#") and "=" in regel:
            k, v = regel.split("=", 1)
            uit[k.strip()] = v.strip().strip('"').strip("'")
    return uit


def token():
    e = _env()
    ontbreekt = [k for k in ("DROPBOX_APP_KEY", "DROPBOX_APP_SECRET", "DROPBOX_REFRESH_TOKEN")
                 if not e.get(k)]
    if ontbreekt:
        sys.exit(f"ontbreekt in {CRED}: {', '.join(ontbreekt)}")
    data = urllib.parse.urlencode({
        "grant_type": "refresh_token", "refresh_token": e["DROPBOX_REFRESH_TOKEN"],
        "client_id": e["DROPBOX_APP_KEY"], "client_secret": e["DROPBOX_APP_SECRET"]}).encode()
    with urllib.request.urlopen(urllib.request.Request(
            "https://api.dropboxapi.com/oauth2/token", data=data), timeout=30) as r:
        return json.loads(r.read().decode())["access_token"]


def wortel_namespace(tok):
    """De teamruimte als pad-wortel; zonder dit wijst "/" naar de persoonlijke map."""
    a = _post("/users/get_current_account", None, tok, None)
    return a["root_info"]["root_namespace_id"]


def _post(pad, body, tok, ns, basis=API, pogingen=5):
    for poging in range(1, pogingen + 1):
        req = urllib.request.Request(f"{basis}{pad}", data=json.dumps(body).encode(), method="POST")
        req.add_header("Authorization", f"Bearer {tok}")
        req.add_header("Content-Type", "application/json")
        if ns:
            req.add_header("Dropbox-API-Path-Root",
                           json.dumps({".tag": "namespace_id", "namespace_id": ns}))
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as f:
            tekst = f.read().decode(errors="replace")[:400]
            if f.code == 429 and poging < pogingen:
                time.sleep(5 * poging); continue
            if f.code >= 500 and poging < pogingen:
                time.sleep(3 * poging); continue
            raise RuntimeError(f"Dropbox {pad} {f.code}: {tekst}")
        except Exception:
            if poging == pogingen:
                raise
            time.sleep(2 * poging)


# ------------------------------------------------------------------- stap "haal"
def stap_haal(cache, alleen=None):
    """Elke wortelmap recursief doorlopen en alle beeldbestanden in een JSONL zetten."""
    tok = token()
    ns = wortel_namespace(tok)
    cache.mkdir(parents=True, exist_ok=True)
    wortels = [w for w in WORTELS if not alleen or alleen in w]

    def doorloop(wortel):
        regels, fouten = [], []
        try:
            d = _post("/files/list_folder",
                      {"path": wortel, "recursive": True, "limit": 2000,
                       "include_non_downloadable_files": False}, tok, ns)
        except RuntimeError as f:
            return [], [f"{wortel}: {f}"]
        while True:
            for e in d.get("entries", []):
                if e.get(".tag") != "file":
                    continue
                naam = e.get("name", "")
                if not naam.lower().endswith(BEELD):
                    continue
                regels.append(json.dumps({
                    "p": e.get("path_display") or e.get("path_lower"),
                    "m": e.get("client_modified"),
                    "s": e.get("server_modified"),
                    "b": e.get("size"),
                    "id": e.get("id"),
                }, ensure_ascii=False))
            if not d.get("has_more"):
                break
            try:
                d = _post("/files/list_folder/continue", {"cursor": d["cursor"]}, tok, ns)
            except RuntimeError as f:
                fouten.append(f"{wortel} (vervolg): {f}")
                break
        return regels, fouten

    alle, alle_fouten = [], []
    with cf.ThreadPoolExecutor(max_workers=4) as pool:
        for wortel, (regels, fouten) in zip(wortels, pool.map(doorloop, wortels)):
            print(f"  {wortel}: {len(regels)} beelden", flush=True)
            alle.extend(regels); alle_fouten.extend(fouten)

    uit = cache / "beelden.jsonl"
    uit.write_text("\n".join(alle) + "\n", encoding="utf-8")
    if alle_fouten:
        (cache / "haal-fouten.txt").write_text("\n".join(alle_fouten), encoding="utf-8")
    print(f"{uit}: {len(alle)} beeldbestanden, {len(alle_fouten)} fouten")


# ------------------------------------------------------------------- stap "kies"
def normaliseer(naam):
    return re.sub(r"[^a-z0-9]+", " ", naam.lower())


def is_camerafoto(naam):
    kaal = naam.lower()
    if not kaal.endswith(CAMERA_EXT):
        return False
    n = normaliseer(naam)
    for uitzondering in GEEN_TEKENWOORD:
        n = n.replace(uitzondering, " ")
    return not any(w.strip() in n for w in TEKENWOORDEN)


def is_jaarmap(naam):
    """"2014" ... "2025" in het archief zijn jaarmappen, geen projectmappen.

    Zonder deze uitzondering slokt de jaarmap 2020 het hele archiefjaar op en
    schrijft het op naam van project 2020 -- de projectnummers 2014-2026 bestaan
    namelijk allebei. Een echte projectmap draagt altijd een adres achter het
    nummer; een kale vier cijfers in dat bereik is een jaartal.
    """
    n = naam.strip()
    return n.isdigit() and len(n) == 4 and 2010 <= int(n) <= 2030


def projectmap(pad):
    """Het bovenste segment in het pad dat met een projectnummer begint.

    Een projectmap binnen een projectmap hoort bij de bovenste: fasemappen als
    "2418 ... /2419 oude versie" tellen niet als apart project.
    """
    segs = [s for s in pad.split("/") if s]
    for i, s in enumerate(segs[:-1]):
        if is_jaarmap(s):
            continue
        m = PROJECTNUMMER.match(s)
        if m:
            return m.group(1), "/" + "/".join(segs[:i + 1])
    return None, None


def stap_kies(cache):
    import difflib

    brondata = json.loads(JSON_UIT.read_text(encoding="utf-8"))
    projecten = brondata["projecten"]
    per_nummer = {}
    per_mapnaam = {}
    for p in projecten:
        per_nummer.setdefault(p["nummer"], []).append(p)
        if p.get("mapnaam"):
            per_mapnaam.setdefault(p["mapnaam"].strip().lower(), p)

    def hoort_bij(mappad):
        """Welk project hoort bij deze projectmap? Eerst op mapnaam, dan op nummer.

        Vier projectnummers komen twee keer voor in de lijst (2302, 2334, 2026,
        1708). Puur op nummer koppelen zou die twee dossiers dezelfde foto's
        geven; daarom wint de mapnaam, en bij meerdere kandidaten de naam die er
        het meest op lijkt.
        """
        basis = mappad.rsplit("/", 1)[-1].strip()
        p = per_mapnaam.get(basis.lower())
        if p:
            return p
        nummer = PROJECTNUMMER.match(basis).group(1)
        kandidaten = per_nummer.get(nummer)
        if not kandidaten:
            return None
        if len(kandidaten) == 1:
            return kandidaten[0]
        return max(kandidaten, key=lambda k: difflib.SequenceMatcher(
            None, basis.lower(), (k.get("mapnaam") or k.get("adres") or "").lower()).ratio())

    camera, tekening = {}, {}
    onbekende_nummers = set()
    toewijzing = {}
    regels = 0
    with (cache / "beelden.jsonl").open(encoding="utf-8") as f:
        for regel in f:
            if not regel.strip():
                continue
            regels += 1
            e = json.loads(regel)
            nummer, mappad = projectmap(e["p"])
            if not nummer:
                continue
            p = toewijzing.get(mappad)
            if p is None:
                p = hoort_bij(mappad)
                toewijzing[mappad] = p if p else False
            if not p:
                onbekende_nummers.add(nummer); continue
            sleutel = p["nummer"] + "|" + p["mapnaam"]
            naam = e["p"].rsplit("/", 1)[-1]
            datum = (e.get("m") or e.get("s") or "")[:10]
            doel = camera if is_camerafoto(naam) else tekening
            doel.setdefault(sleutel, []).append({"pad": e["p"], "datum": datum, "id": e.get("id")})

    kandidaten = []
    for i, p in enumerate(projecten):
        sleutel = p["nummer"] + "|" + p["mapnaam"]
        cf_ = sorted(camera.get(sleutel, []), key=lambda x: (x["datum"], x["pad"]), reverse=True)
        kandidaten.append({
            # `ref` is de sleutel voor de thumbnailbestanden en de contactbladen:
            # vier projectnummers komen twee keer voor, de rij-index nooit.
            "ref": f"{i:03d}-{p['nummer']}",
            "sleutel": sleutel,
            "nummer": p["nummer"],
            "gemeente": p.get("gemeente") or "",
            "adres": p.get("adres") or "",
            "status": p.get("status") or "",
            "camerafotos": len(cf_),
            "tekeningen": len(tekening.get(sleutel, [])),
            "recentste_camerafoto": cf_[0]["datum"] if cf_ else None,
            "top3": cf_[:3],
        })

    uit = cache / "kandidaten.json"
    uit.write_text(json.dumps(kandidaten, ensure_ascii=False, indent=1), encoding="utf-8")
    met = sum(1 for k in kandidaten if k["camerafotos"] > 0)
    print(f"{regels} beeldregels gelezen, {len(onbekende_nummers)} nummers zonder project in de lijst")
    print(f"{uit}: {len(kandidaten)} projecten, {met} met minstens een camerafoto")
    print(f"  camerafoto's totaal {sum(k['camerafotos'] for k in kandidaten)} ·"
          f" tekening/schermbeeld {sum(k['tekeningen'] for k in kandidaten)}")


# ----------------------------------------------------------------- stap "bladen"
def stap_bladen(cache, per_blad=20, formaat="w480h320", groot=False):
    from PIL import Image, ImageDraw, ImageFont

    kandidaten = json.loads((cache / "kandidaten.json").read_text(encoding="utf-8"))
    doe = [k for k in kandidaten if k["camerafotos"] > 0]
    if groot:
        alleen = set(json.loads((cache / "herbekijken.json").read_text(encoding="utf-8")))
        doe = [k for k in doe if k["ref"] in alleen or k["nummer"] in alleen]
        per_blad, formaat = 6, "w640h480"

    tok = token()
    ns = wortel_namespace(tok)
    dump = cache / ("thumbs-groot" if groot else "thumbs")
    dump.mkdir(parents=True, exist_ok=True)

    # 1) thumbnails in groepjes van 25 ophalen
    wensen = []
    for k in doe:
        for i, f in enumerate(k["top3"]):
            doelbestand = dump / f"{k['ref']}-{i}.jpg"
            if not doelbestand.exists():
                wensen.append((doelbestand, f["pad"]))
    mislukt = []
    for i in range(0, len(wensen), 25):
        groep = wensen[i:i + 25]
        body = {"entries": [{"path": p, "format": {".tag": "jpeg"},
                             "size": {".tag": formaat}, "mode": {".tag": "strict"}}
                            for _, p in groep]}
        try:
            d = _post("/files/get_thumbnail_batch", body, tok, ns, basis=CONTENT)
        except RuntimeError as f:
            mislukt.extend(p for _, p in groep)
            print(f"  groep {i//25} mislukt: {str(f)[:120]}", flush=True)
            continue
        for (doelbestand, pad), res in zip(groep, d.get("entries", [])):
            if res.get(".tag") == "success" and res.get("thumbnail"):
                doelbestand.write_bytes(base64.b64decode(res["thumbnail"]))
            else:
                mislukt.append(pad)
        if i % 250 == 0:
            print(f"  {i}/{len(wensen)} thumbnails", flush=True)
    if mislukt:
        (cache / ("thumbs-mislukt-groot.txt" if groot else "thumbs-mislukt.txt")).write_text(
            "\n".join(mislukt), encoding="utf-8")

    # 2) contactbladen bouwen: per project drie beelden naast elkaar, met bijschrift
    tegel = 256 if not groot else 420
    bijschrift = 26 if not groot else 30
    kolommen = 2 if not groot else 1          # projecten naast elkaar
    marge = 6
    try:
        lettertype = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 17 if not groot else 20)
    except OSError:
        lettertype = ImageFont.load_default()

    bladen = cache / ("contactbladen-groot" if groot else "contactbladen")
    bladen.mkdir(parents=True, exist_ok=True)
    for oud in bladen.glob("*.jpg"):
        oud.unlink()

    cel_b = 3 * tegel + 4 * marge
    cel_h = tegel + bijschrift + marge
    gemaakt = []
    for nr, begin in enumerate(range(0, len(doe), per_blad), start=1):
        groep = doe[begin:begin + per_blad]
        rijen = (len(groep) + kolommen - 1) // kolommen
        blad = Image.new("RGB", (cel_b * kolommen, cel_h * rijen + 4), (24, 24, 27))
        teken = ImageDraw.Draw(blad)
        for j, k in enumerate(groep):
            cx = (j % kolommen) * cel_b
            cy = (j // kolommen) * cel_h
            tekst = f"{k['ref']}  {k['gemeente'] or '(geen gemeente)'}  ·  {k['camerafotos']} foto's · {k['recentste_camerafoto'] or '?'}"
            teken.text((cx + marge, cy + 4), tekst, fill=(245, 245, 245), font=lettertype)
            for i in range(3):
                vak = (cx + marge + i * (tegel + marge), cy + bijschrift)
                bestand = dump / f"{k['ref']}-{i}.jpg"
                if bestand.exists():
                    try:
                        im = Image.open(bestand).convert("RGB")
                    except Exception:
                        continue
                    im.thumbnail((tegel, tegel))
                    blad.paste(im, (vak[0] + (tegel - im.width) // 2,
                                    vak[1] + (tegel - im.height) // 2))
                    teken.text((vak[0] + 3, vak[1] + 2), str(i + 1), fill=(255, 210, 60), font=lettertype)
                else:
                    teken.rectangle([vak[0], vak[1], vak[0] + tegel, vak[1] + tegel],
                                    outline=(90, 90, 95))
                    teken.text((vak[0] + 8, vak[1] + tegel // 2), "geen thumbnail",
                               fill=(150, 150, 155), font=lettertype)
        pad = bladen / f"blad-{nr:02d}.jpg"
        blad.save(pad, quality=88)
        gemaakt.append(str(pad))

    meta_pad = cache / ("bladen-meta-groot.json" if groot else "bladen-meta.json")
    meta_pad.write_text(json.dumps({
        "projecten": len(doe),
        "contactbladen": len(gemaakt),
        "thumbnails": len(list(dump.glob("*.jpg"))),
        "mislukt": len(mislukt),
        "formaat": formaat,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(gemaakt)} contactbladen in {bladen} ({len(doe)} projecten,"
          f" {len(wensen) - len(mislukt)} nieuwe thumbnails, {len(mislukt)} mislukt)")


# ---------------------------------------------------------------- stap "verwerk"
def stap_verwerk(cache, beoordeeld_op="2026-09-14"):
    data = json.loads(JSON_UIT.read_text(encoding="utf-8"))
    lijst = json.loads((cache / "kandidaten.json").read_text(encoding="utf-8"))
    kandidaten = {k["sleutel"]: k for k in lijst}
    ref_van = {k["sleutel"]: k["ref"] for k in lijst}
    # oordelen.json mag op ref of op projectnummer staan; ref wint.
    oordelen = json.loads((cache / "oordelen.json").read_text(encoding="utf-8"))

    telling = {"ja": 0, "nee": 0, "onzeker": 0}
    for p in data["projecten"]:
        sleutel = p["nummer"] + "|" + p["mapnaam"]
        k = kandidaten.get(sleutel, {})
        p["camerafotos"] = k.get("camerafotos", 0)
        p["recentste_camerafoto"] = k.get("recentste_camerafoto")
        if p["camerafotos"] == 0:
            # Geen enkele camerafoto: dan is er niets om te beoordelen.
            # Uitzondering: de mappen die Dropbox niet wil geven blijven "onzeker".
            oordeel = "onzeker" if p.get("fotos") == "onbekend" else "nee"
            bestand = None
        else:
            o = oordelen.get(ref_van.get(sleutel, "")) or oordelen.get(p["nummer"]) or {}
            oordeel = o.get("oordeel", "onzeker")
            bestand = o.get("bestand")
            # Op het contactblad staat elk beeld genummerd 1, 2 of 3. Wie dat
            # cijfer noteert, krijgt hier het volledige pad terug.
            if bestand in ("1", "2", "3", 1, 2, 3):
                top3 = k.get("top3") or []
                i = int(bestand) - 1
                bestand = top3[i]["pad"] if 0 <= i < len(top3) else None
        p["oplevering_beoordeling"] = oordeel
        p["oplevering_bestand"] = bestand
        p["beoordeeld_op"] = beoordeeld_op
        telling[oordeel] += 1

    meta, meta_groot = {}, {}
    if (cache / "bladen-meta.json").exists():
        meta = json.loads((cache / "bladen-meta.json").read_text(encoding="utf-8"))
    if (cache / "bladen-meta-groot.json").exists():
        meta_groot = json.loads((cache / "bladen-meta-groot.json").read_text(encoding="utf-8"))

    data["beoordeling"] = {
        "datum": beoordeeld_op,
        "methode": "camerafoto's (jpg/heic zonder tekenwerk-woord in de naam) uit de Dropbox,"
                   " de drie recentste per project op contactblad bekeken",
        "ja": telling["ja"], "nee": telling["nee"], "onzeker": telling["onzeker"],
        "contactbladen": (meta.get("contactbladen") or 0) + (meta_groot.get("contactbladen") or 0),
        "thumbnails": (meta.get("thumbnails") or 0) + (meta_groot.get("thumbnails") or 0),
        "mislukteThumbnails": (meta.get("mislukt") or 0) + (meta_groot.get("mislukt") or 0),
    }
    JSON_UIT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{JSON_UIT}: ja {telling['ja']} · nee {telling['nee']} · onzeker {telling['onzeker']}")
    print(f"  camerafoto's totaal {sum(p['camerafotos'] for p in data['projecten'])}")


def main():
    ap = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    ap.add_argument("stap", choices=["haal", "kies", "bladen", "verwerk"])
    ap.add_argument("--cache", default=str(STANDAARD_CACHE))
    ap.add_argument("--alleen", help="haal: slechts een wortelmap (deel van het pad)")
    ap.add_argument("--groot", action="store_true",
                    help="bladen: grotere thumbnails voor de projecten in herbekijken.json")
    ap.add_argument("--datum", default="2026-09-14", help="verwerk: datum van de beoordeling")
    a = ap.parse_args()
    cache = pathlib.Path(a.cache).expanduser()
    if a.stap == "haal":
        stap_haal(cache, a.alleen)
    elif a.stap == "kies":
        stap_kies(cache)
    elif a.stap == "bladen":
        stap_bladen(cache, groot=a.groot)
    else:
        stap_verwerk(cache, a.datum)


if __name__ == "__main__":
    main()
