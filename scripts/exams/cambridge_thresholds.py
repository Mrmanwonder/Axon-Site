"""Reads Cambridge grade threshold tables and the syllabus component weighting
factors, and checks every route against both (AXO-262; owner, 13 Oct 2026:
grade thresholds load themselves).

Two of the board's own documents are read:
  * the grade threshold table for one syllabus and series: component
    thresholds (raw maximum, A..E per component) and syllabus thresholds per
    route ("11, 31, 41, 51" with a maximum weighted mark and A*..E or a..e);
  * the "syllabus component weighting factors" file: for every series,
    syllabus and component, the raw maximum, weighted maximum and factor.

A route is verified only when every check passes:
  title         the table names this syllabus code and this series
  components    every component of the route has thresholds in the table and
                a factor in the weighting file, with the same raw maximum
  factor        each factor is weighted maximum / raw maximum, and agrees with
                the factor as printed (rounded, e.g. 1.66667) to the places shown
  max           the route's maximum weighted mark equals the sum of the
                components' weighted maxima, exactly
  a_e           syllabus A and E equal the weighted sums of the component A and
                E thresholds to within the board's rounding (half a mark)
  order         the grades strictly descend
  grade_count   six grades (A*..E) for A Level, five (a..e) for AS
Routes that carry forward earlier results ("staged") have components with no
thresholds in the table, so they cannot be checked and stay drafts.

Pure facts from the board's documents; nothing is inferred or rounded here.
"""

import re
from fractions import Fraction

MONTHS = {m: i + 1 for i, m in enumerate(
    "January February March April May June July August September October November December".split())}
TITLE_RE = re.compile(r"^Grade thresholds\s*[–-]\s*(\w+) (\d{4})$")
SYLLABUS_RE = re.compile(r"\((\d{4})\)\s*$")
COMPONENT_RE = re.compile(r"^Component (\d{2}) (\d+) (\d+) (\d+) (\d+) (\d+) (\d+)$")
SECTION_RE = re.compile(r"^Cambridge International (A Level \(linear assessment\)|A Level \(staged assessment\)|AS Level|A Level)$")
ROUTE_RE = re.compile(r"^((?:\d{2}, )*\d{2}) (\d+)((?: \d+){5,6})$")
# The older layout (series up to November 2025): an option code first, the
# maximum, then the route, with a long route wrapping onto the next line, and
# "–" where AS has no A*:  "AX 260 11, 21, 31, 41, 210 183 156 131 106 82" / "51".
OLD_ROUTE_RE = re.compile(r"^([A-Z][A-Z0-9]{0,3}) (\d+) ((?:\d{2}, )*\d{2},?) ((?:[–-]|\d+)(?: \d+){4,5})$")
CONTINUATION_RE = re.compile(r"^(\d{2}(?:, \d{2})*),?$")
GRADE_HEAD_AS = re.compile(r"(^|\s)a b c d e$")
GRADE_HEAD_A = re.compile(r"(^|\s)A\* A B C D E$")
WEIGHT_RE = re.compile(r"^(January|February|March|April|May|June|July|August|September|October|November|December) "
                       r"(\d{4}) (\d{4}) (\d{2}) (\d+) (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)$")
SECTIONS = {"A Level (linear assessment)": ("a_level", "linear"), "A Level": ("a_level", "linear"),
            "A Level (staged assessment)": ("a_level", "staged"), "AS Level": ("as", "as")}
GRADES = {"a_level": ["A*", "A", "B", "C", "D", "E"], "as": ["a", "b", "c", "d", "e"]}
HALF = Fraction(1, 2)


def decimal_text(f):
    """A factor as a decimal string SQL can read, never "3/4": exact where it
    terminates (0.75), otherwise to 12 places (5/3 → 1.666666666667)."""
    from decimal import Decimal, localcontext
    with localcontext() as ctx:
        ctx.prec = 28
        d = (Decimal(f.numerator) / Decimal(f.denominator)).quantize(Decimal("1e-12"))
    return format(d.normalize(), "f")


def series_key(month, year):
    return f"{int(year):04d}-{MONTHS[month]:02d}"


def parse_threshold_lines(lines):
    """Lines of one threshold table, in reading order."""
    out = {"series": None, "syllabus_code": None, "components": {}, "routes": []}
    section = None
    head = None      # grade header last seen: AS-only tables print no section heading
    wrapping = None  # an older-layout route whose components continue on the next line
    for i, raw in enumerate(lines):
        line = raw.strip()
        prev = lines[i - 1].strip() if i else ""
        if wrapping is not None:
            more = CONTINUATION_RE.match(line)
            if more:
                wrapping["components"].extend(more.group(1).split(", "))
                wrapping = None
                continue
            wrapping = None
        if GRADE_HEAD_AS.search(line):
            head = "as"
        elif GRADE_HEAD_A.search(line):
            head = "a_level"
        o = OLD_ROUTE_RE.match(line)
        if o:
            comps = [c for c in o.group(3).rstrip(",").split(", ") if c]
            tokens = o.group(4).split()
            # "–" in the A* column, or an AS-only table with no A* column at all.
            is_as = tokens[0] in ("–", "-") or len(tokens) == 5
            grades = [int(x) for x in tokens if x not in ("–", "-")]
            if is_as != (len(grades) == 5):
                continue  # neither layout: read nothing rather than guess
            staged = any(c[0] in "789" for c in comps)
            route = {"qualification": "as" if is_as else "a_level",
                     "assessment": "as" if is_as else ("staged" if staged else "linear"),
                     "components": comps, "max_total": int(o.group(2)), "grades": grades}
            out["routes"].append(route)
            if o.group(3).endswith(","):
                wrapping = route
            continue
        t = TITLE_RE.match(line)
        if t and out["series"] is None:
            out["series"] = series_key(t.group(1), t.group(2))
            continue
        if out["syllabus_code"] is None and line.startswith("Cambridge International") and SYLLABUS_RE.search(line):
            out["syllabus_code"] = SYLLABUS_RE.search(line).group(1)
            continue
        # A long title wraps its code onto a line of its own: "... Research" / "(9239)".
        if out["syllabus_code"] is None and prev.startswith("Cambridge International") and re.fullmatch(r"\((\d{4})\)", line):
            out["syllabus_code"] = line[1:5]
            continue
        c = COMPONENT_RE.match(line)
        if c:
            out["components"][c.group(1)] = (int(c.group(2)), [int(x) for x in c.group(3, 4, 5, 6, 7)])
            continue
        s = SECTION_RE.match(line)
        if s:
            section = s.group(1)
            continue
        r = ROUTE_RE.match(line)
        if r and (section or head):
            qual, assessment = SECTIONS[section] if section else (("as", "as") if head == "as" else ("a_level", "linear"))
            out["routes"].append({
                "qualification": qual, "assessment": assessment,
                "components": r.group(1).split(", "), "max_total": int(r.group(2)),
                "grades": [int(x) for x in r.group(3).split()],
            })
    for r in out["routes"]:
        if r["assessment"] == "linear" and not all(c in out["components"] for c in r["components"]):
            r["assessment"] = "staged"  # carries a component with no thresholds here
    return out


def parse_weighting_lines(lines):
    """{(series_key, syllabus_code, component): (raw_max, weighted_max, factor)}"""
    out = {}
    for raw in lines:
        m = WEIGHT_RE.match(raw.strip())
        if m:
            out[(series_key(m.group(1), m.group(2)), m.group(3), m.group(4))] = (
                int(m.group(5)), Fraction(m.group(6)), Fraction(m.group(7)))
    return out


def check_route(table, route, weights):
    """Returns (checks, factors). checks: {name: true|false|"not_checked"}."""
    code, series = table["syllabus_code"], table["series"]
    comps = route["components"]
    grades = route["grades"]
    names = GRADES[route["qualification"]]
    checks = {"title": bool(code and series), "grade_count": len(grades) == len(names),
              "order": all(a > b for a, b in zip(grades, grades[1:]))}
    in_table = all(c in table["components"] for c in comps)
    in_weights = all((series, code, c) in weights for c in comps)
    if not (in_table and in_weights):
        checks["components"] = False
        checks["max"] = checks["a_e"] = checks["factor"] = "not_checked"
        return checks, None
    # The exact factor is weighted maximum / raw maximum; the printed factor is
    # rounded (1.66667 for 5/3) and must agree with it to the places printed.
    def exact(c):
        raw, wmax, printed = weights[(series, code, c)]
        return wmax / raw, printed
    checks["components"] = all(table["components"][c][0] == weights[(series, code, c)][0] for c in comps)
    checks["factor"] = all(abs(e - p) <= Fraction(1, 100000) for e, p in (exact(c) for c in comps))
    w = [exact(c)[0] for c in comps]
    total = sum(f * table["components"][c][0] for f, c in zip(w, comps))
    checks["max"] = total == route["max_total"]
    if checks["grade_count"]:
        a_sum = sum(f * table["components"][c][1][0] for f, c in zip(w, comps))
        e_sum = sum(f * table["components"][c][1][4] for f, c in zip(w, comps))
        a_pub, e_pub = grades[-5], grades[-1]
        checks["a_e"] = abs(a_sum - a_pub) <= HALF and abs(e_sum - e_pub) <= HALF
    else:
        checks["a_e"] = False
    return checks, dict(zip(comps, w))


def paper_of(component):
    """Paper number of a two-digit component: "31" is paper 3 variant 1;
    single-paper syllabuses number from "01", where "02" is paper 2."""
    return int(component[1]) if component[0] == "0" else int(component[0])


def verified(checks):
    return all(v is True for v in checks.values())


def routes_for_db(table, weights):
    """One dict per route, ready to write: paper numbers, maxima and factors
    keyed by paper number, grades with their names, checks and status."""
    out = []
    for route in table["routes"]:
        checks, factors = check_route(table, route, weights)
        papers = [paper_of(c) for c in route["components"]]
        if len(set(papers)) != len(papers):
            checks["papers_distinct"] = False  # two variants of one paper in one route: not a route we can read
        status = "verified" if verified(checks) and route["assessment"] != "staged" else "draft"
        names = GRADES[route["qualification"]]
        grades = route["grades"][-len(names):] if len(route["grades"]) >= len(names) else route["grades"]
        out.append({
            "qualification": route["qualification"], "assessment": route["assessment"],
            "option_code": ",".join(route["components"]),
            "components": sorted(papers),
            "component_max": {str(paper_of(c)): table["components"][c][0] for c in route["components"] if c in table["components"]},
            "component_weight": {str(paper_of(c)): decimal_text(factors[c]) for c in route["components"]} if factors else {},
            "max_total": route["max_total"],
            "grades": list(zip(names, grades)),
            "checks": checks, "status": status,
        })
    return out


# ── discovery: links on the board's own listing pages ──────────────────────

# The code may be followed by a level word ("8027-as-level-june-2026-...").
GT_PDF_RE = re.compile(r'href="([^"]*?-(\d{4})-(?:[a-z]+-){0,3}?(january|february|march|april|may|june|july|august|september|october|november|december)-(\d{4})-grade-threshold-table\.pdf)"', re.I)
GT_SERIES_RE = re.compile(r'href="([^"]*/grade-threshold-tables/([a-z]+-?\d{4}[^"/]*)/?(?:index\.aspx)?)"', re.I)
TT_PDF_RE = re.compile(r'href="([^"]*?(january|february|march|april|may|june|july|august|september|october|november|december)-(\d{4})-zone-(\d)(-uk)?-timetable[^"]*\.pdf)"', re.I)
BASE = "https://www.cambridgeinternational.org"


def absolute(href):
    return href if href.startswith("http") else BASE + href


def threshold_series_pages(html):
    """Series pages linked from a qualification's grade threshold page, newest first as listed."""
    seen, out = set(), []
    for href, slug in GT_SERIES_RE.findall(html):
        url = absolute(href).replace("/index.aspx", "").rstrip("/") + "/"
        if url not in seen:
            seen.add(url)
            out.append(url)
    return out


def threshold_pdfs(html):
    """[(url, syllabus_code, series_key)] from one series page."""
    out = {}
    for href, code, month, year in GT_PDF_RE.findall(html):
        out[absolute(href)] = (code, series_key(month.capitalize(), year))
    return [(u, c, s) for u, (c, s) in out.items()]


def timetable_pdfs(html):
    """[(url, series_key, series_label, zone, variant)] zone timetables on the exams officers' page."""
    out = {}
    for href, month, year, zone, uk in TT_PDF_RE.findall(html):
        m = month.capitalize()
        out[absolute(href)] = (series_key(m, year), f"{m} {year}", int(zone), "uk" if uk else "")
    return [(u, *v) for u, v in out.items()]
