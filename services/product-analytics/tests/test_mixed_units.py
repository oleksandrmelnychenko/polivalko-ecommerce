"""Products are sold in pieces, metres and kilograms, so the report of all products measures them in money."""
import unittest
from datetime import date, timedelta
from decimal import Decimal

from product_analytics.report import build_report
from test_report import PRODUCT_ID, payload, sale

END = date(2026, 10, 31)
TAPE, MOWER = PRODUCT_ID, "dntrade:mower"


def report(rows, days=30, product=None, history=400):
    start = END - timedelta(days=days - 1)
    return build_report(payload("web", start, END, rows, END - timedelta(days=history), END, product=product))


def month_ago(day):
    return day - timedelta(days=30)


def tape_fell_mowers_rose():
    """Drip tape by the metre: 300 m then 100 m at 5 UAH. Mowers by the piece: 2 then 5 at 9 000 UAH."""
    today, before = END - timedelta(days=3), month_ago(END - timedelta(days=3))
    return [sale(before, TAPE, 300, 1500), sale(before, MOWER, 2, 18000), sale(today, TAPE, 100, 500), sale(today, MOWER, 5, 45000)]


def kinds(result):
    return {item["kind"]: item for item in result["insights"]}


class MixedUnitTests(unittest.TestCase):
    def test_all_products_compare_revenue_and_one_product_compares_its_units(self):
        trend = kinds(report(tape_fell_mowers_rose()))["trend"]
        self.assertEqual(trend["title"], "Виручка зросла")
        self.assertIn("133,3%", trend["detail"])
        tape = kinds(report(tape_fell_mowers_rose(), product=TAPE))["trend"]
        self.assertEqual(tape["title"], "Попит знизився")
        self.assertIn("66,7%", tape["detail"])

    def test_units_are_forecast_only_for_one_product(self):
        rows = [sale(END - timedelta(days=offset), TAPE, 10, 50) for offset in range(120)]
        rows += [sale(END - timedelta(days=offset), MOWER, 1, 9000) for offset in range(0, 120, 7)]
        self.assertIsNone(report(rows)["forecast"])
        self.assertEqual([point["soldUnits"] for point in report(rows, product=TAPE)["forecast"]["points"]], [70] * 4)

    def test_seasonality_of_all_products_follows_revenue(self):
        # Metres of tape sell in summer, a few costly mowers in winter: units peak in July, money in January.
        rows = []
        for year in (2025, 2026):
            rows += [sale(date(year, 7, day), TAPE, 1000, 5000) for day in range(1, 29)]
            rows += [sale(date(year, 1, day), MOWER, 1, 90000) for day in range(1, 29)]
        result = build_report(payload("web", END - timedelta(days=29), END, rows, date(2023, 6, 1), END, product=None))
        index = {item["month"]: item["index"] for item in result["seasonality"]}
        self.assertGreater(index[1], index[7] * 10)

    def test_returns_of_all_products_are_weighed_in_money(self):
        day = END - timedelta(days=2)
        rows = [sale(day, TAPE, 400, 2000), sale(day, MOWER, 2, 18000, returned=1, refunds=9000),
                sale(day, TAPE, 0, 0, returned=2, refunds=10)]
        returns = kinds(report(rows))["returns"]
        self.assertIn("9\u00a0010 грн", returns["detail"])
        self.assertIn("20\u00a0000 грн", returns["detail"])
        self.assertNotIn("од.", returns["detail"])


if __name__ == "__main__":
    unittest.main()
