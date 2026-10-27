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
     each validated route replaces its previous version. Routes that pass every check
     are verified ('auto:cambridge-thresholds-v1'); the rest stay drafts.

A table whose own title disagrees with its file name is not loaded at all.
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
import random
import time
import urllib.error
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


class FetchError(RuntimeError):
    def __init__(self, kind, url):
        self.kind = kind
        super().__init__(f"{kind}: {url}")


def get(url, timeout=30, attempts=3, budget=90):
    """Bounded transient retries; timeout is per socket operation, budget spans
    attempts. Chunked reading checks the budget between socket reads."""
    deadline = time.monotonic() + budget
    last_kind = "upstream_timeout"
    for attempt in range(attempts):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            break
        req = urllib.request.Request(url, headers=UA)
        retry_after = 0
        try:
            with urllib.request.urlopen(req, timeout=min(timeout, remaining)) as r:
                chunks = []
                while True:
                    if time.monotonic() >= deadline:
                        raise TimeoutError()
                    chunk = r.read1(64 * 1024)
                    if not chunk:
                        return b"".join(chunks)
                    chunks.append(chunk)
        except urllib.error.HTTPError as error:
            if error.code != 429 and not 500 <= error.code < 600:
                raise FetchError(f"upstream_http_{error.code}", url) from error
            last_kind = f"upstream_http_{error.code}"
            try:
                retry_after = max(0, float(error.headers.get("Retry-After", "0")))
            except (ValueError, TypeError):
                pass
        except (TimeoutError, urllib.error.URLError, ConnectionError) as error:
            reason = getattr(error, "reason", error)
            last_kind = "upstream_timeout" if isinstance(reason, TimeoutError) else "upstream_network"
        if attempt + 1 < attempts:
            delay = max(retry_after, 2 ** attempt + random.uniform(0, 0.5))
            if delay >= deadline - time.monotonic():
                break
            time.sleep(delay)
    raise FetchError(last_kind, url)


def discovery(page, parser, label):
    rows = parser(get(page).decode("utf-8", "replace"))
    if not rows:
        raise FetchError(f"source_drift_{label}", page)
    return rows


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
    out = []
    identity = f"provider_key = 'cambridge' and syllabus_code = {q(code)} and series_key = {q(series)}"
    for r in routes:
        grades = ", ".join(f"({q(g)}, {m})" for g, m in r["grades"])
        ver = r["status"] == "verified"
        route_key = f"{identity} and qualification = {q(r['qualification'])} and option_code = {q(r['option_code'])}"
        if not ver:
            out.append(f"do $threshold$ begin if not exists (select 1 from public.grade_threshold_set where {route_key} and status = 'verified') then")
        out.append(f"delete from public.grade_threshold_set where {route_key};")
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
        if not ver:
            out.append("end if; end $threshold$;")
    # Components follow the same no-downgrade rule, independently of routes.
    for c in ct.components_for_db(table, routes):
        ver = c["status"] == "verified"
        component_key = f"{identity} and component = {q(c['component'])}"
        if not ver:
            out.append(f"do $threshold$ begin if not exists (select 1 from public.grade_threshold_component where {component_key} and status = 'verified') then")
        out.append(f"delete from public.grade_threshold_component where {component_key};")
        out.append(
            "insert into public.grade_threshold_component (provider_key, syllabus_code, series_key, component, max_raw, grades, "
            "source_url, source_sha256, status, verified_by, verified_at) values ("
            f"'cambridge', {q(code)}, {q(series)}, {q(c['component'])}, {c['max_raw']}, {q(json.dumps(c['grades']))}::jsonb, "
            f"{q(url)}, {q(sha)}, {q(c['status'])}, {q(CHECKER) if ver else 'null'}, {'now()' if ver else 'null'});")
        if not ver:
            out.append("end if; end $threshold$;")
    # Missing or ambiguous routes are not deleted. Source drift cannot silently
    # remove last validated data; revocation requires explicit source review.
    return out


def read_known(path):
    """The state the database already holds (scripts/exams/known.mjs).

    Returns (verified, loaded): URLs not to download again, and for every
    loaded table the (file SHA-256, weighting file SHA-256) it was loaded from.
    A bare URL per line (the format before AXO-291) counts as verified.
    """
    verified, loaded = set(), {}
    if not path or not os.path.exists(path):
        return verified, loaded
    for line in open(path):
        parts = line.rstrip("\n").split("\t")
        if parts == [""]:
            continue
        if len(parts) == 1:
            verified.add(parts[0].strip())
        elif parts[0] == "verified" and len(parts) == 2:
            verified.add(parts[1])
        elif parts[0] == "loaded" and len(parts) == 4:
            loaded[parts[1]] = (parts[2], parts[3])
    return verified, loaded


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--series", type=int, default=3, help="newest series pages to read per qualification")
    ap.add_argument("--known", help="output of scripts/exams/known.mjs: verified tables are not downloaded again, unchanged ones not rewritten")
    ap.add_argument("--codes", help="comma-separated syllabus codes to limit to")
    ap.add_argument("--rewrite", action="store_true", help="write every table again even when its files are unchanged (a parser change)")
    args = ap.parse_args()
    known, loaded = read_known(args.known)
    only = set(args.codes.split(",")) if args.codes else None

    tables = []
    for page in QUALIFICATION_PAGES:
        series_pages = discovery(page, ct.threshold_series_pages, "series")[: args.series]
        if not series_pages:
            raise SystemExit(f"{page}: no series pages found; the page layout may have changed")
        for sp in series_pages:
            found = discovery(sp, ct.threshold_pdfs, "tables")
            print(f"-- {sp}: {len(found)} tables", file=sys.stderr)
            tables.extend(found)

    weighting_html = get(WEIGHTING_PAGE).decode("utf-8", "replace")
    wlinks = sorted({ct.absolute(h) for h in __import__("re").findall(r'href="([^"]*syllabus-component-weighting-factors[^"]*\.pdf)"', weighting_html)})
    if not wlinks:
        raise FetchError("source_drift_weights", WEIGHTING_PAGE)
    weights_url = wlinks[0]
    wdata = get(weights_url, timeout=40, budget=120)
    weights_sha = hashlib.sha256(wdata).hexdigest()
    weights = ct.parse_weighting_lines(pdf_lines(wdata))
    covered = sorted({k[0] for k in weights})
    print(f"-- weighting factors: {len(weights)} components, series {', '.join(covered)} ({weights_sha[:12]})", file=sys.stderr)

    out, stats = [], {"tables": 0, "skipped_known": 0, "unchanged": 0, "verified": 0, "draft": 0, "failed": 0}
    for url, code, series in sorted(set(tables)):
        if only and code not in only:
            continue
        if url in known:
            stats["skipped_known"] += 1
            continue
        try:
            data = get(url)
            sha = hashlib.sha256(data).hexdigest()
            # Same file and same weighting file as the rows already stored: the
            # checks would give the same answer, so nothing is written (AXO-291).
            if not args.rewrite and loaded.get(url) == (sha, weights_sha):
                stats["unchanged"] += 1
                continue
            table = ct.parse_threshold_lines(pdf_lines(data))
        except Exception as e:  # one unreadable table never blocks the rest
            stats["failed"] += 1
            warn(f"{url}: {e}")
            continue
        if not table["routes"]:
            stats["failed"] += 1
            warn(f"{url}: no routes read")
            continue
        if table["syllabus_code"] != code or table["series"] != series:
            # Which one is right cannot be told from here, and writing it under
            # either would replace that series' real table. Load nothing.
            stats["failed"] += 1
            warn(f"{url}: the table says {table['syllabus_code']} {table['series']}, the file name {code} {series}; not loaded")
            continue
        routes = ct.routes_for_db(table, weights)
        # The older layout can list one route twice under two option codes.
        # Identical: keep one. Different numbers for one route: load neither.
        by_key = {}
        for r in routes:
            by_key.setdefault((r["qualification"], r["option_code"]), []).append(r)
        routes = []
        for (qual, option), same in by_key.items():
            if all((x["max_total"], x["grades"]) == (same[0]["max_total"], same[0]["grades"]) for x in same):
                routes.append(same[0])
            else:
                warn(f"{url}: route {option} ({qual}) is printed twice with different thresholds; not loaded")
        out.extend(table_sql(url, sha, table, routes, weights_url, weights_sha))
        stats["tables"] += 1
        for r in routes:
            stats["verified" if r["status"] == "verified" else "draft"] += 1
    stats["outcome"] = "partial_ingest" if stats["failed"] else "complete"
    summary = f"-- {json.dumps(stats)}"
    print(summary, file=sys.stderr)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as report:
            report.write(summary + "\n")
    print("\n".join(out))


if __name__ == "__main__":
    try:
        main()
    except FetchError as error:
        summary = f"Threshold ingest stopped: {error}. No threshold SQL was emitted; existing data is unchanged."
        warn(summary)
        if os.environ.get("GITHUB_STEP_SUMMARY"):
            with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as report:
                report.write(summary + "\n")
        raise SystemExit(1)
