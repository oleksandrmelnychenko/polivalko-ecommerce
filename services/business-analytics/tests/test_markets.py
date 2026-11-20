from datetime import date
from decimal import Decimal
from unittest import TestCase

from analytics.markets import REGIONS, region_code, summarize
from analytics.settlements import resolve


class MarketsTests(TestCase):
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
