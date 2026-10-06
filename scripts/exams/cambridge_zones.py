"""Regenerates curriculum/exams/cambridge-zones.json from Cambridge's own
administrative-zone lookup: every location the lookup offers, asked one at a
time, with the zone Cambridge returns. Any location without a clear answer
fails the run; nothing is guessed.

Run: python3 scripts/exams/cambridge_zones.py > curriculum/exams/cambridge-zones.json
"""

import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

PAGE = ("https://www.cambridgeinternational.org/exam-administration/cambridge-exams-officers-guide/"
        "phase-1-preparation/timetabling-exams/administrative-zone/")
LOOKUP = "https://www.cambridgeinternational.org/administrativezonesearch/getzones/"


def get(url, data=None):
    body = urllib.parse.urlencode(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers={"User-Agent": "Axon zone lookup (axon-site)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8")


def main():
    page = get(PAGE)
    xml = re.search(r'id="XMLFileName"[^>]*value="([^"]+)"', page)
    if not xml:
        raise SystemExit("zone lookup page changed: XMLFileName not found")
    options = [(v, html.unescape(t)) for v, t in re.findall(r'<option value="([^"]+)">([^<]+)</option>', page) if v != "-1"]
    if len(options) < 200:
        raise SystemExit(f"zone lookup page changed: only {len(options)} locations")
    out = []
    for value, label in options:
        reply = get(LOOKUP, {"selectedLocation": value, "xmlFilename": xml.group(1)})
        zones = set(re.findall(r"<span>Zone (\d)</span>", reply))
        if len(zones) != 1:
            raise SystemExit(f"{label}: no single zone in Cambridge's reply")
        label = re.sub(r"\s+", " ", label).strip()
        country = label.split(",", 1)[0] if "," in label else label.split(" - ")[0].rsplit(" ", 1)[0]
        out.append({"location_key": label, "lookup_value": value, "label": label, "country": country.strip(), "zone": int(zones.pop()),
                    "timetable_variant": "uk" if country.strip() == "United Kingdom" else ""})
        time.sleep(0.25)
    if len({o["location_key"] for o in out}) != len(out):
        raise SystemExit("two locations share a label")
    json.dump({"$comment": "Cambridge's own location-to-administrative-zone lookup, one row per option it offers. "
                           "Regenerate with scripts/exams/cambridge_zones.py; never edit by hand. "
                           "United Kingdom centres use the separate UK timetable.",
               "source_url": PAGE, "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
               "locations": out}, sys.stdout, indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
