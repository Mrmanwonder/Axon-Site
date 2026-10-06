"""Loads official exam dates, zones and paper routes into the database.

Reads curriculum/exams/sources.json and curriculum/exams/cambridge-zones.json,
downloads each timetable (or reads it from --pdf-dir), refuses any file whose
SHA-256 differs from the manifest, parses it with cambridge_timetable.py, and
refuses any timetable whose two views disagree. Writes SQL to stdout for
scripts/syllabus/load.mjs, which runs it as one transaction.

Run: python3 scripts/exams/ingest.py [--pdf-dir DIR] > exams.sql
"""

import argparse
import hashlib
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

import cambridge_timetable as ct  # noqa: E402


def q(v):
    if v is None:
        return "null"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def arr(xs, cast):
    return "array[" + ",".join(q(x) for x in xs) + f"]::{cast}[]" if xs else f"'{{}}'::{cast}[]"


def fetch(url, pdf_dir):
    name = url.rsplit("/", 1)[1]
    if pdf_dir:
        for cand in os.listdir(pdf_dir):
            if cand == name:
                return open(os.path.join(pdf_dir, cand), "rb").read()
    req = urllib.request.Request(url, headers={"User-Agent": "Axon exam ingest (axon-site)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def parse(data):
    import io
    import pdfplumber
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        errata = []
        rows = ct.weekly(pdf, errata)
        problems = ct.syllabus_view_check(pdf, rows)
        windows = ct.windows(pdf)
        version = None
        for page in pdf.pages:
            import re
            v = re.search(r"Version \d+, \w+ \d{4}", page.extract_text() or "")
            if v:
                version = v.group(0)
                break
    return rows, windows, errata, problems, version


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf-dir")
    args = ap.parse_args()
    manifest = json.load(open(os.path.join(ROOT, "curriculum/exams/sources.json")))
    zones = json.load(open(os.path.join(ROOT, "curriculum/exams/cambridge-zones.json")))
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    out = []  # load.mjs runs the file as one transaction

    out.append("delete from public.exam_zone_location where location_key not in ("
               + ",".join(q(z["location_key"]) for z in zones["locations"]) + ");")
    for z in zones["locations"]:
        out.append("insert into public.exam_zone_location (location_key, lookup_value, label, country, zone, timetable_variant, source_url, fetched_at) values ("
                   f"{q(z['location_key'])}, {q(z['lookup_value'])}, {q(z['label'])}, {q(z['country'])}, {z['zone']}, {q(z['timetable_variant'])}, "
                   f"{q(zones['source_url'])}, {q(zones['fetched_at'])}) on conflict (location_key) do update set "
                   "lookup_value = excluded.lookup_value, label = excluded.label, country = excluded.country, zone = excluded.zone, "
                   "timetable_variant = excluded.timetable_variant, source_url = excluded.source_url, fetched_at = excluded.fetched_at;")

    for t in manifest["timetables"]:
        data = fetch(t["source_url"], args.pdf_dir)
        sha = hashlib.sha256(data).hexdigest()
        if sha != t["source_sha256"]:
            raise SystemExit(f"{t['source_url']}: SHA-256 {sha} differs from the manifest; review the new version first")
        rows, windows, errata, problems, version = parse(data)
        if problems:
            raise SystemExit(f"{t['source_url']}: the weekly and A-Z views disagree: {problems}")
        if not rows:
            raise SystemExit(f"{t['source_url']}: no rows read")
        print(f"-- {t['series_label']} zone {t['zone']}{' ' + t['timetable_variant'] if t['timetable_variant'] else ''}: "
              f"{len(rows)} dated, {len(windows)} windows, {len(errata)} errata", file=sys.stderr)
        days = [r["date"] for r in rows] + [w["window_start"] for w in windows] + [w["window_end"] for w in windows]
        key = (f"provider_key = {q(t['provider_key'])} and series_key = {q(t['series_key'])} "
               f"and zone = {t['zone']} and timetable_variant = {q(t['timetable_variant'])}")
        out.append(f"delete from public.exam_timetable where {key};")
        out.append("insert into public.exam_timetable (provider_key, series_key, series_label, zone, timetable_variant, status, "
                   "version_label, source_url, source_sha256, fetched_at, errata, first_date, last_date) values ("
                   f"{q(t['provider_key'])}, {q(t['series_key'])}, {q(t['series_label'])}, {t['zone']}, {q(t['timetable_variant'])}, "
                   f"{q(t['status'])}, {q(version)}, {q(t['source_url'])}, {q(sha)}, {q(now)}, {arr(errata, 'text')}, {q(min(days))}, {q(max(days))});")
        values = []
        for r in rows:
            values.append(f"({q(r['qualification'])}, {q(r['syllabus_code'])}, {q(r['component'])}, {q(r['title'])}, "
                          f"{q(r['date'])}::date, {q(r['session'])}, {r['duration_minutes']}, null::date, null::date)")
        dated = {(r["syllabus_code"], r["component"]) for r in rows}
        for w in windows:
            if (w["syllabus_code"], w["component"]) in dated:
                continue  # a component with a fixed date is shown by its date
            values.append(f"({q(w['qualification'])}, {q(w['syllabus_code'])}, {q(w['component'])}, {q(w['title'])}, "
                          f"null::date, null, null, {q(w['window_start'])}::date, {q(w['window_end'])}::date)")
        out.append("insert into public.exam_sitting (timetable_id, qualification, syllabus_code, component, title, exam_date, "
                   "session, duration_minutes, window_start, window_end) select t.id, v.* from public.exam_timetable t, (values\n  "
                   + ",\n  ".join(values) + f"\n) as v where t.{key.replace(' and ', ' and t.')};")

    codes = sorted({r["syllabus_code"] for r in manifest["routes"]})
    out.append("delete from public.syllabus_paper_route where syllabus_code in (" + ",".join(q(c) for c in codes) + ");")
    for r in manifest["routes"]:
        out.append("insert into public.syllabus_paper_route (provider_key, syllabus_code, programme_key, kind, papers, source_url, source_sha256) values ("
                   f"'cambridge', {q(r['syllabus_code'])}, {q(r['programme_key'])}, {q(r['kind'])}, {arr(r['papers'], 'smallint')}, "
                   f"{q(r['source_url'])}, {q(r['source_sha256'])});")
    print("\n".join(out))


if __name__ == "__main__":
    main()
