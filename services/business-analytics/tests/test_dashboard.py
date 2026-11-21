from datetime import date, timedelta
from decimal import Decimal
from unittest import TestCase

from analytics.dashboard import summarize
from analytics.invoices import compare


class SalesPeriodTests(TestCase):
    def test_product_ranking_includes_products_beyond_first_page_in_revenue_order(self):
        end = date(2026, 1, 3)
        lines = [dict(product=dict(code=str(i), title=f"Товар {i}"), quantity=1, total=i) for i in range(1, 24)]
        receipt = dict(entity_type="receipt", account="archive", day=end, total=sum(range(1, 24)), lines=lines)
        ranking = summarize([receipt], end, 7)["products"]
        self.assertEqual([p["net"] for p in ranking], list(range(23, 0, -1)))

    def test_dashboard_counts_sale_documents_once_and_subtracts_returns(self):
        end = date(2026, 1, 3)
        item = {"product": {"code": "1", "title": "Товар"}, "quantity": 1, "total": "20.45"}
        base = dict(entity_type="invoice", account="archive", kind="out", day=end, status="active",
                    currency="UAH", total=Decimal("20.45"), lines=[item])
        documents = [base, dict(base, entity_type="receipt", kind="cash"),
                     dict(base, entity_type="customerReturn", kind="back"),
                     dict(base, day=end-timedelta(days=7)), dict(base, status="deleted"),
                     dict(base, currency="USD"), dict(base, kind="cash")]
        result = summarize(documents, end, 7)
        self.assertEqual(result["current"], dict(invoices=1, receipts=1, refunds=1, gross=Decimal("40.90"),
                         returned=Decimal("20.45"), net=Decimal("20.45"), purchases=2))
        self.assertEqual((result["excluded"], result["previous"]["purchases"]), (1, 1))
        self.assertEqual(result["current"]["net"], sum(day["net"] for day in result["byDay"]))
        self.assertEqual((result["start"], result["byDay"][0]["purchases"]), ("2025-12-28", 0))
        self.assertEqual(result["products"][0]["net"], result["current"]["net"])
        mismatch = summarize([dict(base, total=21)], end, 7)
        self.assertEqual((mismatch["current"]["net"], mismatch["products"], mismatch["incompleteProducts"]), (21, [], 1))

    def test_current_year_excludes_future_headers_and_lines_after_kyiv_cutoff(self):
        end = date(2026, 11, 21)
        doc = dict(id="today", ref="today", account="a", kind="out", status="active", currency="UAH",
                   day=end, total=12, products=[dict(product={"code": "A"}, quantity=1, total=12)])
        future = dict(doc, id="future", ref="future", day=end+timedelta(days=1))
        result = compare(2026, [doc, future], [doc, future], end)["total"]
        self.assertEqual((result["documents"], result["lineDocuments"], result["net"], result["lineNet"]), (1, 1, 12, 12))
