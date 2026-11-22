"""The sales rate behind the purchase queue uses whole days: its period ends yesterday."""
from datetime import date, timedelta
from decimal import Decimal
from unittest import TestCase
from unittest.mock import patch

from analytics import dashboard as sales
from analytics.stock_turnover import exposure, stock_page
from test_supplier_orders import REPORT, SKU, document

TODAY = date(2026, 11, 22)
YESTERDAY = TODAY - timedelta(days=1)


class StockPeriodTests(TestCase):
    def test_the_rate_is_read_for_the_days_that_ended_yesterday(self):
        report = dict(REPORT, start="2026-10-23", through=str(YESTERDAY))
        result = exposure(report, [SKU], 14, today=TODAY)
        with patch("analytics.stock_turnover.dashboard", return_value=report) as asked, patch.dict(
                "analytics.stock_turnover._cache", {(30, 14): (report, float("inf"), result)}, clear=True):
            page = stock_page(TODAY, 30, 1, "all", "")
        asked.assert_called_once_with(YESTERDAY, 30)
        self.assertEqual((page["through"], page["asOf"]), ("2026-11-21", "2026-11-22"))

    def test_deliveries_are_still_scheduled_from_today(self):
        report = dict(REPORT, through=str(YESTERDAY))
        docs = [document("today", 5, eta=str(TODAY)), document("late", 3, eta=str(YESTERDAY))]
        timings = {o["id"]: o["timing"] for o in exposure(report, [SKU], 14, docs, today=TODAY)["rows"][0]["supply"]["orders"]}
        self.assertEqual(timings, dict(today="within", late="overdue"))

    def test_the_sales_dashboard_keeps_both_periods_instead_of_reading_them_in_turn(self):
        self.addCleanup(sales._cache.clear)
        sales._cache.clear()
        with patch("analytics.dashboard.production") as production, patch("analytics.dashboard.enrich_costs"):
            production.return_value.__enter__.return_value.execute.return_value = []
            first = sales.dashboard(TODAY, 7)
            sales.dashboard(YESTERDAY, 7)
            self.assertIs(sales.dashboard(TODAY, 7), first)
            self.assertEqual(production.call_count, 2)
            sales.dashboard(TODAY + timedelta(days=1), 7)
        self.assertEqual(sorted(through for _, through in sales._cache), [TODAY, TODAY + timedelta(days=1)])
