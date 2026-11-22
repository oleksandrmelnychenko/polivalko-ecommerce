"""The winter season stays readable when the gross-profit report cannot be trusted."""
from datetime import date
from unittest import TestCase
from unittest.mock import MagicMock, patch

from analytics.product_contribution import HEADERS, parse_profit
from analytics.winter import winter


class WinterReportTests(TestCase):
    def test_margin_report_that_fails_its_checks_leaves_the_estimate_empty(self):
        rows = [["THEAD", HEADERS], ["TBODY", ["12", "Товар", "шт", "2", "90,01", "110", "19,98", "22"]],
                ["TFOOT", ["Всього:", "2", "90.01 грн.", "110.00 грн.", "20.00 грн.", "22%"]]]
        report = dict(account="src", period={"from": "2023-01-01", "to": "2026-11-20"}, rows=rows)
        with self.assertRaises(ValueError):
            parse_profit(report)
        stored = MagicMock()
        stored.fetchone.return_value = report
        with patch("analytics.winter.production") as production, patch("analytics.winter.add_weekly_offers"):
            production.return_value.__enter__.return_value.execute.side_effect = [stored, []]
            season = winter(2025, date(2026, 1, 15))
        self.assertEqual((season["through"], season["marginThrough"]), ("2026-01-15", None))
        self.assertTrue(season["weeks"])
