"""A buyer whose offer already has an answer no longer waits for the shared stock."""
from datetime import date, timedelta
from decimal import Decimal
from unittest import TestCase

from analytics.customer_recommendations import allocation_report, rank_clients


TODAY = date(2026, 11, 22)
LAST = TODAY - timedelta(days=2)


def purchase(client, days=2):
    return dict(client=client, name=client, id=(client, days), day=TODAY - timedelta(days=days), code="a", ref="",
                account="valko-dntrade", entity_type="invoice", kind="out", status="active", currency="UAH",
                unit="2009", sale_signs=True, qty=Decimal(3))


def offer(client, status):
    return dict(id="offer-" + client, client=client, product="A", quantity=Decimal(3), price=Decimal(10), status=status,
                last=str(LAST), changedAt=str(TODAY))


class RecommendationQueueTests(TestCase):
    def report(self, clients, offers):
        catalog = [dict(id="A", navkolo_id="dntrade-code:a", sku="A", name="A", unit="шт", available=Decimal(3),
                        price=Decimal(10), is_archived=False)]
        ranked = rank_clients([purchase(client) for client in clients], catalog, TODAY)
        report = allocation_report(ranked, TODAY, 7, offers)
        return report, {c["id"]: c["items"][0] for c in report["clients"]}

    def test_answered_offers_leave_the_queue_and_its_need(self):
        report, items = self.report(["reserved", "declined", "released", "open"],
                                    [offer(status, status) for status in ("reserved", "declined", "released")])
        self.assertEqual([(items["open"][key]) for key in ("rank", "buyers", "requested", "quantity")], [1, 1, 3, 3])
        for status in ("reserved", "declined", "released"):
            answered = items[status]
            self.assertEqual((answered["offerStatus"], answered["buyers"], answered["requested"], answered["quantity"]),
                             (status, 0, 0, 0))
        self.assertEqual(report["offeredClients"], 1)

    def test_unanswered_offer_keeps_its_place_and_is_not_counted_as_still_to_offer(self):
        report, items = self.report(["asked", "next", "declined"], [offer("asked", "offered"), offer("declined", "declined")])
        self.assertEqual([(items[c]["rank"], items[c]["buyers"], items[c]["requested"], items[c]["quantity"])
                          for c in ("asked", "next", "declined")], [(1, 2, 3, 3), (2, 2, 3, 0), (0, 0, 0, 0)])
        self.assertEqual(report["offeredClients"], 0)
        self.assertEqual([items[c]["held"] for c in ("asked", "next", "declined")], [0, 3, 0])

    def test_stock_held_for_a_customer_outside_the_period_is_reported_to_the_waiting_buyer(self):
        catalog = [dict(id="A", navkolo_id="dntrade-code:a", sku="A", name="A", unit="шт", available=Decimal(3),
                        price=Decimal(10), is_archived=False)]
        ranked = rank_clients([purchase("earlier", 20), purchase("recent")], catalog, TODAY)
        pending = dict(offer("earlier", "offered"), last=str(TODAY - timedelta(days=20)))
        waiting, = allocation_report(ranked, TODAY, 7, [pending])["clients"]
        self.assertEqual((waiting["id"], waiting["items"][0]["quantity"], waiting["items"][0]["held"]), ("recent", 0, 3))
        free, = allocation_report(ranked, TODAY, 7)["clients"]
        self.assertEqual((free["items"][0]["quantity"], free["items"][0]["held"]), (3, 0))
