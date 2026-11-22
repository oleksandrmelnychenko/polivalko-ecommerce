"""A return leaves the region and settlement where its sale was counted."""
from datetime import date
from decimal import Decimal
from unittest import TestCase

from analytics.markets import summarize


def row(**changes):
    return dict(dict(account="a", entity_type="invoice", kind="out", status="active", currency="UAH", partner="p", name="A",
                     region=None, city=None, buyer_region="Львівська", buyer_city="м. Львів", link=None,
                     count=1, amount=Decimal(10000), invalid=0, last_day=date(2026, 3, 2)), **changes)


def region(result, source, code):
    return next(r for r in result[source]["regions"] if r["code"] == code)


class ReturnPlaceTests(TestCase):
    def test_return_without_an_address_is_subtracted_where_the_sale_was_added(self):
        sale = row(region="Київська", city="м. Буча", link="sale-1")
        refund = row(entity_type="customerReturn", kind="back", link="sale-1")
        for rows in ([sale, refund], [refund, sale]):
            result = summarize(rows, [])
            for source in ("documents", "combined"):
                kyiv = region(result, source, "UA32")
                self.assertEqual((kyiv["count"], kyiv["returns"], kyiv["amount"]), (1, 1, 0))
                self.assertEqual(kyiv["settlements"][0]["amount"], 0)
                self.assertEqual(result[source]["unknown"]["amount"], 0)
            self.assertEqual(region(result, "combined", "UA46")["returns"], 0)
            self.assertEqual(region(result, "registered", "UA46")["amount"], 0)

    def test_return_keeps_its_own_place_when_the_sale_is_outside_the_year_or_ambiguous(self):
        refund = row(entity_type="customerReturn", kind="back", region="Одеська", link="sale-2")
        alone = summarize([refund], [])
        self.assertEqual(region(alone, "documents", "UA51")["returns"], 1)
        twice = summarize([row(region="Київська", link="sale-2"), row(region="Львівська", link="sale-2"), refund], [])
        self.assertEqual(region(twice, "documents", "UA51")["returns"], 1)
