"""Tests for the timetable reader's pure parts. No PDFs are committed; the
full documents are checked by the ingest itself (hashes and the two-view
cross-check)."""

import os
import re
import sys
import unittest
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cambridge_timetable as ct  # noqa: E402


def words(*texts, top=100.0):
    return [{"text": t, "top": top, "x0": 30.0 + i * 20} for i, t in enumerate(texts)]


class Entry(unittest.TestCase):
    def test_reads_a_row(self):
        e = ct.parse_entry(words("AS", "Mathematics", "(Pure", "Mathematics", "1)", "9709/12", "1h", "50m", "PM"))
        self.assertEqual(e, {"qualification": "as", "syllabus_code": "9709", "component": "12",
                             "title": "Mathematics (Pure Mathematics 1)", "session": "PM", "duration_minutes": 110})

    def test_minutes_only(self):
        self.assertEqual(ct.parse_entry(words("IG", "Listening", "0510/22", "50m", "AM"))["duration_minutes"], 50)

    def test_refuses_a_row_without_session(self):
        with self.assertRaises(ValueError):
            ct.parse_entry(words("IG", "Physics", "0625/12", "45m"))

    def test_no_code_is_not_a_row(self):
        self.assertIsNone(ct.parse_entry(words("(Listening)")))


class Weeks(unittest.TestCase):
    def week(self, text):
        m = re.search(r"^(\d{2})(?: (\w+))?[–-](\d{2}) (\w+) (\d{4})$", text)
        return ct.week_range(m, int(m.group(5)))

    def test_ranges(self):
        self.assertEqual(self.week("28 September–02 October 2026"), (date(2026, 9, 28), date(2026, 10, 2)))
        self.assertEqual(self.week("05–09 October 2026"), (date(2026, 10, 5), date(2026, 10, 9)))
        self.assertEqual(self.week("28 December–01 January 2027"), (date(2026, 12, 28), date(2027, 1, 1)))

    def test_day_inside_its_week(self):
        errata = []
        d = ct.day_date("Monday", 28, "September", date(2026, 9, 28), date(2026, 10, 2), errata, "p3")
        self.assertEqual((d, errata), (date(2026, 9, 28), []))

    def test_wrong_month_resolved_and_reported(self):
        # Cambridge's Nov 2026 zone 6 timetable prints "Saturday 07 October"
        # inside the 02-07 November week.
        errata = []
        d = ct.day_date("Saturday", 7, "October", date(2026, 11, 2), date(2026, 11, 7), errata, "p8")
        self.assertEqual(d, date(2026, 11, 7))
        self.assertEqual(len(errata), 1)

    def test_unresolvable_day_fails(self):
        with self.assertRaises(ValueError):
            ct.day_date("Sunday", 7, "October", date(2026, 11, 2), date(2026, 11, 7), [], "p8")


if __name__ == "__main__":
    unittest.main()
