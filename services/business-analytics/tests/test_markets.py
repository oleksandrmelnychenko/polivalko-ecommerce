from datetime import date
from decimal import Decimal
from unittest import TestCase

from analytics.markets import REGIONS, region_code, summarize
from analytics.settlements import resolve
from analytics.shipments import ShipmentIndex


class MarketsTests(TestCase):
    def test_shipment_keys_are_scoped_and_conflicting_destinations_are_excluded(self):
        first = dict(account="a", id="one", number="0012", ttn="20400000000001", started="1",
                     city="Ірпінь", region="Київська")
        second = dict(first, id="two", ttn="20400000000002", city="Одеса", region="Одеська")
        index = ShipmentIndex([first, second, dict(first, account="b", number="12")])
        self.assertEqual(index.match(dict(account="a",order_number="0012")).status,"ambiguous")
        exact = index.match(dict(account="a",order_number="0012",waybill="2040 0000 0000 01"))
        self.assertEqual((exact.status, exact.city), ("ttn","Ірпінь"))
        self.assertEqual(index.match(dict(account="a",order_ref="two",waybill=first["ttn"])).status,"ambiguous")
        self.assertEqual(index.match(dict(account="a",order_number="12")).status,"unmatched")
        self.assertEqual(index.match(dict(account="b",order_number="12",waybill=second["ttn"])).status,"ambiguous")
        self.assertEqual(index.match(dict(account="a",order_ref="one")).status,"ref")
        self.assertEqual(ShipmentIndex([dict(first,started="0")]).match(dict(account="a",order_ref="one")).status,"unmatched")

    def test_shipment_enrichment_counts_each_purchase_once_with_buyer_fallback(self):
        base = dict(account="a", entity_type="invoice", status="active", currency="UAH", kind="out",
                    partner="p",name="A",region=None,buyer_region="Київська",buyer_city="м. Буча",
                    count=1,amount=Decimal(100),invalid=0,last_day=date(2025,1,2))
        web = dict(id="web-id",number="PV-102005",region="Київська",city="Ірпінь")
        order = dict(account="a",id="erp-id",external="web-id",number="003",ttn=None,region=None,city=None)
        index = ShipmentIndex([order],[web])
        result = summarize([dict(base,order_number="PV-102005",order_ref="erp-id"),
                            dict(base,order_number="003",kind="back",amount=Decimal(30)),base],[],index)
        links = result["shipmentLinks"]
        self.assertEqual((links["number"],links["mapped"],links["mappedByRegion"]), (1,1,{"UA32":1}))
        combined = next(r for r in result["combined"]["regions"] if r["code"]=="UA32")
        self.assertEqual((combined["count"],combined["returns"],combined["amount"]),(2,1,170))
        self.assertEqual({p["name"]:p["amount"] for p in combined["settlements"]},{"м. Ірпінь":70,"м. Буча":100})

    def test_locations_are_explicit_and_kyiv_city_is_separate(self):
        self.assertEqual(len(REGIONS), 27)
        self.assertEqual(region_code("Київська обл."), "32")
        self.assertEqual(region_code("Київська область", "Київ"), "30")
        self.assertEqual(region_code("UA-43"), "43")
        self.assertIsNone(region_code("Головний Буча"))

    def test_namesakes_are_disambiguated_by_region_type_or_code(self):
        self.assertEqual(resolve("32", "Буча", False), ("32", None))
        city = resolve("32", "м. Буча", False)[1]
        village = resolve("32", "с. Буча", False)[1]
        self.assertNotEqual(city.code, village.code)
        self.assertNotEqual((city.x, city.y), (village.x, village.y))
        self.assertEqual(resolve("32", city.code, False)[1], city)
        self.assertEqual(resolve(None, "Ірпінь", True)[0], "32")
        self.assertEqual(resolve(None, "Ірпінь", False), (None, None))
        self.assertEqual(resolve("46", "Ірпінь", False), ("46", None))
        self.assertEqual(resolve("48", "с. Київ", False)[1].region, "48")
        self.assertEqual(resolve(None, "Київ", True), (None, None))
        self.assertEqual(resolve("32", "Україна", False), ("32", None))

    def test_settlements_reconcile_and_returns_do_not_increase_sales(self):
        base = dict(account="archive", entity_type="invoice", status="active", currency="UAH", kind="out",
                    partner="p", name="Покупець", region="Київська", city="м. Буча", buyer_region="Львівська",
                    buyer_city="Львів", count=1, amount=Decimal(100), invalid=0, last_day=date(2025, 2, 5))
        result = summarize([base, dict(base, kind="back", amount=Decimal(10)), dict(base, city="Буча")],
                           [dict(region="Київська", city="Ірпінь", count=2, amount=Decimal(80))])
        def region(source, code):
            return next(r for r in result[source]["regions"] if r["code"] == code)
        kyiv = region("documents", "UA32")
        self.assertEqual((kyiv["count"], kyiv["amount"]), (2,190))
        self.assertEqual(len(kyiv["settlements"]), 1)
        point = kyiv["settlements"][0]
        self.assertEqual((point["name"],point["count"],point["returns"],point["amount"]), ("м. Буча",1,1,90))
        self.assertEqual(region("registered","UA46")["settlements"][0]["amount"],190)
        self.assertEqual(region("online","UA32")["settlements"][0]["name"], "м. Ірпінь")

    def test_counterparty_and_geographic_totals_reconcile_with_unknowns(self):
        base = dict(account="archive", entity_type="invoice", status="active", currency="UAH", kind="out",
                    partner="p", name="А", region="Одеська", buyer_region="Львівська", count=1,
                    amount=Decimal(200), invalid=0, last_day=date(2025, 3, 7))
        result = summarize([base,dict(base, kind="back", amount=Decimal(25)),dict(base, status="draft"),
                            dict(base, partner=None, region=None, buyer_region=None, amount=Decimal(70))],
                           [dict(region="Київська", city="Київ", count=2, amount=Decimal(10))])
        buyer = result["partners"][0]
        self.assertEqual((buyer["count"],buyer["returns"],buyer["amount"]), (1,1,175))
        self.assertEqual(result["unlinked"]["amount"], 70)
        for source, code in (("documents","UA51"), ("registered","UA46"), ("online","UA30")):
            covered = next(r for r in result[source]["regions"] if r["code"] == code)
            self.assertEqual(covered["amount"], 10 if source=="online" else 175)
        self.assertEqual(result["documents"]["unknown"]["count"], 1)
