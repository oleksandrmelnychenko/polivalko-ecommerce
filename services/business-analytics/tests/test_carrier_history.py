from datetime import date
from decimal import Decimal
from unittest import TestCase
from unittest.mock import patch

from analytics.markets import summarize
from analytics.nova_poshta import CarrierHistory, read_history


def sale(number, **changes):
    row = dict(account="a", entity_type="invoice", status="active", kind="out", currency="UAH",
               count=1, amount=Decimal(100), invalid=0, last_day=date(2025, 1, 3),
               partner=None, name=None, region=None, buyer_region=None, order_number=number)
    return dict(row, **changes)


def shipment(number, ttn):
    return dict(DateTime="03.01.2025", StateId=9, IntDocNumber=ttn, InfoRegClientBarcodes=number,
                RecipientAreaDescription="Київська", CityRecipientDescription="м. Буча")


class CarrierHistoryTests(TestCase):
    def test_register_counts_only_newly_located_purchases(self):
        rows = [sale("01"), sale("02", buyer_region="Київська", buyer_city="Ірпінь"),
                sale(None, waybill="20400000000003"), sale("04")]
        docs = [shipment("01", "20400000000001"), shipment("02", "20400000000002"),
                dict(shipment("", "20400000000003"), CityRecipientDescription="Київ"),
                dict(shipment("04", "20400000000004"), StateId=2)]
        history = CarrierHistory(rows)
        for doc in docs:
            history.record(doc, doc["IntDocNumber"])
        history.status = "complete"
        summary = summarize(rows, [], carrier=history)
        links = summary["shipmentLinks"]["novaPoshta"]
        self.assertEqual((links["ttn"], links["number"], links["addedByRegion"]), (1, 2, {"UA32": 1, "UA30": 1}))

    def test_multiple_invoices_or_shipments_cannot_share_an_order_match(self):
        ttn = "20400000000001"
        rows = [sale("01"), sale(None, waybill=ttn), sale("02"), sale("02"), sale("03")]
        history = CarrierHistory(rows)
        for i, number in enumerate(["01", "02", "03", "03"], 1):
            doc = shipment(number, str(int(ttn) + i - 1))
            history.record(doc, doc["IntDocNumber"])
        history.status = "complete"
        self.assertTrue(all(history.match(row).status == "ambiguous" for row in rows))

    @patch.dict("os.environ", {"Delivery__NovaPoshta__ApiKey": "directory", "NOVAPOSHTA_API_KEY": "directory"}, clear=True)
    @patch("analytics.nova_poshta._page")
    def test_directory_credentials_do_not_enable_sender_history(self, page):
        rows = [sale("01", buyer_region="Київська")]
        history = read_history(2025, date(2026, 1, 1), rows)
        page.assert_not_called()
        data = summarize(rows, [], carrier=history)
        self.assertFalse(data["shipmentLinks"]["senderRegisterConfigured"])
        self.assertEqual(data["shipmentLinks"]["novaPoshta"], {"status": "not_configured", "months": 0})
        self.assertEqual(sum(r["count"] for r in data["combined"]["regions"]), 1)

    @patch.dict("os.environ", {"NOVAPOSHTA_SENDER_API_KEY": "test"})
    @patch("analytics.nova_poshta.sleep")
    @patch("analytics.nova_poshta._page")
    def test_read_every_page_and_reject_partial_register(self, page, _sleep):
        row = sale("01")
        first = shipment("01", "20400000000001")
        second = shipment("02", "20400000000002")
        pages = [dict(success=True, data=[d], info={"totalCount": 2}) for d in (first, second)]
        empty = dict(success=True, data=[], info={"totalCount": 0})
        throttle = dict(success=False, data=[], errorCodes=["20000401501"])
        page.side_effect = [pages[0], throttle, pages[1], *[empty for _ in range(11)]]
        full = read_history(2025, date(2026, 1, 1), [row])
        self.assertEqual((full.status, full.months, full.documents, full.match(row).status), ("complete", 12, 2, "number"))
        self.assertEqual([args.args[3] for args in page.call_args_list[:4]], [1, 2, 2, 1])
        page.side_effect = [throttle] * 4
        limited = read_history(2025, date(2026, 1, 1), [row])
        self.assertEqual((limited.status, limited.months), ("rate_limited", 0))
        for invalid in (pages[0], empty, {"success": False, "errorCodes": ["10001"]}):
            page.side_effect = [pages[0], invalid]
            partial = read_history(2025, date(2026, 1, 1), [row])
            self.assertEqual((partial.status, partial.match(row).status), ("unavailable", "unmatched"))
