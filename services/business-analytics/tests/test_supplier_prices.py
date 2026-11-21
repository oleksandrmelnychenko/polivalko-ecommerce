from datetime import date
from decimal import Decimal
from unittest import TestCase

from analytics.supplier_prices import index_receipts, latest_purchase, supplier_budget


def receipt(doc="one", **changes):
    row = dict(doc=doc, day=date(2026, 10, 15), stamp="2026-10-15T10:00:00Z", number="17",
               account="valko-dntrade", org="org", store="store", ref="external", code="a",
               supplier="Постачальник", partner="partner", qty=Decimal("3"), amount=Decimal("10"), unit="2009")
    return dict(row, **changes)


class SupplierPricesTests(TestCase):
    def test_latest_receipt_and_repeated_lines_use_effective_price(self):
        older = receipt("older", stamp="2026-10-15T08:00:00Z", amount=Decimal("2"))
        latest = receipt(amount=Decimal("10.10"))
        extra = receipt(qty=Decimal("1"), amount=Decimal("3"))
        value = latest_purchase([(older, True), (extra, True), (latest, True)], "шт", Decimal(3))
        self.assertEqual((value["documentId"], value["supplier"], value["unitPrice"], value["amount"]),
                         ("one", "Постачальник", Decimal("3.275"), Decimal("9.83")))

    def test_unpriced_unit_and_indistinguishable_receipts(self):
        first = receipt("first", day=date(2026, 10, 10))
        latest = receipt(amount=None)
        self.assertEqual(latest_purchase([(first, True), (latest, True)], "шт", 1)["issue"], "price")
        wrong_unit = latest_purchase([(receipt(), True)], "кг", Decimal("1.22"))
        self.assertEqual(wrong_unit["issue"], "unit")
        self.assertIsNone(wrong_unit["amount"])
        for other in (receipt("two"), receipt("two", stamp=None)):
            result = latest_purchase([(receipt(), True), (other, True)], "шт", 1)
            self.assertEqual(result["issue"], "ambiguous")
            self.assertIsNone(result["supplier"])

    def test_identity_and_warehouse_scope(self):
        bound = dict(bound=True, native_org="uuid-1", native_store="uuid-2", org="org", store="store")
        catalog = {"a": bound, "b": {"bound": False}}
        ids = {"dntrade-code:a": {"a"}, "conflict": {"b"}}
        rows = [receipt(), receipt("other", store="other"), receipt("conflict", ref="conflict"),
                receipt("native", account="polivalko-native", org="uuid-1", store="uuid-2", ref="a")]
        found = index_receipts(rows, catalog, ids)
        self.assertEqual([(r["doc"], ok) for r, ok in found["a"]], [("one",True),("conflict",False),("native",True)])
        self.assertIsNone(latest_purchase(found["b"], "шт", 2)["unitPrice"])

    def test_budget_counts_unpriced_and_excludes_unrecommended_rows(self):
        base = dict(sku="A", name="Товар", unit="кг", id="a", buyQuantity=Decimal(".27"))
        source = latest_purchase([(receipt(unit="301", amount=Decimal("31.05")), True)], "кг", base["buyQuantity"])
        result = supplier_budget([dict(base, lastPurchase=source), dict(base, id="b", lastPurchase=None),
                                  dict(base, id="c", buyQuantity=None, lastPurchase=None)], date(2026, 11, 21))
        self.assertEqual((result["subtotal"], result["unpriced"]), (Decimal("2.79"), 1))
        self.assertEqual([g["id"] for g in result["suppliers"]], ["valko-dntrade:partner", None])
        self.assertIsNone(result["suppliers"][1]["items"][0]["amount"])

    def test_prior_year_receipt_prices_only_items_without_a_newer_receipt(self):
        previous = (receipt("prior", day=date(2025, 12, 31), amount=Decimal("12")), True)
        current = (receipt("current", day=date(2026, 1, 1), amount=Decimal("9")), True)
        base = dict(name="Товар", unit="шт", buyQuantity=Decimal(2))
        rows = [dict(base, id="a", sku="a", lastPurchase=latest_purchase([previous], "шт", 2)),
                dict(base, id="b", sku="b", lastPurchase=latest_purchase([current, previous], "шт", 2))]
        result = supplier_budget(rows, date(2026, 11, 21))
        self.assertEqual((result["subtotal"], result["historicalCount"], result["historicalAmount"]), (14, 1, 8))
        self.assertEqual([(i["priceDay"], i["receiptId"]) for i in result["suppliers"][0]["items"]],
                         [("2025-12-31", "prior"), ("2026-01-01", "current")])
        invalid = latest_purchase([previous, (dict(current[0], amount=None), True)], "шт", 2)
        self.assertIsNone(invalid["amount"])
