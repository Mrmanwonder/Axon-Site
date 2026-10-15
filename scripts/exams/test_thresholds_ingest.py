"""No network: retry, source drift and preservation regression tests."""
import io
import unittest
import urllib.error
from unittest.mock import patch
import thresholds_ingest as ingest
from test_thresholds import TABLE, WEIGHTS


class Response(io.BytesIO):
    pass


class Fetch(unittest.TestCase):
    @patch.object(ingest.time, "sleep")
    @patch.object(ingest.urllib.request, "urlopen")
    def test_timeout_then_recovery(self, open_url, sleep):
        open_url.side_effect = [TimeoutError(), Response(b"good")]
        self.assertEqual(ingest.get("https://example.test"), b"good")
        self.assertEqual(open_url.call_count, 2)
        self.assertGreaterEqual(sleep.call_args.args[0], 1)

    @patch.object(ingest.time, "sleep")
    @patch.object(ingest.urllib.request, "urlopen")
    def test_429_and_503_retry_boundedly(self, open_url, sleep):
        for code in [429, 503]:
            open_url.reset_mock(); sleep.reset_mock()
            open_url.side_effect = urllib.error.HTTPError("u", code, "busy", {"Retry-After": "2"}, None)
            with self.assertRaisesRegex(ingest.FetchError, f"upstream_http_{code}"):
                ingest.get("https://example.test")
            self.assertEqual(open_url.call_count, 3)
            self.assertEqual(sleep.call_count, 2)

    @patch.object(ingest.time, "sleep")
    @patch.object(ingest.urllib.request, "urlopen")
    def test_404_is_not_retried(self, open_url, sleep):
        open_url.side_effect = urllib.error.HTTPError("u", 404, "missing", {}, None)
        with self.assertRaisesRegex(ingest.FetchError, "upstream_http_404"):
            ingest.get("https://example.test")
        self.assertEqual(open_url.call_count, 1); sleep.assert_not_called()

    @patch.object(ingest.time, "sleep")
    @patch.object(ingest.urllib.request, "urlopen")
    def test_retry_after_cannot_exceed_source_budget(self, open_url, sleep):
        open_url.side_effect = urllib.error.HTTPError("u", 429, "busy", {"Retry-After": "1000"}, None)
        with self.assertRaises(ingest.FetchError): ingest.get("https://example.test", budget=5)
        self.assertEqual(open_url.call_count, 1); sleep.assert_not_called()

    @patch.object(ingest, "get", return_value=b"<html>new layout</html>")
    def test_markup_drift_is_distinct(self, _):
        with self.assertRaisesRegex(ingest.FetchError, "source_drift_series"):
            ingest.discovery("https://example.test", ingest.ct.threshold_series_pages, "series")

    def test_draft_replacement_cannot_delete_existing_verified_table(self):
        table = ingest.ct.parse_threshold_lines(TABLE)
        routes = ingest.ct.routes_for_db(table, ingest.ct.parse_weighting_lines(WEIGHTS))
        sql = "\n".join(ingest.table_sql("url", "sha", table, routes, "weights", "sha"))
        self.assertIn("do $threshold$ begin if not exists", sql)
        self.assertIn("status = 'verified'", sql)
        self.assertIn("end if; end $threshold$;", sql)
        self.assertIn("and qualification =", sql)
        self.assertIn("and component =", sql)

if __name__ == "__main__":
    unittest.main()
