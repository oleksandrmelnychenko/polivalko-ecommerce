"""The sales dashboard explains an empty period with the date of the newest document."""
from datetime import date, timedelta
from decimal import Decimal
from unittest import TestCase

from analytics.dashboard import summarize


class LatestDocumentTests(TestCase):
    def test_latest_document_is_reported_when_it_is_older_than_the_period(self):
        end = date(2026, 11, 22)
        sale = dict(entity_type="invoice", account="archive", kind="out", status="active", currency="UAH",
                    total=Decimal(100), lines=[], day=end - timedelta(days=9))
        result = summarize([sale], end, 7)
        self.assertEqual((result["current"]["purchases"], result["previous"]["purchases"], result["latest"]),
                         (0, 1, "2026-11-13"))
        self.assertEqual(summarize([sale, dict(sale, day=end)], end, 7)["latest"], "2026-11-22")
        self.assertIsNone(summarize([], end, 7)["latest"])
