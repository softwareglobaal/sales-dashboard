#!/usr/bin/env python3
"""Post het salesrapport in Zoom, kanaal "Sales Rapport" (spec §17c).

De tekst komt uit het dashboard (GET /api/v1/rapport): dezelfde cijfers als op het
scherm. Dit script rekent niets, het haalt op en verstuurt.

Cron (server, UTC; 10:00 UTC = 07:00 in Suriname):
  0 10 * * 1  python3 ~/appportal/sales/deploy/salesrapport.py week
  0 10 1 * *  python3 ~/appportal/sales/deploy/salesrapport.py maand

Droog (toont de tekst, verstuurt niets):  python3 salesrapport.py week --droog
"""
import base64
import json
import os
import sys
import urllib.parse
import urllib.request

KANAAL = "Sales Rapport"
API = "https://sales.globaal.be/api/v1/rapport"
ZOOM_ENV = os.path.expanduser("~/pipedrive-won-deals/.env")   # zelfde Zoom-app als de andere meldingen


def lees_env(pad):
    uit = {}
    for regel in open(pad):
        regel = regel.strip()
        if regel and not regel.startswith("#") and "=" in regel:
            k, v = regel.split("=", 1)
            uit[k.strip()] = v.strip().strip('"').strip("'")
    return uit


def zoom_token(e):
    url = "https://zoom.us/oauth/token?" + urllib.parse.urlencode(
        {"grant_type": "account_credentials", "account_id": e["ZOOM_ACCOUNT_ID"]})
    req = urllib.request.Request(url, method="POST")
    req.add_header("Authorization", "Basic " + base64.b64encode(
        f"{e['ZOOM_CLIENT_ID']}:{e['ZOOM_CLIENT_SECRET']}".encode()).decode())
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)["access_token"]


def zoom(token, pad, body=None):
    req = urllib.request.Request("https://api.zoom.us/v2" + pad,
                                 data=json.dumps(body).encode() if body else None,
                                 method="POST" if body else "GET")
    req.add_header("Authorization", "Bearer " + token)
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=20) as r:
        t = r.read().decode()
        return json.loads(t) if t else {}


def main(argv):
    soort = "maand" if "maand" in argv else "week"
    app = lees_env(os.path.expanduser("~/appportal/.env"))
    req = urllib.request.Request(f"{API}?soort={soort}")
    req.add_header("Authorization", "Bearer " + app["SALES_AGENT_TOKEN"])
    with urllib.request.urlopen(req, timeout=60) as r:
        tekst = json.load(r)["tekst"]
    if "--droog" in argv:
        print(tekst)
        return 0
    e = lees_env(ZOOM_ENV)
    tok = zoom_token(e)
    afzender = urllib.parse.quote(e["ZOOM_SENDER"])
    kanaal = None
    volgende = ""
    while kanaal is None:
        d = zoom(tok, f"/chat/users/{afzender}/channels?page_size=100" + (f"&next_page_token={volgende}" if volgende else ""))
        kanaal = next((c["id"] for c in d.get("channels") or [] if (c.get("name") or "").lower() == KANAAL.lower()), None)
        volgende = d.get("next_page_token") or ""
        if kanaal is None and not volgende:
            raise SystemExit(f'kanaal "{KANAAL}" niet gevonden')
    zoom(tok, f"/chat/users/{afzender}/messages", {"to_channel": kanaal, "message": tekst})
    print(f"{soort}rapport verstuurd naar {KANAAL}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
