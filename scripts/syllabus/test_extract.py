"""Tests for extract.py on synthetic characters (no PDF, no board text).

Run: python3 scripts/syllabus/test_extract.py
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))
import extract as E  # noqa: E402

H = 800.0


def ch(text, x0, base, size=11.0, font="ABCDEF+TimesNewRomanPSMT", width=None):
    w = width if width is not None else 0.5 * size
    return {
        "text": text, "fontname": font, "size": size, "x0": x0, "x1": x0 + w,
        # A deliberately wrong box: MathType boxes cannot be trusted, the baseline can.
        "top": base + 3, "bottom": base + 3 + size,
        "matrix": (1, 0, 0, 1, x0, H - base), "upright": True,
    }


def word(text, x0, base, size=10.0, font="ABCDEF+HelveticaNeueLTW1G-Lt"):
    out, x = [], x0
    for t in text:
        out.append(ch(t, x, base, size, font, width=0.55 * size if t != " " else 0.28 * size))
        x += 0.55 * size if t != " " else 0.28 * size
    return out


def rect(x0, x1, y, h=0.5):
    return {"x0": x0, "x1": x1, "top": y, "bottom": y + h, "width": x1 - x0, "height": h, "object_type": "rect"}


class Page:
    def __init__(self, chars, rects=(), lines=(), curves=()):
        self.chars, self.rects, self.lines, self.curves, self.height = list(chars), list(rects), list(lines), list(curves), H

    def extract_words(self):
        words, cur = [], []
        for c in sorted(self.chars, key=lambda c: (round(c["top"]), c["x0"])):
            if c["text"] == " ":
                if cur:
                    words.append(cur)
                cur = []
            else:
                cur.append(c)
        if cur:
            words.append(cur)
        return [{"text": "".join(c["text"] for c in w), "x0": w[0]["x0"], "top": w[0]["top"]} for w in words]


def text_of(page):
    return E.page_text(page)


class GlyphTests(unittest.TestCase):
    def test_mathtype_glyphs_are_mapped_and_control_characters_dropped(self):
        chars = [ch("2", 100, 400), ch("#", 106, 400, font="X+MMBinary"), ch("2", 112, 400),
                 ch("r", 121, 400), ch("~", 126.5, 400, font="X+MMGreekItalic"), ch("\x07", 132, 400)]
        self.assertEqual(text_of(Page(chars)).strip(), "2×2 rω")


class ScriptTests(unittest.TestCase):
    def test_superscripts_and_stacked_scripts(self):
        chars = word("use ", 60, 400) + [
            ch("x", 82, 400), ch("2", 87.6, 395, size=7.5),          # x²
            ch("x", 100, 400), ch("0", 105.6, 402.5, size=7.5), ch("2", 105.6, 395, size=7.5),  # x₀²
        ]
        self.assertEqual(text_of(Page(chars)).strip(), "use x² x₀²")

    def test_prescripts_on_a_nuclide(self):
        chars = word("form ", 60, 400) + [
            ch("2", 86, 395, size=7.5), ch("3", 89.8, 395, size=7.5), ch("8", 93.6, 395, size=7.5),
            ch("9", 89.8, 403, size=7.5), ch("2", 93.6, 403, size=7.5), ch("U", 97.6, 400),
        ]
        self.assertEqual(text_of(Page(chars)).strip(), "form ²³⁸₉₂U")


class FractionTests(unittest.TestCase):
    def test_stacked_fraction_is_written_inline(self):
        # d²y over dx², bar at y = 404, text on the line at baseline 407.
        chars = word("obtain ", 60, 407) + [
            ch("d", 100, 400), ch("2", 105.5, 395, size=7.5), ch("y", 109.4, 400),
            ch("d", 100, 416), ch("x", 105.5, 416), ch("2", 110.4, 411, size=7.5),
        ] + word(" here", 118, 407)
        page = Page(chars, rects=[rect(99.5, 115, 404)])
        self.assertEqual(text_of(page).strip(), "obtain d²y/dx² here")

    def test_a_half_is_a_vulgar_fraction(self):
        chars = word("A = ", 60, 407) + [ch("1", 84, 400), ch("2", 84, 416), ch("r", 92, 407)]
        page = Page(chars, rects=[rect(83.5, 90, 404)])
        self.assertEqual(text_of(page).strip(), "A = ½r")

    def test_an_underline_is_not_a_fraction(self):
        chars = word("first line", 60, 400) + word("second line", 60, 416)
        page = Page(chars, rects=[rect(70, 80, 404)])
        self.assertEqual(text_of(page).split("\n")[0].strip(), "first line")


class RootAndBracketTests(unittest.TestCase):
    def test_radical_path(self):
        chars = word("I0 / ", 60, 407) + [ch("2", 92, 407)]
        tick = {"x0": 86, "x1": 98, "top": 396, "bottom": 409, "width": 12, "height": 13, "object_type": "curve",
                "pts": [(86, 409), (89, 396), (98, 396)]}
        self.assertEqual(text_of(Page(chars, curves=[tick])).strip(), "I0 / √2")

    def test_column_vector_in_tall_brackets(self):
        chars = [ch("f", 80, 404, size=11.5, font="X+MMVariableA"), ch("x", 85, 397), ch("y", 85, 411),
                 ch("p", 90, 404, size=11.5, font="X+MMVariableA")] + word(", next", 96, 404)
        self.assertEqual(text_of(Page(chars)).strip(), "(x; y), next")


class LayoutTests(unittest.TestCase):
    def test_notes_column_starts_at_the_header_column(self):
        chars = (word("Candidates should be able to:", 60, 300) + word("Notes and examples", 300, 300)
                 + word("describe a widget", 60, 320) + word("e.g. a round one", 300, 320))
        lines = [l for l in text_of(Page(chars)).split("\n") if l.strip()]
        col = lines[0].index("Notes")
        self.assertEqual(lines[1].index("e.g."), col)


if __name__ == "__main__":
    unittest.main()
