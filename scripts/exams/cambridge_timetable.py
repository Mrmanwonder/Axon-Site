"""Reads a Cambridge final exam timetable PDF (one series, one administrative
zone) into rows: qualification, syllabus code, component, title, date, session
and duration. Pure facts from the board's own document; nothing is inferred.

The weekly view is read for the rows. The syllabus (A-Z) view of the same PDF
is then used as an independent check: every component must appear in both,
and wherever the syllabus view prints a full date on the component's line, it
must equal the weekly view's date. Any disagreement fails the run.

Run: python3 scripts/exams/cambridge_timetable.py <timetable.pdf>  (JSON on stdout)
"""

import json
import re
import sys
from datetime import date

MONTHS = {m: i + 1 for i, m in enumerate(
    "January February March April May June July August September October November December".split())}
DAYS = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}
QUAL = {"IG": "igcse", "9-1": "igcse_9_1", "9–1": "igcse_9_1", "OL": "o_level", "AS": "as", "AL": "a_level"}
CODE_RE = re.compile(r"^(\d{4})/(\d{2})$")
DUR_RE = re.compile(r"^(\d+)(h|m)$")
SESSIONS = {"AM", "PM", "EV"}


def rows_of(words, tol=2.5):
    rows = []
    for w in sorted(words, key=lambda w: (round(w["top"]), w["x0"])):
        if rows and abs(rows[-1][0] - w["top"]) <= tol:
            rows[-1][1].append(w)
        else:
            rows.append([w["top"], [w]])
    return [sorted(r[1], key=lambda w: w["x0"]) for r in rows]


def minutes(tokens):
    total = 0
    for t in tokens:
        m = DUR_RE.match(t)
        total += int(m.group(1)) * (60 if m.group(2) == "h" else 1)
    return total


def parse_entry(ws):
    """One half-row: [prefix] name... code duration... session."""
    texts = [w["text"] for w in ws]
    ci = next((i for i, t in enumerate(texts) if CODE_RE.match(t)), None)
    if ci is None:
        return None
    prefix = texts[0] if texts[0] in QUAL else None
    name = " ".join(texts[1 if prefix else 0:ci]).strip()
    rest = texts[ci + 1:]
    session = next((t for t in rest if t in SESSIONS), None)
    dur = [t for t in rest if DUR_RE.match(t)]
    if not (prefix and name and session and dur):
        raise ValueError(f"unreadable timetable row: {' '.join(texts)}")
    code, comp = CODE_RE.match(texts[ci]).groups()
    return {"qualification": QUAL[prefix], "syllabus_code": code, "component": comp,
            "title": name, "session": session, "duration_minutes": minutes(dur)}


WEEKDAY = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def week_range(m, year):
    """The dates a week header covers: "28 September–02 October 2026" or
    "05–09 October 2026"."""
    d1, m1, d2, m2 = int(m.group(1)), m.group(2) or m.group(4), int(m.group(3)), m.group(4)
    y1 = year - 1 if (MONTHS[m1] == 12 and MONTHS[m2] == 1) else year
    return date(y1, MONTHS[m1], d1), date(year, MONTHS[m2], d2)


def day_date(weekday, day, month, lo, hi, errata, where):
    """A day header's date. It must fall inside its week and name the right
    weekday. When the printed month contradicts both, and exactly one date in
    the week has that day number and weekday, that date is used and the
    correction is reported (the A-Z cross-check must then agree)."""
    printed = None
    for y in {lo.year, hi.year}:
        try:
            printed = date(y, MONTHS[month], day)
        except ValueError:
            continue
        if lo <= printed <= hi and WEEKDAY[printed.weekday()] == weekday:
            return printed
    cands = []
    d = lo
    while d <= hi:
        if d.day == day and WEEKDAY[d.weekday()] == weekday:
            cands.append(d)
        d = date.fromordinal(d.toordinal() + 1)
    if len(cands) != 1:
        raise ValueError(f"{where}: '{weekday} {day:02d} {month}' is not in its week {lo}..{hi}")
    errata.append(f"{where}: printed '{weekday} {day:02d} {month}' read as {cands[0].isoformat()} "
                  f"(the only {weekday} {day:02d} in the week {lo.isoformat()} to {hi.isoformat()})")
    return cands[0]


def weekly(pdf, errata=None):
    errata = [] if errata is None else errata
    out = []
    for page in pdf.pages:
        text = page.extract_text() or ""
        # Weekly pages carry a week range ("05–09 October 2026") and a column
        # header without a Date column; the A-Z view's header has one.
        if "Syllabus/Component Code Duration Session" not in text or "Duration Date Session" in text:
            continue
        head = re.search(r"^(\d{2})(?: (\w+))?[–-](\d{2}) (\w+) (\d{4})$", text, re.M)
        if not head:
            raise ValueError(f"page {page.page_number}: week header not found")
        lo, hi = week_range(head, int(head.group(5)))
        mid = page.width / 2
        # Day headers split the page into blocks; each block's rows are read
        # per column. A long component name is set on two lines centred on
        # the code row, so name-only lines join the nearest code row.
        blocks = []
        for row in rows_of(page.extract_words()):
            first = row[0]["text"]
            if first in DAYS and len(row) >= 3 and row[2]["text"] in MONTHS:
                blocks.append((day_date(first, int(row[1]["text"]), row[2]["text"], lo, hi, errata,
                                        f"page {page.page_number}"), []))
                continue
            if first == "Sessions:":
                break  # the page footer (session and qualification keys)
            if first == "Syllabus/Component" or not blocks:
                continue
            blocks[-1][1].append(row)
        for day, rows in blocks:
            for side in ("L", "R"):
                lines = [[w for w in r if (w["x0"] < mid) == (side == "L")] for r in rows]
                lines = [ws for ws in lines if ws]
                anchors = [ws for ws in lines if any(CODE_RE.match(w["text"]) for w in ws)]
                extra = {id(a): [] for a in anchors}
                for ws in lines:
                    if ws in anchors:
                        continue
                    near = min(anchors, key=lambda a: abs(a[0]["top"] - ws[0]["top"]), default=None)
                    if near is None or abs(near[0]["top"] - ws[0]["top"]) > 9:
                        raise ValueError(f"page {page.page_number}: stray line {' '.join(w['text'] for w in ws)}")
                    extra[id(near)].append(ws)
                for a in anchors:
                    above = [w for ws in extra[id(a)] if ws[0]["top"] < a[0]["top"] for w in ws]
                    below = [w for ws in extra[id(a)] if ws[0]["top"] > a[0]["top"] for w in ws]
                    prefix = [w for w in a if w["text"] in QUAL]
                    rest = [w for w in a if w not in prefix]
                    ci = next(i for i, w in enumerate(rest) if CODE_RE.match(w["text"]))
                    ordered = prefix + above + rest[:ci] + below + rest[ci:]
                    e = parse_entry(ordered)
                    e["date"] = day.isoformat()
                    out.append(e)
    return out


WINDOW_QUAL = {"Cambridge IGCSE": "igcse", "Cambridge IGCSE (9–1)": "igcse_9_1", "Cambridge O Level": "o_level",
               "Cambridge International AS Level": "as", "Cambridge International A Level": "a_level"}
WINDOW_RE = re.compile(r"^(.+) (\d{4})/(\d{2}) (\d{2})/(\d{2})/(\d{4})[–-](\d{2})/(\d{2})/(\d{4})$")


def windows(pdf):
    """Components taken inside a window (speaking, practicals) rather than
    on one fixed date. The school sets the day; Axon shows the window."""
    out = []
    for page in pdf.pages:
        text = page.extract_text() or ""
        if "Test date window" not in text:
            continue
        qual = None
        for line in text.split("\n"):
            line = line.strip()
            if line in WINDOW_QUAL:
                qual = WINDOW_QUAL[line]
                continue
            m = WINDOW_RE.match(line)
            if not m:
                continue
            if qual is None:
                raise ValueError(f"window row before a qualification heading: {line}")
            g = m.groups()
            out.append({"qualification": qual, "syllabus_code": g[1], "component": g[2], "title": g[0],
                        "window_start": date(int(g[5]), int(g[4]), int(g[3])).isoformat(),
                        "window_end": date(int(g[8]), int(g[7]), int(g[6])).isoformat()})
    return out


def syllabus_view_check(pdf, rows):
    """Cross-check against the A-Z view: same components, and the same date
    wherever that view prints a full date on the component's own line."""
    problems = []
    seen = set()
    full = re.compile(r"(\d{4}/\d{2}) .*?(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) (\d{2}) (\w+) (\d{4})")
    for page in pdf.pages:
        text = page.extract_text() or ""
        if "Duration Date Session" not in text:
            continue
        for code in re.findall(r"\b\d{4}/\d{2}\b", text):
            seen.add(code)
        for line in text.split("\n"):
            for m in full.finditer(line):
                code = m.group(1)
                d = date(int(m.group(5)), MONTHS[m.group(4)], int(m.group(3))).isoformat()
                # The A-Z view sets two columns side by side; only a date that
                # follows the code with no other code between them belongs to it.
                between = line[m.start():m.end()]
                if len(re.findall(r"\d{4}/\d{2}", between)) != 1:
                    continue
                mine = [r for r in rows if f"{r['syllabus_code']}/{r['component']}" == code]
                if mine and all(r["date"] != d for r in mine):
                    problems.append(f"{code}: weekly view {mine[0]['date']}, syllabus view {d}")
    weekly_codes = {f"{r['syllabus_code']}/{r['component']}" for r in rows}
    missing = sorted(weekly_codes - seen)
    if missing:
        problems.append(f"{len(missing)} components in the weekly view are absent from the syllabus view: {missing[:5]}")
    return problems


def main():
    import pdfplumber  # imported here so the pure functions test without it

    with pdfplumber.open(sys.argv[1]) as pdf:
        first = pdf.pages[0].extract_text() or ""
        series = re.search(r"Final Exam Timetable (\w+) (\d{4})", first)
        zone = re.search(r"Administrative zone (\d)", first)
        version = None
        for page in pdf.pages:
            v = re.search(r"Version \d+, \w+ \d{4}", page.extract_text() or "")
            if v:
                version = v.group(0)
                break
        if not series:
            raise SystemExit("not a Cambridge final timetable")
        errata = []
        rows = weekly(pdf, errata)
        problems = syllabus_view_check(pdf, rows)
        wins = windows(pdf)
    json.dump({"series": f"{series.group(1)} {series.group(2)}", "zone": int(zone.group(1)) if zone else None,
               "version": version, "rows": rows, "windows": wins, "errata": errata, "problems": problems}, sys.stdout, indent=1)


if __name__ == "__main__":
    main()
