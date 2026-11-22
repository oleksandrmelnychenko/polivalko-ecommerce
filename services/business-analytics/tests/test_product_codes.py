"""A numeric product code on a sales line is not the document's type code."""
from datetime import date, timedelta
from decimal import Decimal
from unittest import TestCase

from analytics.customer_recommendations import rank_clients
from analytics.purchase_season import history


TODAY = date(2026, 11, 22)


def position(day, entity="invoice", kind="out", qty=1, code="8322"):
    return dict(id=f"{entity}-{day}-{code}", client="buyer", name="Садовий центр", day=day, account="valko-dntrade",
                entity_type=entity, kind=kind, status="active", currency="UAH", raw_kind=None, raw_status=None,
                raw_currency=None, ref="", code=code, unit="2009", sale_signs=entity != "customerReturn", qty=Decimal(qty))


class Archive:
    def __init__(self, rows):
        self.rows = rows

    def execute(self, sql, params):
        return [row for row in self.rows if params[0] <= row["day"] < params[1]]


class ProductCodeTests(TestCase):
    def test_season_history_keeps_invoices_and_returns_with_numeric_product_codes(self):
        pivot = TODAY - timedelta(weeks=52)
        rows = [position(pivot - timedelta(days=1), qty=5), position(pivot, "receipt", "cash", 1),
                position(pivot + timedelta(days=1), "customerReturn", "back", 2),
                position(pivot + timedelta(days=2), qty=4, code="7")]
        seen = [(year, offset, quantity) for year, offset, _, quantity in history(Archive(rows), TODAY, 7, 7)]
        self.assertEqual(seen, [(1, -1, 5), (1, 0, 1), (1, 1, -2), (1, 2, 4)])

    def test_customer_history_keeps_invoices_and_returns_with_numeric_product_codes(self):
        product = dict(id="p", navkolo_id="dntrade-code:8322", sku="8322", name="Субстрат", unit="шт",
                       available=Decimal(10), price=Decimal(100), is_archived=False)
        rows = [position(TODAY - timedelta(days=40), qty=4), position(TODAY - timedelta(days=10), qty=4),
                position(TODAY - timedelta(days=5), "customerReturn", "back", 2)]
        client, = rank_clients(rows, [product], TODAY)
        item, = client["items"]
        self.assertEqual((item["purchases"], item["interval"], item["requested"]), (2, 30, 3))
