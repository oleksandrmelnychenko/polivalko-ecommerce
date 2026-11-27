"""The winter season stays readable when the gross-profit report cannot be trusted."""
from datetime import date
from decimal import Decimal
from unittest import TestCase
from unittest.mock import MagicMock, patch

from analytics.invoices import BODY_ACTIVE, BODY_IN_HRYVNIA
from analytics.product_contribution import HEADERS, parse_profit
from analytics.winter import SALES, winter


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

    def test_winter_sql_hardens_invoices_and_enriches_native_costs(self):
        self.assertGreaterEqual(SALES.count(BODY_ACTIVE), 2)
        self.assertGreaterEqual(SALES.count(BODY_IN_HRYVNIA), 2)
        self.assertIn("dntrade-code:", SALES)
        stored = MagicMock()
        stored.fetchone.return_value = None
        native_row = dict(id="nat-1", day=date(2025, 11, 2), account="polivalko-native", total=Decimal(100),
                          category="Грунти та добавки", org="org-1", stamp=None, store="store-1",
                          unit="catalog-base", product_id="prod-1", code=None, quantity="2", amount="100", cost=None)
        def fake_enrich(conn, docs, start):
            docs[0]["lines"][0]["derived_cost"] = Decimal(60)
        with (patch("analytics.winter.production") as production,
              patch("analytics.winter.enrich_costs", side_effect=fake_enrich) as enrich,
              patch("analytics.winter.add_weekly_offers")):
            production.return_value.__enter__.return_value.execute.side_effect = [stored, [native_row]]
            season = winter(2025, date(2025, 11, 3))
        enrich.assert_called_once()
        first = season["weeks"][-1]
        self.assertEqual((first["soil"]["known"], first["soil"]["actual"]), (1, Decimal(40)))
