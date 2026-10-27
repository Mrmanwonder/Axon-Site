"""Loads official exam dates, zones and paper routes into the database.

Reads curriculum/exams/sources.json and curriculum/exams/cambridge-zones.json,
downloads each timetable (or reads it from --pdf-dir), refuses any file whose
SHA-256 differs from the manifest, parses it with cambridge_timetable.py, and
refuses any timetable whose two views disagree. Writes SQL to stdout for
scripts/syllabus/load.mjs, which runs it as one transaction.

With --discover (the daily refresh; owner, 13 Oct 2026: exam dates load
themselves), the board's exam timetables page is read as well: every zone
timetable linked there is loaded, a newer file replaces the manifest's entry
for the same series and zone, and a changed SHA-256 is accepted when the new
file passes the same two-view cross-check. A timetable that fails is skipped
with a warning and its earlier dates stay; without --discover any mismatch
still stops the run.

Nothing unchanged is written (AXO-291: the daily refresh used to delete and
re-insert every row, and that churn helped starve the database on 13 and 26
Oct). A timetable whose file has the same SHA-256 as the one stored is left
alone; zones and paper routes are upserted only where a value differs. Pass
--rewrite (the workflow does on a push, when the parser or manifest changed)
to load every timetable again.

Run: python3 scripts/exams/ingest.py [--pdf-dir DIR] [--discover] [--rewrite] > exams.sql
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
import cambridge_thresholds as cgt  # noqa: E402

TIMETABLE_PAGE = ("https://www.cambridgeinternational.org/exam-administration/cambridge-exams-officers-guide/"
                  "phase-1-preparation/timetabling-exams/exam-timetables/")


def warn(msg):
    print(f"::warning::{msg}" if os.environ.get("GITHUB_ACTIONS") else f"warning: {msg}", file=sys.stderr)


def discovered_timetables(manifest_timetables):
    """Manifest entries, with the board's page merged in: same series, zone
    and variant → the page's file wins; anything new is added."""
    req = urllib.request.Request(TIMETABLE_PAGE, headers={"User-Agent": "Axon exam ingest (axon-site)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        html = r.read().decode("utf-8", "replace")
    found = cgt.timetable_pdfs(html)
    if not found:
        raise SystemExit(f"{TIMETABLE_PAGE}: no zone timetables found; the page layout may have changed")
    merged = {(t["series_key"], t["zone"], t["timetable_variant"]): dict(t) for t in manifest_timetables}
    for url, series, label, zone, variant in found:
        key = (series, zone, variant)
        status = "provisional" if "provisional" in url.lower() else "final"
        if key in merged:
            if merged[key]["source_url"] != url:
                merged[key].update(source_url=url, source_sha256=None, status=status)
        else:
            merged[key] = {"provider_key": "cambridge", "series_key": series, "series_label": label, "zone": zone,
                           "timetable_variant": variant, "status": status, "source_url": url, "source_sha256": None}
    print(f"-- discovered {len(found)} zone timetables on the board's page; {len(merged)} to load", file=sys.stderr)
    return sorted(merged.values(), key=lambda t: (t["series_key"], t["zone"], t["timetable_variant"]))


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


def zone_sql(zones):
    """Zones: stale ones removed, the rest upserted only where a value differs."""
    out = ["delete from public.exam_zone_location where location_key not in ("
           + ",".join(q(z["location_key"]) for z in zones["locations"]) + ");"]
    for z in zones["locations"]:
        out.append("insert into public.exam_zone_location (location_key, lookup_value, label, country, zone, timetable_variant, source_url, fetched_at) values ("
                   f"{q(z['location_key'])}, {q(z['lookup_value'])}, {q(z['label'])}, {q(z['country'])}, {z['zone']}, {q(z['timetable_variant'])}, "
                   f"{q(zones['source_url'])}, {q(zones['fetched_at'])}) on conflict (location_key) do update set "
                   "lookup_value = excluded.lookup_value, label = excluded.label, country = excluded.country, zone = excluded.zone, "
                   "timetable_variant = excluded.timetable_variant, source_url = excluded.source_url, fetched_at = excluded.fetched_at "
                   "where (exam_zone_location.lookup_value, exam_zone_location.label, exam_zone_location.country, exam_zone_location.zone, "
                   "exam_zone_location.timetable_variant, exam_zone_location.source_url, exam_zone_location.fetched_at) is distinct from "
                   "(excluded.lookup_value, excluded.label, excluded.country, excluded.zone, excluded.timetable_variant, excluded.source_url, excluded.fetched_at);")
    return out


def timetable_sql(t, sha, rows, windows, errata, version, now, rewrite=False):
    """One block per timetable. The same file as the one stored writes
    nothing (the parse is deterministic for a given file) unless rewrite."""
    days = [r["date"] for r in rows] + [w["window_start"] for w in windows] + [w["window_end"] for w in windows]
    key = (f"provider_key = {q(t['provider_key'])} and series_key = {q(t['series_key'])} "
           f"and zone = {t['zone']} and timetable_variant = {q(t['timetable_variant'])}")
    out = ["do $timetable$ begin"]
    if not rewrite:
        out.append(f"if exists (select 1 from public.exam_timetable where {key} and source_sha256 = {q(sha)}) then return; end if;")
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
    out.append("end $timetable$;")
    return out


def route_sql(routes):
    """Paper routes: stale ones removed, the rest upserted only where a value differs."""
    codes = sorted({r["syllabus_code"] for r in routes})
    if not codes:
        return []
    keep = ",".join(f"({q(r['syllabus_code'])}, {q(r['programme_key'])}, {arr(r['papers'], 'smallint')})" for r in routes)
    out = ["delete from public.syllabus_paper_route r where r.syllabus_code in (" + ",".join(q(c) for c in codes) + ")"
           f" and (r.syllabus_code, r.programme_key, r.papers) not in ({keep});"]
    for r in routes:
        out.append("insert into public.syllabus_paper_route (provider_key, syllabus_code, programme_key, kind, papers, source_url, source_sha256) values ("
                   f"'cambridge', {q(r['syllabus_code'])}, {q(r['programme_key'])}, {q(r['kind'])}, {arr(r['papers'], 'smallint')}, "
                   f"{q(r['source_url'])}, {q(r['source_sha256'])}) on conflict (syllabus_code, programme_key, papers) do update set "
                   "provider_key = excluded.provider_key, kind = excluded.kind, source_url = excluded.source_url, source_sha256 = excluded.source_sha256 "
                   "where (syllabus_paper_route.provider_key, syllabus_paper_route.kind, syllabus_paper_route.source_url, syllabus_paper_route.source_sha256) "
                   "is distinct from (excluded.provider_key, excluded.kind, excluded.source_url, excluded.source_sha256);")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf-dir")
    ap.add_argument("--discover", action="store_true")
    ap.add_argument("--rewrite", action="store_true", help="load every timetable again even when its file is unchanged")
    args = ap.parse_args()
    manifest = json.load(open(os.path.join(ROOT, "curriculum/exams/sources.json")))
    zones = json.load(open(os.path.join(ROOT, "curriculum/exams/cambridge-zones.json")))
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    out = zone_sql(zones)  # load.mjs runs the file as one transaction

    timetables = discovered_timetables(manifest["timetables"]) if args.discover else manifest["timetables"]
    for t in timetables:
        try:
            data = fetch(t["source_url"], args.pdf_dir)
            sha = hashlib.sha256(data).hexdigest()
            if t["source_sha256"] and sha != t["source_sha256"]:
                if not args.discover:
                    raise SystemExit(f"{t['source_url']}: SHA-256 {sha} differs from the manifest; review the new version first")
                warn(f"{t['source_url']}: a new version ({sha[:12]}); loading it only if it passes the cross-check")
            rows, windows, errata, problems, version = parse(data)
            if problems:
                raise ValueError(f"the weekly and A-Z views disagree: {problems}")
            if not rows:
                raise ValueError("no rows read")
        except (ValueError, OSError) as e:
            if not args.discover:
                raise SystemExit(f"{t['source_url']}: {e}")
            warn(f"{t['source_url']}: {e}; skipped, earlier dates for this timetable stay")
            continue
        print(f"-- {t['series_label']} zone {t['zone']}{' ' + t['timetable_variant'] if t['timetable_variant'] else ''}: "
              f"{len(rows)} dated, {len(windows)} windows, {len(errata)} errata", file=sys.stderr)
        out.extend(timetable_sql(t, sha, rows, windows, errata, version, now, args.rewrite))

    out.extend(route_sql(manifest["routes"]))
    print("\n".join(out))


if __name__ == "__main__":
    main()
