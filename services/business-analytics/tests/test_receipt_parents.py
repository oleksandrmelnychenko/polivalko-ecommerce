"""A receipt issued for a posted invoice is the same sale in every report that sums receipts."""
from unittest import TestCase

from analytics import customer_recommendations, dashboard, invoices, markets, offer_statistics
from analytics import purchase_season, turnover, winter
from analytics.invoices import PARENT_REF


class ReceiptParentTests(TestCase):
    def test_parent_is_read_in_every_form_the_overview_accepts(self):
        for form in ("d.parent_ref", "WHEN 'string'", "WHEN 'number'", "{parent_document,id}"):
            self.assertIn(form, PARENT_REF)

    def test_parent_known_only_to_the_import_envelope_is_read_from_the_archive(self):
        # The source can list a receipt under its invoice without repeating the invoice in the receipt body.
        self.assertIn("SELECT nullif(a.parent_source_id,'') FROM integration.dntrade_archive_records a WHERE a.id=d.id", PARENT_REF)

    def test_every_receipt_query_links_invoices_through_that_parent(self):
        queries = dict(
            dashboard=dashboard.RECEIPTS, cash=invoices.CASH_MONTHS, turnover=turnover.RECEIPT_MONTHS,
            markets=markets.DOCUMENTS, winter=winter.SALES, offers=offer_statistics.SALES,
            recommendations=customer_recommendations._SALES, season=purchase_season._DOCS)
        for name, sql in queries.items():
            with self.subTest(name):
                self.assertIn(f"lower(i.source_id)=lower({PARENT_REF})", sql)
                self.assertNotIn("lower(d.parent_ref)", sql)

    def test_dashboard_reads_a_return_parent_the_same_way(self):
        self.assertIn(f"{PARENT_REF} AS parent", dashboard.HEADERS)
