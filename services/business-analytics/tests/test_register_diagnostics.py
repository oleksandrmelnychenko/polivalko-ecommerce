"""The overview's counter of invalid lines describes documents that take part, not copies that are set aside."""
from datetime import date
from decimal import Decimal as D
from unittest import TestCase

from analytics.register import reconcile

DAY = date(2026, 11, 19)
PRODUCT = dict(id="p", navkolo_id="dntrade-code:9", sku="A", name="Насос", category="cat", category_name="Насоси", unit="шт")
GOOD = {"product": {"code": "9"}, "quantity": "2", "total": "100"}
BAD = {"product": {"code": "9"}, "quantity": "0", "total": "5"}


def doc(ref, kind="3", lines=(GOOD,), **changes):
    row = dict(id=ref, ref=ref, account="valko-dntrade", entity="invoice", code=kind, day=DAY, kind=None,
               status="active", currency="UAH", total=D(100), store_ids=["store"], org=None, number=ref,
               products=list(lines))
    return dict(row, **changes)


def diagnostics(rows):
    return reconcile(rows, [], [PRODUCT], [], DAY)["diagnostics"]


class InvalidLineTests(TestCase):
    def test_lines_of_a_duplicate_copy_and_of_a_receipt_linked_to_its_invoice_are_not_counted(self):
        found = diagnostics([doc("i"), doc("dup", external="i", lines=(GOOD, BAD)),
                             doc("receipt", "6", parent="i", lines=(GOOD, BAD))])
        self.assertEqual((found["duplicateDocuments"], found["linkedReceipts"]), (1, 1))
        self.assertEqual(found.get("invalidLines", 0), 0)

    def test_lines_of_a_counted_document_and_of_one_without_any_valid_line_are_counted(self):
        found = diagnostics([doc("i", lines=(GOOD, BAD)), doc("empty", lines=(BAD, BAD))])
        self.assertEqual((found["invalidLines"], found["emptyDocuments"]), (3, 1))
