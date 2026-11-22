import unittest
from datetime import date, timedelta

from product_analytics.report import build_report
from test_report import PRODUCT_ID, payload, sale

END = date(2026, 10, 31)


def all_products(days, last_sale):
    start = END - timedelta(days=days - 1)
    return build_report(payload("web", start, END, [sale(last_sale)], END - timedelta(days=400), END, product=None))


class SlowStockTests(unittest.TestCase):
    def test_stock_without_recent_sales_is_reported_whatever_period_is_shown(self):
        for days in (30, 90, 180, 365):
            with self.subTest(days):
                report = all_products(days, END - timedelta(days=100))
                self.assertIn(("slow-stock", PRODUCT_ID), [(item["kind"], item["productKey"]) for item in report["insights"]])

    def test_the_product_table_still_lists_only_products_of_the_shown_and_the_previous_period(self):
        self.assertEqual(all_products(30, END - timedelta(days=100))["products"]["total"], 0)
        self.assertEqual(all_products(90, END - timedelta(days=100))["products"]["total"], 1)

    def test_a_sale_within_eight_weeks_is_recent(self):
        report = all_products(30, END - timedelta(days=55))
        self.assertNotIn("slow-stock", [item["kind"] for item in report["insights"]])


if __name__ == "__main__":
    unittest.main()
