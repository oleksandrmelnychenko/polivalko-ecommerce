from datetime import date, timedelta
from decimal import Decimal
from unittest import TestCase
from unittest.mock import MagicMock, patch

from analytics.customer_recommendations import (
    CATALOG, HISTORY, RETAIL_PLACEHOLDER, allocate_stock, allocation_report, customer_recommendations, rank_clients,
)


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
        self.assertEqual(allocation_report(clients.values(),TODAY,7)["active"], 2)

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

    def test_shared_stock_covers_first_buyer_then_partial_then_waiting(self):
        rows = [line("due","A",18,2), line("due","A",9,2), line("season","A",362,2), line("season","A",3,2),
                line("single","A",0,2), line("single","B",0,1)]
        catalog = [product(available=Decimal("3.9")), product("B")]
        ranked = rank_clients(rows, catalog, TODAY)
        allocated = allocate_stock(ranked)
        self.assertEqual(allocated, allocate_stock(rank_clients(reversed(rows), reversed(catalog), TODAY)))
        assignments = {c["id"]: next(i for i in c["items"] if i["sku"] == "A") for c in allocated}
        self.assertEqual([(i["rank"], i["requested"], i["quantity"], i["amount"], i["buyers"]) for i in
                          (assignments["due"], assignments["season"], assignments["single"])],
                         [(1,2,2,Decimal("24.70"),3), (2,2,1,Decimal("12.35"),3), (3,2,0,0,3)])
        self.assertEqual(next(c for c in allocated if c["id"] == "single")["items"][0]["id"], "B")

    def test_periods_do_not_consume_each_others_stock_or_the_cached_history(self):
        rows = [line("earlier","A",40,4), line("earlier","A",20,4), line("recent","A",1,3)]
        ranked = rank_clients(rows, [product()], TODAY)
        short = allocation_report(ranked,TODAY,7)
        long = allocation_report(ranked,TODAY,30)
        self.assertEqual(allocation_report(ranked,TODAY,7), short)
        self.assertEqual(allocation_report(ranked,TODAY,90)["clients"], long["clients"])
        self.assertEqual((short["offeredClients"], short["clients"][0]["items"][0]["quantity"]), (1,3))
        self.assertEqual((long["active"],long["offeredClients"]), (2,1))
        self.assertEqual([(c["id"], c["items"][0]["quantity"]) for c in long["clients"]], [("earlier",3),("recent",0)])

    def test_fractional_stock_tie_break_and_no_shortage(self):
        rows = [line(c, "A", 2, "0.750", unit="кг") for c in ("z", "a")]
        for available, second in [("1.2349","0.484"), ("2.000","0.750")]:
            ranked = rank_clients(rows,[product(unit="кг", available=Decimal(available))],TODAY)
            items = sorted((c["items"][0]["rank"], c["id"], c["items"][0]["quantity"]) for c in allocate_stock(ranked))
            self.assertEqual(items, [(1,"a",Decimal("0.750")), (2,"z",Decimal(second))])

    def test_stock_and_prices_refresh_while_history_is_cached(self):
        history = MagicMock()
        history.fetchall.return_value = [line("a","A",1,2), line("b","A",2,2)]
        with patch("analytics.customer_recommendations._history_cache", None), patch(
                "analytics.customer_recommendations.production") as production:
            query = production.return_value.__enter__.return_value.execute
            query.side_effect = [history, [product()], [product(available=Decimal(1), price=Decimal(20))]]
            first = customer_recommendations(TODAY,30)
            second = customer_recommendations(TODAY,30)
            self.assertEqual([call.args[0] for call in query.call_args_list], [HISTORY, CATALOG, CATALOG])
            self.assertEqual(query.call_args_list[-1].args[1], ([], ["dntrade-code:a"]))
        self.assertEqual((first["offeredClients"], second["offeredClients"]), (2,1))
        self.assertEqual(second["clients"][0]["items"][0]["amount"], Decimal("20.00"))
