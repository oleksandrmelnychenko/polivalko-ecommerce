import unittest
from datetime import date
from time import monotonic
from unittest.mock import patch

from analytics import order_waybills as lookup
from analytics.server import dispatch


def label(number, ttn, day="23.11.2026", **fields):
    return dict(InfoRegClientBarcodes=number, IntDocNumber=ttn, DateTime=day, **fields)


def page(*rows):
    return dict(success=True, data=list(rows), info={"totalCount": len(rows)})


class OrderWaybillTests(unittest.TestCase):
    def setUp(self):
        lookup._months.clear()
        self.addCleanup(lookup._months.clear)

    @patch("analytics.nova_poshta._page")
    def test_exact_order_and_sender_only_including_newly_created_split_shipments(self, api):
        api.return_value = page(
            label("PV-12", "20400000000001", StateId=1),
            label("PV-12", "20400000000002"),
            label("PV-123", "20400000000003"),
            label("PV-12", "20400000000004", StateId=2),
            label("PV-12", "20400000000005", DeletionMark=True),
            label("PV-12", "20400000000006", day="01.11.2026"),
        )
        today = date(2026, 11, 23)
        bills = lookup.find_waybills("PV-12", today, today, "sender-a")["waybills"]
        self.assertEqual(bills, [{"number": n, "date": "2026-11-23"} for n in ("20400000000001", "20400000000002")])
        other = lookup.find_waybills("PV-123", today, today, "sender-a")
        self.assertEqual(other["waybills"][0]["number"], "20400000000003")
        api.assert_called_once()
        api.return_value = page()
        self.assertEqual(lookup.find_waybills("PV-12", today, today, "sender-b")["waybills"], [])

    @patch("analytics.nova_poshta._page")
    def test_partial_register_cannot_be_reported_as_a_match_or_empty(self, api):
        placed, today = date(2025, 12, 29), date(2026, 1, 4)
        december = label("PV-1", "20400000000001", day="30.12.2025")
        api.side_effect = [page(december), {"success": False}, page()]
        self.assertEqual(lookup.find_waybills("PV-1", placed, today, "sender"), {"status": "unavailable", "waybills": None})
        self.assertEqual(lookup.find_waybills("PV-1", placed, today, "sender")["waybills"],
                         [{"number": "20400000000001", "date": "2025-12-30"}])
        self.assertEqual(api.call_count, 3)

    @patch("analytics.order_waybills.monotonic")
    @patch("analytics.nova_poshta._page")
    def test_manual_refresh_reads_a_new_label_after_an_empty_lookup(self, api, clock):
        t = monotonic()
        clock.return_value = t
        api.side_effect = [page(), page(label("PV-12", "20400000000001"))]
        today = date(2026, 11, 23)
        self.assertEqual(lookup.find_waybills("PV-12", today, today, "sender")["waybills"], [])
        clock.return_value = t + 6
        found = lookup.find_waybills("PV-12", today, today, "sender", refresh=True)
        self.assertEqual(found["waybills"], [{"number": "20400000000001", "date": "2026-11-23"}])

    @patch("analytics.nova_poshta.sleep")
    @patch("analytics.nova_poshta._page")
    def test_transient_disconnect_retries_the_same_page(self, api, sleep):
        api.side_effect = [ConnectionResetError(), page(label("PV-12", "20400000000001"))]
        today = date(2026, 11, 23)
        result = lookup.find_waybills("PV-12", today, today, "sender")
        self.assertEqual(result["waybills"][0]["number"], "20400000000001")
        self.assertEqual([call.args[3] for call in api.call_args_list], [1, 1])
        sleep.assert_called_once()

    @patch("analytics.order_waybills.sender_api_key", return_value="")
    @patch("analytics.order_waybills.production")
    def test_route_checks_shop_order_and_delivery_before_reading_the_carrier(self, db, key):
        def request(number):
            return dispatch({"REQUEST_METHOD": "GET", "PATH_INFO": "/order-waybills/" + number})

        self.assertEqual(request("invalid")[0], 404)
        db.assert_not_called()
        row = db.return_value.__enter__.return_value.execute.return_value.fetchone
        row.return_value = None
        self.assertEqual(request("PV-42")[0], 404)
        row.return_value = {"delivery_method": "Pickup"}
        self.assertEqual(request("PV-42"), (200, {"status": "not_applicable", "waybills": None}))
        key.assert_not_called()
        row.return_value = {"delivery_method": "NovaPoshta", "placed": date(2026, 11, 20)}
        self.assertEqual(request("PV-42"), (200, {"status": "not_configured", "waybills": None}))
