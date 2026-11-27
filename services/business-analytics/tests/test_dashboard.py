from datetime import date, timedelta
from decimal import Decimal
from unittest import TestCase

from analytics.dashboard import summarize
from analytics.invoices import compare
from analytics.product_contribution import HEADERS, parse_profit


class SalesPeriodTests(TestCase):
    def test_shares_use_full_net_turnover_and_cost_requires_all_lines(self):
        end = date(2026, 1, 3)
        def doc(kind, code, amount, cost):
            return dict(entity_type="customerReturn" if kind == "back" else "invoice", account="a",
                        kind=kind, status="active", currency="UAH", day=end, total=amount,
                        lines=[dict(product=dict(code=code), quantity=1, total=amount, cogs_total=cost)])
        docs = [doc("out", "a", 100, 80), doc("back", "a", 10, -8), doc("out", "b", 20, None),
                doc("out", "b", 5, 1), doc("back", "c", 15, 12), dict(doc("out", "d", 40, 0), lines=[])]
        rows = {r["code"]:r for r in summarize(docs,end,7)["products"]}
        self.assertEqual((rows["a"]["share"], rows["a"]["profit"], rows["a"]["margin"]), (Decimal(90)/140,18,Decimal(".2")))
        self.assertIsNone(rows["b"]["profit"])
        self.assertEqual((rows["a"]["netQuantity"],rows["b"]["netQuantity"],rows["c"]["netQuantity"]),(0,2,-1))
        self.assertEqual(rows["c"]["share"], Decimal(-15)/140)
        self.assertIsNone(rows["c"]["abc"])
        self.assertIsNone(summarize([docs[4]],end,7)["products"][0]["share"])
        tied = summarize([doc("out",code,total,0) for code,total in (("a",79),("b",9),("c",9),("d",3))],end,7)["products"]
        self.assertEqual([p["abc"] for p in tied], ["A","A","A","C"])

    def test_gross_profit_uses_reported_profit_and_checks_all_control_totals(self):
        rows = [["THEAD",HEADERS], ["TBODY",["12","Товар","шт","2","90,01","110","19,98","22"]],
                ["TFOOT",["Всього:","2","90.01 грн.","110.00 грн.","19.98 грн.","22%"]]]
        report = dict(account="src",period={"from":"2023-01-01","to":"2026-11-20"},rows=rows)
        p = parse_profit(report)["products"][0]
        self.assertEqual((p["share"],p["margin"]), (1,Decimal("19.98")/110))
        rows[-1][1][4] = "20.00 грн."
        with self.assertRaises(ValueError):
            parse_profit(report)
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

    def test_dashboard_merges_dntrade_and_native_rows_for_same_canonical_catalog_product(self):
        end = date(2026, 1, 10)
        catalog = [dict(id="cat-1", external="dntrade-code:42", sku="SKU-42", name="Шланг")]
        dntrade_sale = dict(entity_type="invoice", account="valko-dntrade", kind="out", status="active",
                            currency="UAH", day=end, total=Decimal(200),
                            lines=[dict(product=dict(code="42", id="ext-42", title="Шланг DN"),
                                        quantity=2, total=200, cogs_total=120, unit="2009")])
        native_sale = dict(entity_type="invoice", account="polivalko-native", kind="out", status="posted",
                           currency="UAH", day=end, total=Decimal(300),
                           lines=[dict(product=dict(id="cat-1", title="Шланг"),
                                       quantity=3, total=300, cogs_total=180, unit="catalog-base")])
        native_return = dict(entity_type="customerReturn", account="polivalko-native", kind="customerReturn",
                             status="posted", currency="UAH", day=end, total=Decimal(100),
                             lines=[dict(product=dict(id="cat-1", title="Шланг"),
                                         quantity=1, total=100, cogs_total=60, unit="catalog-base")])
        for order in ([dntrade_sale, native_sale, native_return], [native_sale, dntrade_sale, native_return]):
            result = summarize(order, end, 7, catalog)
            self.assertEqual(len(result["products"]), 1)
            row = result["products"][0]
            self.assertEqual((row["catalogId"], row["code"], row["salesUnit"], row["netQuantity"], row["net"], row["profit"]),
                             ("cat-1", "42", "шт", Decimal(4), Decimal(400), Decimal(160)))
        bad_doc = dict(dntrade_sale, total=Decimal("200.01"))
        with_bad = summarize([bad_doc, native_sale], end, 7, catalog)
        self.assertEqual(with_bad["incompleteProducts"], 1)
        self.assertEqual(with_bad["incompleteProductRefs"],
                         [dict(account="valko-dntrade", catalogId="cat-1", productRef="ext-42", code="42")])
