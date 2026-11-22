"""A till receipt passes the same status and currency checks of its own body as a sales invoice."""
from datetime import date
from decimal import Decimal
from unittest import TestCase
from unittest.mock import patch

from analytics import customer_recommendations, dashboard, invoices, markets, purchase_season, turnover, winter
from analytics.dashboard import summarize
from analytics.register import INACTIVE

STATUS = "lower(btrim(coalesce(d.details->>'status',''))) NOT IN ("
CURRENCY = "lower(btrim(coalesce(d.details->>'currency_iso',''))) IN ('','0','uah','980')"


class ReceiptCheckTests(TestCase):
    def test_dashboard_leaves_out_and_counts_a_receipt_whose_body_names_another_currency(self):
        end = date(2026, 11, 22)
        receipt = dict(entity_type="receipt", account="archive", kind="cash", status="active", currency="UAH",
                       total=Decimal(200), lines=[], day=end)
        result = summarize([receipt, dict(receipt, raw_currency="USD"), dict(receipt, raw_currency="uah")], end, 7)
        self.assertEqual((result["current"]["receipts"], result["current"]["gross"], result["excluded"]), (2, 400, 1))

    def test_every_receipt_query_drops_a_receipt_whose_body_is_deleted_or_a_draft(self):
        queries = dict(
            dashboard=dashboard.RECEIPTS, cash=invoices.CASH_MONTHS, turnover=turnover.RECEIPT_MONTHS,
            markets=markets.DOCUMENTS, winter=winter.SALES,
            recommendations=customer_recommendations._SALES, season=purchase_season._DOCS)
        for name, sql in queries.items():
            with self.subTest(name):
                listed = sql.partition(STATUS)[2].partition(")")[0]
                self.assertEqual({status.strip("'") for status in listed.split(",")}, INACTIVE)

    def test_summed_receipts_are_in_hryvnia_and_only_the_dashboard_reads_the_others_to_count_them(self):
        summed = dict(
            cash=invoices.CASH_MONTHS, turnover=turnover.RECEIPT_MONTHS, markets=markets.DOCUMENTS, winter=winter.SALES,
            recommendations=customer_recommendations._SALES, season=purchase_season._DOCS)
        for name, sql in summed.items():
            with self.subTest(name):
                self.assertIn(CURRENCY, sql)
        self.assertNotIn(CURRENCY, dashboard.RECEIPTS)


class ReportYearsTests(TestCase):
    def test_years_are_read_once_a_day_because_the_reading_checks_every_receipt(self):
        header = dict(year=2025, account="archive", kind="out", status="active", currency="UAH")
        self.addCleanup(setattr, invoices, "_years", None)
        with patch("analytics.invoices.production") as production:
            production.return_value.__enter__.return_value.execute.side_effect = lambda sql, bounds: (
                [header] if "customerReturn" in sql else [dict(year=2026)] if "entity_type='receipt'" in sql else [])
            first = invoices.report_years(date(2026, 11, 22))
            again = invoices.report_years(date(2026, 11, 22))
            invoices.report_years(date(2026, 11, 23))
        self.assertEqual((first, again), (dict(invoices=[2026, 2025], markets=[2026, 2025]),) * 2)
        self.assertEqual(production.call_count, 2)
