"""Periods longer than a year, leap Februaries and unfinished years in the assortment report."""
from datetime import date
from unittest import TestCase

from analytics.reports import report
from test_analytics import DAY, doc, snapshot


class AssortmentPeriodTests(TestCase):
    def test_heatmap_shows_a_typical_month_when_the_period_repeats_calendar_months(self):
        rows = [doc(f"{year}-{month}", day=date(year, month, 5)) for year in (2024, 2025, 2026)
                for month in range(1, 13) if date(year, month, 5) <= DAY]
        heat = report(snapshot(rows), {"from": "2024-01-01"})["heatmap"][0]
        self.assertEqual(heat["months"], [100] * 12)
        self.assertEqual(report(snapshot(rows), {})["heatmap"][0]["months"], [100] * 11 + [None])

    def test_year_ago_period_includes_29_february(self):
        rows = [doc("a", day=date(2024, 2, 10)), doc("b", day=date(2024, 2, 29), amount="900"), doc("c", day=date(2025, 2, 3))]
        result = report(snapshot(rows), {"from": "2025-02-01", "to": "2025-02-28"})
        self.assertEqual((result["summary"]["net"], result["previous"]["net"]), (100, 1000))
        middle = report(snapshot(rows), {"from": "2025-02-01", "to": "2025-02-20"})
        self.assertEqual(middle["previous"]["net"], 100)

    def test_period_asked_past_the_snapshot_ends_with_the_snapshot(self):
        result = report(snapshot([doc()]), {"from": "2026-11-01", "to": "2026-11-21"})
        self.assertEqual((result["end"], result["summary"]["net"]), (str(DAY), 100))
        with self.assertRaises(ValueError):
            report(snapshot([doc()]), {"from": "2026-11-20", "to": "2026-11-21"})

    def test_months_with_data_are_counted_against_the_months_a_year_could_have(self):
        rows = [doc(f"{year}-{month}", day=date(year, month, 5)) for year, months in ((2025, range(4, 13)), (2026, range(1, 12)))
                for month in months]
        coverage = {c["year"]: (c["months"], c["expected"]) for c in report(snapshot(rows), {})["coverage"]}
        self.assertEqual(coverage, {"2025": (9, 9), "2026": (11, 11)})
