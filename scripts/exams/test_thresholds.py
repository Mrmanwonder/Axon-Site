"""Tests for the grade threshold reader and its checks. Synthetic lines in the
board's layout; no Cambridge documents are committed (the repository is
public). The full documents are checked by the ingest itself."""

import os
import sys
import unittest
from fractions import Fraction

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cambridge_thresholds as ct  # noqa: E402

TABLE = """Grade thresholds – June 2030
Cambridge International AS & A Level Example Science (9999)
Component grade thresholds
Component A B C D E
Component 11 40 29 25 22 19 16
Component 21 60 43 38 33 26 20
Component 31 40 33 31 28 25 23
Component 41 100 59 51 41 31 21
Component 51 30 21 19 16 13 10
Syllabus grade thresholds
Cambridge International A Level (linear assessment)
components
11, 21, 31, 41, 51 260 198 177 156 132 108 84
Cambridge International A Level (staged assessment)
41, 51, 84 260 193 174 155 130 106 82
Cambridge International AS Level
11, 21, 31 130 93 80 65 51 37
""".splitlines()

WEIGHTS = """June 2030 9999 11 40 40 1
June 2030 9999 21 60 60 1
June 2030 9999 31 40 30 0.75
June 2030 9999 41 100 100 1
June 2030 9999 51 30 30 1
June 2030 9999 84 130 130 1
November 2029 9999 11 40 40 1
""".splitlines()


class Reading(unittest.TestCase):
    def test_reads_title_components_and_routes(self):
        t = ct.parse_threshold_lines(TABLE)
        self.assertEqual((t["syllabus_code"], t["series"]), ("9999", "2030-06"))
        self.assertEqual(t["components"]["31"], (40, [33, 31, 28, 25, 23]))
        kinds = [(r["qualification"], r["assessment"], ",".join(r["components"])) for r in t["routes"]]
        self.assertEqual(kinds, [("a_level", "linear", "11,21,31,41,51"), ("a_level", "staged", "41,51,84"), ("as", "as", "11,21,31")])

    def test_reads_weighting_factors_exactly(self):
        w = ct.parse_weighting_lines(WEIGHTS)
        self.assertEqual(w[("2030-06", "9999", "31")], (40, Fraction(30), Fraction(3, 4)))
        self.assertIn(("2029-11", "9999", "11"), w)


class Checks(unittest.TestCase):
    def routes(self, table=TABLE, weights=WEIGHTS):
        return {r["option_code"]: r for r in ct.routes_for_db(ct.parse_threshold_lines(table), ct.parse_weighting_lines(weights))}

    def test_a_route_that_agrees_with_both_documents_is_verified(self):
        r = self.routes()["11,21,31,41,51"]
        self.assertEqual(r["status"], "verified")
        self.assertEqual(r["component_weight"], {"1": "1", "2": "1", "3": "0.75", "4": "1", "5": "1"})
        self.assertEqual(r["grades"][0], ("A*", 198))
        self.assertEqual(r["components"], [1, 2, 3, 4, 5])

    def test_staged_routes_stay_drafts(self):
        self.assertEqual(self.routes()["41,51,84"]["status"], "draft")

    def test_as_routes_use_lowercase_grades(self):
        r = self.routes()["11,21,31"]
        self.assertEqual([g for g, _ in r["grades"]], ["a", "b", "c", "d", "e"])

    def test_a_misread_threshold_is_caught(self):
        bad = [l.replace("11, 21, 31, 41, 51 260 198 177", "11, 21, 31, 41, 51 260 198 170") for l in TABLE]
        r = self.routes(table=bad)["11,21,31,41,51"]
        self.assertFalse(r["checks"]["a_e"])
        self.assertEqual(r["status"], "draft")

    def test_a_wrong_weighting_factor_is_caught(self):
        bad = [l.replace("31 40 30 0.75", "31 40 40 1") for l in WEIGHTS]
        r = self.routes(weights=bad)["11,21,31,41,51"]
        self.assertFalse(r["checks"]["max"])
        self.assertEqual(r["status"], "draft")

    def test_a_series_the_weighting_file_does_not_cover_stays_draft(self):
        r = self.routes(weights=[l for l in WEIGHTS if l.startswith("November")])["11,21,31,41,51"]
        self.assertFalse(r["checks"]["components"])
        self.assertEqual(r["status"], "draft")

    def test_grades_out_of_order_are_caught(self):
        bad = [l.replace("130 93 80 65 51 37", "130 93 80 81 51 37") for l in TABLE]
        self.assertFalse(self.routes(table=bad)["11,21,31"]["checks"]["order"])


class Discovery(unittest.TestCase):
    def test_threshold_links_with_level_words(self):
        html = ('<a href="/Images/761483-german-language-8027-as-level-june-2026-grade-threshold-table.pdf">x</a>'
                '<a href="/Images/761530-mathematics-9709-june-2026-grade-threshold-table.pdf">y</a>')
        self.assertEqual(sorted((c, s) for _, c, s in ct.threshold_pdfs(html)), [("8027", "2026-06"), ("9709", "2026-06")])

    def test_series_pages(self):
        html = ('<a href="/programmes-and-qualifications/x/grade-threshold-tables/june-2026">a</a>'
                '<a href="/programmes-and-qualifications/x/grade-threshold-tables/june-2026/index.aspx">b</a>'
                '<a href="/programmes-and-qualifications/x/grade-threshold-tables/march-2026">c</a>')
        self.assertEqual([u.rsplit("/", 2)[-2] for u in ct.threshold_series_pages(html)], ["june-2026", "march-2026"])

    def test_zone_timetables(self):
        html = ('<a href="/Images/757647-november-2026-zone-3-uk-timetable.pdf">a</a>'
                '<a href="/Images/757649-november-2026-zone-4-timetable.pdf">b</a>'
                '<a href="/Images/760914-march-2027-checkpoint-final-timetable.pdf">c</a>')
        got = sorted((s, z, v) for _, s, _, z, v in ct.timetable_pdfs(html))
        self.assertEqual(got, [("2026-11", 3, "uk"), ("2026-11", 4, "")])


if __name__ == "__main__":
    unittest.main()
