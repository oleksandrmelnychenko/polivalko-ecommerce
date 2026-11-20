import unittest
from datetime import date, timedelta
from decimal import Decimal

from product_analytics.report import build_report

PRODUCT_ID = "12345678-aaaa-bbbb-cccc-123456789abc"
INVENTORY = {"healthyProducts": 0, "lowStockProducts": 1, "outOfStockProducts": 0, "lowStockThreshold": 3}


def sale(day, product_id=PRODUCT_ID, units=2, value=20, returned=0, refunds=0):
    return {
        "day": day.isoformat(), "productKey": product_id, "catalogProductId": PRODUCT_ID if product_id == PRODUCT_ID else None,
        "name": "Товар", "sku": "SKU-1", "soldUnits": units, "returnedUnits": returned,
        "grossRevenue": value, "returnValue": refunds,
    }


def payload(source, start, end, rows, first, last, *, product=PRODUCT_ID, ignored=0, search=None, page=1):
    return {
        "source": source, "from": start.isoformat(), "to": end.isoformat(),
        "previousFrom": (start - timedelta(days=(end - start).days + 1)).isoformat(),
        "currentEnd": True, "product": product, "search": search, "page": page,
        "sales": {
            "rows": rows, "firstSourceDay": first.isoformat() if first is not None else None,
            "lastSourceDay": last.isoformat() if last is not None else None, "ignoredDocuments": ignored,
            "unmatchedLines": 0, "returnsAvailable": source == "web",
        },
        "catalog": [{"id": PRODUCT_ID, "name": "Товар", "sku": "SKU-1", "stock": 1}], "inventory": INVENTORY,
    }


class ProductAnalyticsReportTests(unittest.TestCase):
    def test_archive_partial_coverage_does_not_create_zeros_or_stock_advice(self):
        start = date(2026, 10, 2)
        end = start + timedelta(days=29)
        first = start + timedelta(days=4)
        last = first + timedelta(days=2)
        rows = [sale(first + timedelta(days=day)) for day in range(3)]

        report = build_report(payload("dntrade", start, end, rows, first, last))
        self.assertEqual(len(report["trend"]), 3)
        self.assertEqual(report["trend"][0]["from"], first.isoformat())
        self.assertEqual(report["trend"][-1]["to"], last.isoformat())
        self.assertIsNone(report["metrics"]["previousSoldUnits"])
        self.assertIsNone(report["forecast"])
        self.assertIsNone(report["selectedProduct"]["stockDays"])
        self.assertNotIn("replenish", [item["kind"] for item in report["insights"]])

    def test_website_stock_cover_and_net_revenue_use_separate_sale_and_return_amounts(self):
        end = date(2026, 10, 31)
        start = end - timedelta(days=29)
        previous_start = start - timedelta(days=30)
        last = end - timedelta(days=5)
        rows = [sale(previous_start), *(sale(end - timedelta(days=day)) for day in (9, 8, 7)),
                sale(last, units=0, value=0, returned=1, refunds=10)]

        report = build_report(payload("web", start, end, rows, previous_start, last))
        self.assertEqual(report["metrics"]["netRevenue"], 50)
        self.assertEqual(report["metrics"]["previousSoldUnits"], 2)
        self.assertEqual(report["trend"][-1]["to"], end.isoformat())
        product = report["selectedProduct"]
        self.assertEqual(product["stockDays"], Decimal("4.7"))
        self.assertEqual(product["abcClass"], "A")
        self.assertIn(("replenish", PRODUCT_ID), [(item["kind"], item["productKey"]) for item in report["insights"]])

    def test_archive_preserves_fractional_values_and_withholds_models_if_documents_are_unreadable(self):
        end = date(2026, 10, 31)
        start = end - timedelta(days=89)
        first = end - timedelta(days=200)
        rows = [sale(end - timedelta(weeks=week), units=Decimal("1.1"), value=Decimal("2.01"),
                     returned=Decimal("0.1"), refunds=Decimal("0.12")) for week in range(10)]

        report = build_report(payload("dntrade", start, end, rows, first, end, ignored=1))
        self.assertEqual(report["metrics"]["soldUnits"], Decimal("11.0"))
        self.assertEqual(report["metrics"]["netRevenue"], Decimal("18.90"))
        self.assertIsNone(report["metrics"]["previousNetRevenue"])
        self.assertIsNone(report["forecast"])
        self.assertEqual(report["insights"][0]["kind"], "coverage")

    def test_product_ranking_abc_totals_and_inventory_are_independent_of_table_search(self):
        end = date(2026, 10, 31)
        start = end - timedelta(days=29)
        rows = [sale(end, value=80), sale(end, "dntrade:b", value=15), sale(end, "dntrade:c", value=5)]

        report = build_report(payload("web", start, end, rows, start, end, product=None, search="sku-1", page=999))
        self.assertEqual(report["metrics"]["netRevenue"], 100)
        self.assertEqual(report["inventory"], INVENTORY)
        self.assertEqual([row["abcClass"] for row in report["products"]["items"]], ["A", "B", "C"])
        self.assertEqual(report["products"]["page"], 1)
        self.assertEqual(report["products"]["total"], 3)
        self.assertIsNone(report["selectedProduct"])

    def test_catalog_product_without_sales_has_a_drilldown_and_available_stock(self):
        end = date(2026, 10, 31)
        report = build_report(payload("web", end - timedelta(days=29), end, [], None, None))
        self.assertEqual(report["trend"], [])
        self.assertEqual(report["metrics"]["activeProducts"], 0)
        self.assertEqual(report["selectedProduct"]["stock"], 1)
        self.assertIsNone(report["selectedProduct"]["stockDays"])
        self.assertEqual(report["products"]["items"], [report["selectedProduct"]])
