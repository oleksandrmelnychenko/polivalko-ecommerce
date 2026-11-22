from datetime import date, timedelta
from decimal import Decimal
from unittest import TestCase
from unittest.mock import patch

from analytics.customer_recommendations import RETAIL_PLACEHOLDER, customer_recommendations, rank_clients


TODAY = date(2026, 11, 22)


def product(code="A", **changes):
    return dict(dict(id=code, navkolo_id="dntrade-code:"+code.lower(), sku=code, name=code, unit="шт",
                     available=Decimal(3), price=Decimal("12.35"), is_archived=False), **changes)


def line(client, code, days, qty, refund=False, **changes):
    return dict(dict(client=client, name=client, id=(client, code, days, refund), day=TODAY-timedelta(days=days),
                     code=code, ref="", account="valko-dntrade", entity_type="customerReturn" if refund else "invoice",
                     kind="back" if refund else "out", status="active", currency="UAH", unit="2009",
                     sale_signs=not refund, qty=Decimal(qty)), **changes)


class CustomerRecommendationTests(TestCase):
    def test_shared_retail_cards_with_qualifiers_are_not_personal_customers(self):
        for label in ("Основеий роздрібний покупець", "Роздрібний покупець (Буча)", "Роздрібні покупці", "Розничный покупатель"):
            self.assertRegex(label.lower(), RETAIL_PLACEHOLDER)
        self.assertNotRegex('тов роздрібна торгівля', RETAIL_PLACEHOLDER)

    def test_deduplicates_product_within_invoice_caps_quantity_and_subtracts_returns(self):
        rows = [line("One","A",35,2), line("One","A",35,3), line("One","A",15,4), line("One","A",4,1,True),
                line("One","B",1,2), line("One","B",0,2,True), line("Two","B",1,1)]
        clients = {c["id"]: c for c in rank_clients(rows, [product(),product("B")], TODAY)}
        a, = clients["One"]["items"]
        self.assertEqual((a["purchases"], a["interval"], a["signal"], a["quantity"], a["amount"]), (2,20,"due",3,Decimal("37.05")))
        self.assertEqual(clients["Two"]["items"][0]["signal"], "single")
        with patch("analytics.customer_recommendations._cache", (TODAY,float("inf"),list(clients.values()))):
            self.assertEqual(customer_recommendations(TODAY,7)["active"], 2)

    def test_requires_active_named_sales_and_separates_season_from_repeats(self):
        rows = [line("A","A",365-5,1), line("A","A",0,1),
                line("old","A",90,1), line("refund only","A",1,1,True),
                line("invalid","A",0,1,status="draft"), line("units","A",0,1,unit="кг")]
        clients = {c["id"]: c for c in rank_clients(rows,[product()],TODAY)}
        self.assertEqual(set(clients), {"A","units"})
        self.assertEqual(clients["units"]["items"], [])
        item, = clients["A"]["items"]
        self.assertEqual((item["seasons"],item["signal"]),(1,"season"))

    def test_excludes_ambiguous_ids_and_unavailable_or_unpriced_goods(self):
        ledger = [line("A",code,5,1) for code in "ABC"]
        catalog = [product(), product("copy",navkolo_id="dntrade-code:a"),product("B",available=0),product("C",price=None)]
        self.assertEqual(rank_clients(ledger,catalog,TODAY)[0]["items"], [])
