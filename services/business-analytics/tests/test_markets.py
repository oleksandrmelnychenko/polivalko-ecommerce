from datetime import date
from decimal import Decimal
from unittest import TestCase

from analytics.markets import REGIONS, region_code, summarize


class MarketsTests(TestCase):
    def test_locations_are_explicit_and_kyiv_city_is_separate(self):
        self.assertEqual(len(REGIONS), 27)
        self.assertEqual(region_code("Київська обл."), "32")
        self.assertEqual(region_code("Київська область", "Київ"), "30")
        self.assertEqual(region_code("UA-43"), "43")
        self.assertIsNone(region_code("Головний Буча"))

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
