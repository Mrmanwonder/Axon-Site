"""Finds, downloads, checks and writes Cambridge grade threshold tables
(AXO-262; owner, 13 Oct 2026: grade thresholds load themselves).

  1. Reads the board's grade threshold page for each qualification, then the
     newest --series series pages it links to, and collects every threshold
     table PDF (syllabus code and series are read from the file name).
  2. Downloads the board's syllabus component weighting factors file.
  3. Downloads each table not already fully verified (--known lists source
     URLs whose linear and AS routes are all verified), records its SHA-256,
     reads it with cambridge_thresholds.py and checks every route.
  4. Writes SQL to stdout for scripts/syllabus/load.mjs (one transaction):
     each table replaces that syllabus and series. Routes that pass every check
     are verified ('auto:cambridge-thresholds-v1'); the rest stay drafts.

A table whose own title disagrees with its file name loads nothing verified.
A download or read failure skips that table with a warning; earlier rows for
it stay as they were. Nothing is guessed.

Run: python3 scripts/exams/thresholds_ingest.py [--series 3] [--known FILE] [--codes 9709,9702] > gt.sql
"""

import argparse
import hashlib
import io
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import cambridge_thresholds as ct  # noqa: E402

QUALIFICATION_PAGES = [
    "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/grade-threshold-tables/",
]
WEIGHTING_PAGE = "https://www.cambridgeinternational.org/weighting"
CHECKER = "auto:cambridge-thresholds-v1"
UA = {"User-Agent": "Axon exam ingest (axon-site)"}


def get(url, timeout=60):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def pdf_lines(data):
    import pdfplumber
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        return [line for page in pdf.pages for line in (page.extract_text() or "").splitlines()]


def q(v):
    if v is None:
        return "null"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def warn(msg):
    print(f"::warning::{msg}" if os.environ.get("GITHUB_ACTIONS") else f"warning: {msg}", file=sys.stderr)


def table_sql(url, sha, table, routes, weights_url, weights_sha):
    code, series = table["syllabus_code"], table["series"]
    out = [f"delete from public.grade_threshold_set where provider_key = 'cambridge' and syllabus_code = {q(code)} and series_key = {q(series)};"]
    for r in routes:
        grades = ", ".join(f"({q(g)}, {m})" for g, m in r["grades"])
        ver = r["status"] == "verified"
        out.append(
            "with s as (insert into public.grade_threshold_set (provider_key, syllabus_code, series_key, qualification, option_code, "
            "components, component_max, component_weight, max_total, source_url, source_sha256, status, verified_by, verified_at, "
            "assessment, weights_source_url, weights_source_sha256, checks) values ("
            f"'cambridge', {q(code)}, {q(series)}, {q(r['qualification'])}, {q(r['option_code'])}, "
            f"array[{','.join(str(p) for p in r['components'])}]::smallint[], {q(json.dumps(r['component_max']))}::jsonb, "
            f"{q(json.dumps(r['component_weight']))}::jsonb, {r['max_total']}, {q(url)}, {q(sha)}, {q(r['status'])}, "
            f"{q(CHECKER) if ver else 'null'}, {'now()' if ver else 'null'}, {q(r['assessment'])}, "
            f"{q(weights_url)}, {q(weights_sha)}, {q(json.dumps(r['checks']))}::jsonb) returning id) "
            f"insert into public.grade_threshold (set_id, grade, min_total) select s.id, v.g, v.m from s, (values {grades}) as v(g, m);")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--series", type=int, default=3, help="newest series pages to read per qualification")
    ap.add_argument("--known", help="file of source URLs already fully verified; these are not downloaded again")
    ap.add_argument("--codes", help="comma-separated syllabus codes to limit to")
    args = ap.parse_args()
    known = set()
    if args.known and os.path.exists(args.known):
        known = {line.strip() for line in open(args.known) if line.strip()}
    only = set(args.codes.split(",")) if args.codes else None

    tables = []
    for page in QUALIFICATION_PAGES:
        series_pages = ct.threshold_series_pages(get(page).decode("utf-8", "replace"))[: args.series]
        if not series_pages:
            raise SystemExit(f"{page}: no series pages found; the page layout may have changed")
        for sp in series_pages:
            found = ct.threshold_pdfs(get(sp).decode("utf-8", "replace"))
            print(f"-- {sp}: {len(found)} tables", file=sys.stderr)
            tables.extend(found)

    weighting_html = get(WEIGHTING_PAGE).decode("utf-8", "replace")
    wlinks = sorted({ct.absolute(h) for h in __import__("re").findall(r'href="([^"]*syllabus-component-weighting-factors[^"]*\.pdf)"', weighting_html)})
    if not wlinks:
        raise SystemExit(f"{WEIGHTING_PAGE}: no weighting factors file found; nothing can be verified")
    weights_url = wlinks[0]
    wdata = get(weights_url, timeout=120)
    weights_sha = hashlib.sha256(wdata).hexdigest()
    weights = ct.parse_weighting_lines(pdf_lines(wdata))
    covered = sorted({k[0] for k in weights})
    print(f"-- weighting factors: {len(weights)} components, series {', '.join(covered)} ({weights_sha[:12]})", file=sys.stderr)

    out, stats = [], {"tables": 0, "skipped_known": 0, "verified": 0, "draft": 0, "failed": 0}
    for url, code, series in sorted(set(tables)):
        if only and code not in only:
            continue
        if url in known:
            stats["skipped_known"] += 1
            continue
        try:
            data = get(url)
            sha = hashlib.sha256(data).hexdigest()
            table = ct.parse_threshold_lines(pdf_lines(data))
        except Exception as e:  # one unreadable table never blocks the rest
            stats["failed"] += 1
            warn(f"{url}: {e}")
            continue
        if not table["routes"]:
            stats["failed"] += 1
            warn(f"{url}: no routes read")
            continue
        routes = ct.routes_for_db(table, weights)
        if table["syllabus_code"] != code or table["series"] != series:
            for r in routes:
                r["checks"]["file_name_matches"] = False
                r["status"] = "draft"
            warn(f"{url}: the table says {table['syllabus_code']} {table['series']}, the file name {code} {series}; kept as draft")
            table["syllabus_code"], table["series"] = code, series
        out.extend(table_sql(url, sha, table, routes, weights_url, weights_sha))
        stats["tables"] += 1
        for r in routes:
            stats["verified" if r["status"] == "verified" else "draft"] += 1
    print(f"-- {json.dumps(stats)}", file=sys.stderr)
    print("\n".join(out))


if __name__ == "__main__":
    main()
