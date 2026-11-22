"""The purchase queue says why it is empty, what waits for a delivery, and counts what the search shows."""
from datetime import date
from decimal import Decimal
from unittest import TestCase
from unittest.mock import patch

from analytics.stock_turnover import exposure, stock_page
from test_supplier_orders import REPORT, SKU, document


def product(key, **changes):
    return dict(SKU, id=key, external="dntrade-code:" + key, sku=key, name="Товар " + key, **changes)


def sale(code):
    return dict(account="valko-dntrade", code=code, productRef=code + "-ext", net=Decimal(300), profit=Decimal(90),
                netQuantity=Decimal(30), salesUnit="2009")


def order(code, ref, qty, **changes):
    return document(ref, qty, lines=[dict(code=code, ref=code + "-ext", qty=qty, store="s", unit="2009")], **changes)


class StockReasonTests(TestCase):
    def test_unreconciled_sales_documents_are_reported_as_the_reason_for_an_empty_queue(self):
        blocked = exposure(dict(REPORT, incompleteProducts=2), [SKU], 14)
        self.assertEqual((blocked["buyCount"], blocked["unknownCount"], blocked["incompleteSales"]), (0, 1, 2))
        self.assertEqual(exposure(REPORT, [SKU], 14)["incompleteSales"], 0)

    def test_products_waiting_for_a_delivery_to_be_confirmed_are_counted_and_can_be_listed(self):
        report = dict(REPORT, products=[sale("1"), sale("2")], current={"net": 600})
        result = exposure(report, [product("1"), product("2")], 14, [order("2", "undated", 20, eta=None)])
        self.assertEqual((result["buyCount"], result["supplyReview"]), (1, 1))
        with patch("analytics.stock_turnover.dashboard", return_value=report), patch.dict(
                "analytics.stock_turnover._cache", {(30, 14): (report, float("inf"), result)}, clear=True):
            waiting = stock_page(None, 30, 1, "supply-review", "")
        self.assertEqual([(r["id"], r["minimumNeed"], r["need"]) for r in waiting["rows"]], [("2", 0, 14)])

    def test_counters_follow_the_search_while_the_turnover_header_keeps_all_products(self):
        report = dict(REPORT, products=[sale("1"), sale("2")], current={"net": 600})
        result = exposure(report, [product("1"), product("2"), product("3", on_hand=5, reserved=3)], 14,
                          [order("2", "undated", 20, eta=None)])
        with patch("analytics.stock_turnover.dashboard", return_value=report), patch.dict(
                "analytics.stock_turnover._cache", {(30, 14): (report, float("inf"), result)}, clear=True):
            everything = stock_page(None, 30, 1, "all", "")
            found = stock_page(None, 30, 1, "all", "Товар 2")
        self.assertEqual(everything["counts"], dict(all=3, buy=1, supplyReview=1, seasonReview=0, ordered=1, out=2, low=1))
        self.assertEqual(found["counts"], dict(all=1, buy=0, supplyReview=1, seasonReview=0, ordered=1, out=1, low=0))
        self.assertEqual((found["total"], found["buyCount"], found["net"]), (3, 1, everything["net"]))
