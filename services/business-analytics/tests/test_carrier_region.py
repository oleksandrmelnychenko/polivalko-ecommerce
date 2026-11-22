"""A carrier match places the sale in its region even when the city has no point on the map."""
from unittest import TestCase

from analytics.markets import summarize
from analytics.nova_poshta import CarrierHistory
from test_carrier_history import sale, shipment


def located(rows, document):
    history = CarrierHistory(rows)
    history.record(document, document["IntDocNumber"])
    history.status = "complete"
    data = summarize(rows, [], carrier=history)
    kyiv = next(r for r in data["documents"]["regions"] if r["code"] == "UA32")
    return kyiv["count"], [p["name"] for p in kyiv["settlements"]], data["documents"]["unknown"]["count"]


class CarrierRegionTests(TestCase):
    def test_region_is_kept_when_the_city_cannot_be_drawn(self):
        document = dict(shipment("05", "20400000000005"), CityRecipientDescription="Буча")
        self.assertEqual(located([sale("05")], document), (1, [], 0))

    def test_a_drawn_city_is_placed_as_before(self):
        self.assertEqual(located([sale("05")], shipment("05", "20400000000005")), (1, ["м. Буча"], 0))

    def test_document_settlement_is_not_replaced_by_an_undrawn_city(self):
        document = dict(shipment("05", "20400000000005"), CityRecipientDescription="Буча")
        self.assertEqual(located([sale("05", region="Київська", city="м. Ірпінь")], document), (1, ["м. Ірпінь"], 0))
