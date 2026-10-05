#!/usr/bin/env python3
"""Text extraction for syllabus PDFs that keeps mathematics readable.

`pdftotext -layout` loses three things the board's maths notation depends on:

  * MathType fonts (MMGreek, MMBinary, MMRelation, ...) carry no Unicode map, so
    their glyphs come out as the ASCII letter in the same slot: omega as "~",
    times as "#", an arrow as '"'.
  * A stacked fraction is two extra lines above and below the text line, which a
    line-based parser either drops or mixes into the wrong objective.
  * Superscripts and subscripts become separate lines or lose their position.

This script reads the characters with their font, size and position
(pdfplumber), maps MathType glyphs from a table checked against the rendered
glyphs, writes fractions inline as a/b, writes scripts as Unicode where a
superscript or subscript character exists (x^(...) otherwise), and lays the
text out in fixed-width columns in the same shape `pdftotext -layout` gives,
so the parser in cambridge.mjs reads it unchanged. Pages are separated by a
form feed.

Usage: extract.py <file.pdf>  (text to stdout)
"""

import re
import sys


# --- Glyph map ---------------------------------------------------------------
# Keyed by the font family (subset prefix removed) and the character pdfplumber
# reports. Each entry was checked against the rendered glyph in the syllabus
# PDFs of 9709, 9231, 9702 and 9618 (AXO-198). A glyph not listed here is kept
# as reported, and the audit in cambridge.mjs rejects the known bad stand-ins.
GLYPHS = {
    "MMArrow": {'"': "→", "7": "↦"},
    "MMBinary": {"!": "±", "#": "×", "+": "∩", ",": "∪"},
    "MMEtc": {"3": "∞", "c": "°", "l": "′"},
    "MMExtra": {"1": "<", "2": ">"},
    "MMGreek": {"-": "−", "D": "Δ", "r": "π"},
    "MMGreekItalic": {"a": "α", "f": "ε", "i": "θ", "m": "λ", "n": "μ", "v": "σ", "|": "χ", "~": "ω"},
    "MMGreekBoldItalic": {"|": "χ"},
    "MMRelation": {"!": "∈", "+": "∼", ".": "≈", "/": "≡", "G": "⩽", "H": "⩾"},
    "MMVariable": {"/": "Σ", "y": "∫"},
    "MMVariableD": {";": "∫", ">": "∫"},
    "MMaFermat-Regular": {"R": "ℝ"},
    "MMaGreek-Regular": {" ": "λ"},
    "MTExtra": {"K": "…", "m": "∓"},
}
# Accents drawn as their own glyph over the letter they mark.
ACCENTS = {("MMEtc", "r"): "̄", ("MMEtc", "t"): "̂"}
# Pieces of tall brackets: one bracket however many pieces draw it.
PIECES = {
    "MMVariableA": {**{k: "(" for k in "^_`cef"}, **{k: ")" for k in "hijmop"}},
    "Symbol": {"": "(", "": "(", "": "(", "": ")", "": ")", "": ")",
               "": "[", "": "[", "": "[", "": "]", "": "]", "": "]",
               "": "{", "": "{", "": "{", "": "}", "": "}", "": "}"},
}

SUP = dict(zip("0123456789+−-–=()abcdefghijklmnoprstuvwxyz", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁻⁻⁼⁽⁾ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻ"))
SUB = dict(zip("0123456789+−-–=()aehijklmnoprstuvxο½", "₀₁₂₃₄₅₆₇₈₉₊₋₋₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓₒ½"))
SUP_CHARS = "".join(sorted(set(SUP.values())))
SUB_CHARS = "".join(sorted(set(SUB.values()) - {"½"}))
VULGAR = {("1", "2"): "½", ("1", "3"): "⅓", ("2", "3"): "⅔", ("1", "4"): "¼", ("3", "4"): "¾", ("3", "2"): "3/2"}
CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")

CHAR_W = 4.4  # points per layout column; narrow enough that body text never overruns its column
COLUMN_GAP = 10.0  # a horizontal gap this wide (points) separates columns, not words
LINE_H = 12.0  # points per layout row


def family(c):
    return c["fontname"].split("+")[-1]


def normalise(chars, height):
    """Map glyphs, and give every character a box built from its baseline.
    MathType's glyph boxes are unreliable (a bracket's box can sit most of an
    em below the bracket), but every glyph's baseline is exact, so all vertical
    reasoning below works from the baseline: a superscript's is raised, a
    numerator's sits above the fraction bar, and so on."""
    out = []
    for c in chars:
        if not c.get("upright", True):
            continue
        fam, t = family(c), c["text"]
        c = dict(c)
        base = height - c["matrix"][5]
        if abs(base - c["bottom"]) > 3 * c["size"]:
            # Text inside a form XObject: its matrix is in the form's own
            # space, so fall back to the box (these are page furniture).
            base = c["bottom"] - 0.22 * c["size"]
        c["top"], c["bottom"], c["base"] = base - 0.72 * c["size"], base + 0.22 * c["size"], base
        if (fam, t) in ACCENTS:
            c["accent"] = ACCENTS[(fam, t)]
        elif fam in PIECES and t in PIECES[fam]:
            c["text"], c["piece"] = PIECES[fam][t], True
            # MathType's one-glyph tall brackets (column vectors, nCr).
            c["tall"] = fam == "MMVariableA" and t in "efop"
        else:
            c["text"] = GLYPHS.get(fam, {}).get(t, t)
        c["text"] = CONTROL.sub("", c["text"])
        if c["text"] or c.get("accent"):
            out.append(c)
    return out


def merge_pieces(chars):
    """A tall bracket drawn from stacked pieces becomes one bracket."""
    pieces = sorted((c for c in chars if c.get("piece")), key=lambda c: (c["text"], round(c["x0"]), c["top"]))
    rest = [c for c in chars if not c.get("piece")]
    groups = []
    for c in pieces:
        g = groups[-1] if groups else None
        if g and g[-1]["text"] == c["text"] and abs(g[-1]["x0"] - c["x0"]) < 1.5 and c["top"] - g[-1]["bottom"] < 3:
            g.append(c)
        else:
            groups.append([c])
    singles = []
    tall = lambda g: len(g) >= 2 or g[0].get("tall")

    def span(g):
        if len(g) >= 2:
            return min(c["top"] for c in g) - 2, max(c["bottom"] for c in g) + 2
        c = g[0]
        return c["base"] - 1.45 * c["size"], c["base"] + 0.95 * c["size"]

    lefts = [g for g in groups if g[0]["text"] in "([{" and tall(g)]
    rights = [g for g in groups if g[0]["text"] in ")]}" and tall(g)]
    used = set()
    for L in lefts:
        lt, lb = span(L)
        lx = max(c["x1"] for c in L)
        cands = [R for R in rights if id(R) not in used and min(c["x0"] for c in R) > lx
                 and min(span(R)[1], lb) - max(span(R)[0], lt) > 0.6 * (lb - lt)]
        if not cands:
            continue
        R = min(cands, key=lambda R: min(c["x0"] for c in R))
        rx = min(c["x0"] for c in R)
        # MathType bracket boxes sit up to ~8pt low; look for rows a little above too.
        inner = [c for c in rest if lx - 0.5 <= (c["x0"] + c["x1"]) / 2 <= rx + 0.5
                 and lt <= (c["top"] + c["bottom"]) / 2 <= lb and c["text"].strip()]
        rows = []
        for c in sorted(inner, key=lambda c: (c["top"] + c["bottom"]) / 2):
            m = (c["top"] + c["bottom"]) / 2
            if rows and abs(rows[-1]["mid"] - m) <= 3.5:
                rows[-1]["chars"].append(c)
            else:
                rows.append({"mid": m, "chars": [c]})
        if len(rows) < 2:
            continue
        used.update({id(L), id(R)})
        ids = {id(c) for c in inner}
        rest = [c for c in rest if id(c) not in ids]
        body = "; ".join(render(r["chars"]) for r in rows)
        mid = sum(r["mid"] for r in rows) / len(rows)
        tok = {"text": f"{L[0]['text']}{body}{R[0]['text']}", "x0": L[0]["x0"], "x1": max(c["x1"] for c in R),
               "top": mid - 5, "bottom": mid + 5, "size": 10.0, "fontname": "matrix", "token": True}
        rest.append(tok)
    for g in groups:
        if id(g) in used:
            continue
        top, bottom = min(c["top"] for c in g), max(c["bottom"] for c in g)
        mid = (top + bottom) / 2
        one = dict(g[0], top=mid - 5, bottom=mid + 5, size=10.0)
        one.pop("piece", None)
        if len(g) == 1:
            one = dict(g[0])
            one.pop("piece", None)
        rest.append(one)
    return rest


TALL = {"MMVariable", "MMVariableA", "MMVariableD"}


def snap(c, others):
    """MathType's tall glyphs report a box several points below where they are
    drawn. Put such a glyph on the line of the nearest character beside it."""
    cy = (c["top"] + c["bottom"]) / 2
    beside = lambda o: min(abs(o["x0"] - c["x1"]), abs(c["x0"] - o["x1"])) <= 15
    ok = lambda o: family(o) not in TALL and o["text"].strip() and beside(o)
    near = [o for o in others if ok(o) and -11 <= (o["top"] + o["bottom"]) / 2 - cy <= -3]
    if not near:
        near = [o for o in others if ok(o) and abs((o["top"] + o["bottom"]) / 2 - cy) <= 12]
    if not near:
        return c
    o = min(near, key=lambda o: min(abs(o["x0"] - c["x1"]), abs(c["x0"] - o["x1"])))
    return dict(c, top=o["top"], bottom=o["bottom"], size=o["size"])


def attach_accents(chars):
    marks = [c for c in chars if c.get("accent")]
    rest = [c for c in chars if not c.get("accent")]
    for m in marks:
        cx = (m["x0"] + m["x1"]) / 2
        base = [c for c in rest if c["x0"] - 1 <= cx <= c["x1"] + 1 and c["top"] >= m["top"] - 2 and c["top"] - m["bottom"] < 8]
        if base:
            b = min(base, key=lambda c: abs((c["x0"] + c["x1"]) / 2 - cx))
            b["text"] = b["text"] + m["accent"]
    return rest


def script_text(seq, table, mark):
    text = "".join(c["text"] for c in seq)
    if all(ch in table for ch in text):
        return "".join(table[ch] for ch in text)
    return f"{mark}({text})" if len(text) > 1 else f"{mark}{text}"


OPERATORS = set("+−-–=×÷±∓<>⩽⩾≈≡∼∈∩∪→↦,.:;")


def classify(chars):
    """Mark each character of one line as a superscript, a subscript or neither,
    from its size and how far its centre sits from the line's main characters."""
    if not chars:
        return
    sizes = sorted(c["size"] for c in chars if c["text"].strip())
    if not sizes:
        return
    big_size = sizes[len(sizes) // 2]
    big = [c for c in chars if c["size"] >= 0.85 * big_size and c["text"].strip()] or chars
    base_mid = sorted((c["top"] + c["bottom"]) / 2 for c in big)[len(big) // 2]
    for c in chars:
        kind = None
        # A folded fraction or root is a term of its own, never a script.
        if (not c.get("token") and c["text"] != " " and c["size"] < 0.85 * big_size
                and not (c["text"] in OPERATORS - set("+−-–=.,") and c["size"] >= 0.75 * big_size)
                and c["text"] not in "Σ∫∑" and family(c) not in TALL):
            mid = (c["top"] + c["bottom"]) / 2
            if mid < base_mid - 0.15 * big_size:
                kind = "sup"
            elif mid > base_mid + 0.15 * big_size:
                kind = "sub"
        c["kind"] = kind


def is_prescript(prev, run, nxt):
    """Scripts written before their symbol (a nuclide's ²³⁸₉₂U) are set apart
    from the word before them and close up to the symbol after; anything else
    belongs to the symbol before it."""
    if not run or nxt is None:
        return False
    after = nxt["x0"] - max(x["x1"] for x in run)
    before = min(x["x0"] for x in run) - prev["x1"] if prev is not None else 99
    after_operator = prev is not None and prev["text"] in OPERATORS
    return after < 2.5 and (before >= 2.5 or after_operator)


def render(chars):
    """Characters of one line as text: scripts written inline, gaps as spaces.
    A superscript and a subscript stacked at the same place (a nuclide's mass
    and proton numbers, x₀²) print as the superscript run, then the subscript run."""
    if not chars:
        return ""
    chars = sorted(chars, key=lambda c: c["x0"])
    if any("kind" not in c for c in chars):
        classify(chars)
    out, last = [], None
    i = 0
    while i < len(chars):
        c = chars[i]
        if c.get("kind"):
            j = i
            cluster = []
            while j < len(chars) and (chars[j].get("kind") or (chars[j]["text"] == " " and j + 1 < len(chars) and chars[j + 1].get("kind"))):
                if chars[j]["text"] != " ":
                    cluster.append(chars[j])
                j += 1
            nxt = next((x for x in chars[j:] if x["text"].strip()), None)
            prev = next((x for x in reversed(chars[:i]) if x["text"].strip()), None)
            pre = is_prescript(prev, cluster, nxt)
            if out and out[-1] == " " and not pre:
                out.pop()
            # Before its symbol (a nuclide's numbers) the mass number comes
            # first; after it (x₀²) the subscript does.
            for kind in (("sup", "sub") if pre else ("sub", "sup")):
                part = [x for x in cluster if x["kind"] == kind]
                if part:
                    out.append(script_text(part, SUP if kind == "sup" else SUB, "^" if kind == "sup" else "_"))
            last = cluster[-1]
            i = j
            continue
        gap = c["x0"] - last["x1"] if last else 0
        if last and gap > 0.22 * max(c["size"], last["size"]) and c["text"] != " " and last["text"] != " ":
            out.append(" ")
        out.append(c["text"])
        last = c
        i += 1
    return close_scripts(re.sub(r" {2,}", " ", "".join(out)).strip())


def close_scripts(text):
    """No space inside a run of Unicode superscripts or subscripts."""
    return re.sub(rf"(?<=[{SUP_CHARS}]) (?=[{SUP_CHARS}])|(?<=[{SUB_CHARS}]) (?=[{SUB_CHARS}])", "", text)


def simple(t):
    if re.fullmatch(r"√\([^()]*\)", t):
        return True
    return re.fullmatch(r"[\w²³⁰¹⁴-⁹ⁿˣʸ′.θπωλμσαε]+", t) is not None or re.fullmatch(r"\w*\([^()]*\)", t) is not None


def wrap(t):
    return t if simple(t) else f"({t})"


def glued(group, chars, bar):
    """True when the group is part of a text line that runs past the bar's
    ends, so the bar is an underline or a rule, or the group is the line above
    or below rather than a numerator or denominator."""
    ids = {id(c) for c in group}
    mids = [(c["top"] + c["bottom"]) / 2 for c in group]
    for c in chars:
        if id(c) in ids or not c["text"].strip():
            continue
        m = (c["top"] + c["bottom"]) / 2
        if min(abs(m - g) for g in mids) > 1.2:
            continue
        if bar["x0"] - 8 <= c["x1"] <= bar["x0"] + 0.3 or bar["x1"] - 0.3 <= c["x0"] <= bar["x1"] + 8:
            return True
    return False


def fold_fractions(page, chars):
    bars = [o for o in list(page.rects) + list(page.lines)
            if o["height"] <= 1.2 and 3 <= o["width"] <= 150]
    for bar in sorted(bars, key=lambda b: b["width"]):
        inside = lambda c: bar["x0"] - 0.6 <= (c["x0"] + c["x1"]) / 2 <= bar["x1"] + 0.6
        y = (bar["top"] + bar["bottom"]) / 2
        mid = lambda c: (c["top"] + c["bottom"]) / 2
        num = den = None
        for reach in (15, 12.5, 9):
            n = [c for c in chars if inside(c) and c["text"].strip() and 0 < y - mid(c) <= reach]
            d = [c for c in chars if inside(c) and c["text"].strip() and 0 < mid(c) - y <= reach]
            if n and d and not glued(n, chars, bar) and not glued(d, chars, bar):
                num, den = n, d
                break
        if not num:
            continue
        a, b = render(num), render(den)
        if not a or not b:
            continue
        token = VULGAR.get((a, b)) or f"{wrap(a)}/{wrap(b)}"
        used = {id(c) for c in num + den}
        chars = [c for c in chars if id(c) not in used]
        size = max(c["size"] for c in num + den)
        chars.append({"text": token, "x0": bar["x0"], "x1": bar["x1"], "top": y - 0.47 * size, "bottom": y + 0.47 * size,
                      "size": size, "fontname": "fraction", "token": True})
    return chars


def fold_radicals(page, chars):
    """A square root is drawn as one stroked path: up from the bottom left, then
    a bar along the top over the radicand. Write it as √(…)."""
    for o in page.curves:
        pts = o.get("pts") or []
        if len(pts) < 3 or not 6 <= o["height"] <= 30 or not 5 <= o["width"] <= 150:
            continue
        (xa, ya), (xb, yb) = pts[-2], pts[-1]
        top = min(y for _, y in pts)
        if abs(ya - yb) > 0.6 or abs(ya - top) > 0.6 or xb - xa < 3:
            continue
        x0, y0 = pts[0]
        if y0 < top + 0.6 * o["height"] or x0 > xa:
            continue
        under = [c for c in chars if xa - 1 <= (c["x0"] + c["x1"]) / 2 <= xb + 1
                 and top - 1 <= (c["top"] + c["bottom"]) / 2 <= o["bottom"] + 2 and c["text"].strip()]
        if not under:
            continue
        ids = {id(c) for c in under}
        chars = [c for c in chars if id(c) not in ids]
        body = render(under)
        ref = max(under, key=lambda c: c["size"])
        chars.append({"text": f"√{wrap(body)}", "x0": x0, "x1": xb, "top": ref["top"], "bottom": ref["bottom"],
                      "base": ref.get("base"), "size": ref["size"], "fontname": "radical", "token": True})
    return chars


def modulus_bars(page, chars):
    """Modulus bars drawn as thin vertical rules become '|'."""
    for o in list(page.rects) + list(page.lines):
        if o["width"] <= 1.2 and 7 <= o["height"] <= 16:
            beside = [c for c in chars if c["text"].strip() and abs((c["top"] + c["bottom"]) / 2 - (o["top"] + o["bottom"]) / 2) <= 4
                      and min(abs(c["x0"] - o["x1"]), abs(o["x0"] - c["x1"])) <= 8]
            if beside:
                ref = beside[0]
                chars.append({"text": "|", "x0": o["x0"], "x1": o["x1"] + 1, "top": ref["top"], "bottom": ref["bottom"],
                              "size": ref["size"], "fontname": "rule"})
    return chars


def hgap(c, chars):
    """Horizontal distance from c to the nearest of chars (0 when they overlap)."""
    return min(max(0.0, o["x0"] - c["x1"], c["x0"] - o["x1"]) for o in chars)


def seat_tokens(chars):
    """A folded fraction or root sits on the line of the text beside it."""
    for t in [c for c in chars if c.get("token")]:
        y = (t["top"] + t["bottom"]) / 2
        near = [c for c in chars if not c.get("token") and c["text"].strip() and c["size"] >= 8.6
                and abs((c["top"] + c["bottom"]) / 2 - y) <= 9
                and min(abs(c["x0"] - t["x1"]), abs(t["x0"] - c["x1"])) <= 12]
        if near:
            n = min(near, key=lambda c: min(abs(c["x0"] - t["x1"]), abs(t["x0"] - c["x1"])))
            t["top"], t["bottom"] = n["top"], n["bottom"]
            t["size"] = max(t["size"], n["size"]) if t["size"] >= 8.6 else t["size"]
    return chars


def fold_marks(page, chars):
    """Bars and arrows drawn over letters: x̄ (a mean), AB⃗ (a vector)."""
    marks = [(o, "\u0304") for o in list(page.rects) + list(page.lines) if o["height"] <= 1.2 and 3 <= o["width"] <= 25]
    marks += [(o, "\u20d7") for o in page.curves if o["height"] <= 4.5 and 6 <= o["width"] <= 40]
    for o, mark in marks:
        y = (o["top"] + o["bottom"]) / 2
        under = [c for c in chars if not c.get("token") and c["text"].strip()
                 and o["x0"] - 1 <= (c["x0"] + c["x1"]) / 2 <= o["x1"] + 1 and 0 <= c["top"] - y <= 4]
        over = [c for c in chars if c["text"].strip() and o["x0"] - 1 <= (c["x0"] + c["x1"]) / 2 <= o["x1"] + 1
                and 0 < y - c["bottom"] <= 4]
        if not under or over or len(under) > 3:
            continue
        if mark == "\u0304":
            for c in under:
                c["text"] += mark
        else:
            max(under, key=lambda c: c["x1"])["text"] += mark
    return chars


def lines_of(chars):
    """Cluster characters into text lines. Full-size characters form the lines;
    a small character (a superscript, a subscript, a limit) joins the line of
    the character it sits against, so a script never lands on the line above
    or on the other column."""
    SMALL = 8.6
    big = [c for c in chars if c["size"] >= SMALL or c.get("token") or not c["text"].strip()]
    small = [c for c in chars if not (c["size"] >= SMALL or c.get("token") or not c["text"].strip())]
    lines = []

    def place(c, pool):
        mid = (c["top"] + c["bottom"]) / 2
        best = None
        for ln in pool:
            d = abs(ln["mid"] - mid)
            if d <= max(0.42 * c["size"], 0.42 * ln["size"]) and (best is None or d < best[0]):
                best = (d, ln)
        if best:
            ln = best[1]
            ln["chars"].append(c)
            if c["size"] > ln["size"] and c["text"].strip():
                ln["mid"], ln["size"] = mid, c["size"]
        else:
            pool.append({"mid": mid, "size": c["size"] if c["text"].strip() else 0, "chars": [c]})

    for c in sorted(big, key=lambda c: (c["top"] + c["bottom"]) / 2):
        place(c, lines)
    loose = list(small)
    changed = True
    while changed and loose:
        changed = False
        for c in list(loose):
            mid = (c["top"] + c["bottom"]) / 2
            cands = []
            for ln in lines:
                if abs(ln["mid"] - mid) > 8:
                    continue
                body = [o for o in ln["chars"] if o["text"].strip()]
                if body:
                    cands.append((hgap(c, body), abs(ln["mid"] - mid), ln))
            if cands:
                g, _, ln = min(cands, key=lambda t: (round(t[0]), t[1]))
                if g <= 4:
                    ln["chars"].append(c)
                    loose.remove(c)
                    changed = True
    extra = []
    for c in sorted(loose, key=lambda c: (c["top"] + c["bottom"]) / 2):
        place(c, extra)
    # A run of small characters with no base beside it is its own line, unless
    # it sits inside a full-size line's band (a footnote marker, a limit).
    for ln in extra:
        host = [l for l in lines if abs(l["mid"] - ln["mid"]) <= 3]
        if host:
            host[0]["chars"].extend(ln["chars"])
        else:
            lines.append(ln)
    return sorted(lines, key=lambda l: l["mid"])


def words_of(chars):
    """Split a line into words at real gaps, keeping each word's left edge."""
    chars = sorted(chars, key=lambda c: c["x0"])
    groups, cur = [], []
    for i, c in enumerate(chars):
        if c["text"] == " ":
            rest = chars[i + 1:]
            k = 0
            while k < len(rest) and (rest[k].get("kind") or rest[k]["text"] == " "):
                k += 1
            run = [x for x in rest[:k] if x["text"] != " "]
            after = next((x for x in rest[k:] if x["text"].strip()), None)
            pre = bool(run) and is_prescript(cur[-1] if cur else None, run, after)
            if cur and run and not pre and (cur[-1].get("kind") or run[0]["x0"] - cur[-1]["x1"] < 4):
                continue
            if cur:
                groups.append(cur)
            cur = []
            continue
        if cur and not c.get("kind") and c["x0"] - max(x["x1"] for x in cur) > 0.3 * max(c["size"], 8):
            groups.append(cur)
            cur = []
        cur.append(c)
    if cur:
        groups.append(cur)
    return [(min(c["x0"] for c in g), max(c["x1"] for c in g), render(g)) for g in groups]


NOTES = re.compile(r"Notes and (examples|guidance)")


def notes_x(page):
    """Left edge of the notes column header on this page, if there is one."""
    words = page.extract_words()
    for i, w in enumerate(words[:-2]):
        if w["text"] == "Notes" and words[i + 1]["text"] == "and" and words[i + 2]["text"] in ("examples", "guidance"):
            return w["x0"]
    return None


def page_text(page):
    nx = notes_x(page)
    ncol = round(nx / CHAR_W) if nx is not None else None
    chars = normalise(page.chars, page.height)
    chars = merge_pieces(chars)
    chars = attach_accents(chars)
    chars = modulus_bars(page, chars)
    chars = fold_radicals(page, chars)
    chars = fold_fractions(page, chars)
    chars = fold_marks(page, chars)
    chars = seat_tokens(chars)
    rows, prev_mid = [], None
    for ln in lines_of(chars):
        classify(ln["chars"])
        if prev_mid is not None:
            rows.extend([""] * max(0, min(4, round((ln["mid"] - prev_mid) / LINE_H) - 1)))
        prev_mid = ln["mid"]
        line, last_x1 = "", None
        for x0, x1, text in words_of(ln["chars"]):
            if not text:
                continue
            if last_x1 is None or x0 - last_x1 >= COLUMN_GAP:
                col = round(x0 / CHAR_W)
                if ncol is not None and x0 >= nx - 4:
                    col = max(col, ncol)
                if last_x1 is not None:
                    col = max(col, len(line) + 2)
                line += " " * (col - len(line))
            else:
                line += " "
            line += text
            last_x1 = x1
        rows.append(close_scripts(line.rstrip()))
    return "\n".join(rows)


def main():
    import pdfplumber  # imported here so the pure functions test without it

    with pdfplumber.open(sys.argv[1]) as pdf:
        sys.stdout.write("\f".join(page_text(p) for p in pdf.pages))


if __name__ == "__main__":
    main()
