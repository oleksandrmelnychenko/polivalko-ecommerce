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

    def test_return_of_a_sale_from_an_earlier_year_is_subtracted_where_that_sale_was_delivered(self):
        # The query adds the earlier sale only to tell where it went; it is not a purchase of this year.
        earlier = row(region="Київська", city="м. Буча", link="sale-2025", earlier=True, amount=Decimal(900),
                      last_day=date(2025, 12, 20))
        refund = row(entity_type="customerReturn", kind="back", link="sale-2025", amount=Decimal(900))
        for rows in ([refund, earlier], [earlier, refund]):
            result = summarize(rows, [])
            kyiv = region(result, "documents", "UA32")
            self.assertEqual((kyiv["count"], kyiv["returns"], kyiv["amount"]), (0, 1, -900))
            self.assertEqual(result["documents"]["unknown"]["amount"], 0)
            self.assertEqual(result["documentCounts"], dict(invoices=0, receipts=0, returns=1))
            buyer, = result["partners"]
            self.assertEqual((buyer["count"], buyer["returns"], buyer["amount"], buyer["lastPurchase"]), (0, 1, -900, None))
