from datetime import date, timedelta
from decimal import Decimal
import unittest
from unittest.mock import patch

from analytics.recommendation_results import JOURNAL, RECEIPTS, recommendation_results


TODAY = date(2026, 11, 22)
D = Decimal


def row(age, decision, invoice=None, sale_age=0, cost=None, client="client", product="sku", dated=None):
    """An offer made `age` days ago. Its invoice was posted `sale_age` days ago and is dated `dated` days ago."""
    dated = sale_age if dated is None else dated
    return dict(offered_day=TODAY-timedelta(days=age), decision=decision, invoice_id=invoice, number=invoice,
                day=TODAY-timedelta(days=dated) if invoice else None,
                sold_day=TODAY-timedelta(days=sale_age) if invoice else None, total=D("15.00"), product=product.lower(), unit="кг",
                client=client, client_name="Покупець", product_name="Товар", sku=product,
                org="org",store="store",external="dntrade-code:101",external_org="o",external_store="s",
                lines=[dict(product=dict(id=product.lower()), quantity="1.5", total="15.00", cogs_total=cost)] if invoice else None)


class RecommendationResultsTests(unittest.TestCase):
    def report(self, rows, purchases=()):
        with patch("analytics.recommendation_results.production") as production:
            query = production.return_value.__enter__.return_value.execute
            query.return_value.fetchall.return_value = rows
            query.side_effect = lambda sql, params: purchases if sql == RECEIPTS else query.return_value
            result = recommendation_results(TODAY)
            self.assertEqual(query.call_args_list[0].args, (JOURNAL, (TODAY-timedelta(days=89),
                             TODAY-timedelta(days=89),TODAY+timedelta(days=1),TODAY-timedelta(days=89))))
            return result

    def test_cohort_boundaries_cancellations_and_earlier_offers_in_financial_period(self):
        report = self.report([row(0,"offered"),row(6,"released"),row(7,"reserved"),row(29,"declined"),
                              row(30,"fulfilled","earlier",7,"17.10"),row(89,"reserved"),
                              row(90,"fulfilled","old offer",0,"0"),row(1,"fulfilled","recent",0,None)])
        week, month, quarter = report["periods"]
        self.assertEqual([(p["offered"],p["accepted"],p["sold"]) for p in (week,month,quarter)], [(3,2,1),(5,3,1),(7,5,2)])
        self.assertEqual((week["invoices"],week["turnover"],week["profit"],week["priced"],week["coveredProfit"]),
                         (2,30,None,1,15))
        self.assertEqual((month["invoices"],month["turnover"],month["coveredProfit"]), (3,45,D("12.90")))
        self.assertIsNone(next(i["profit"] for i in report["invoices"] if i["id"]=="recent"))

    def test_no_posted_sales_means_zero_profit(self):
        for p in self.report([row(6,"released"),row(1,"reserved")])["periods"]:
            self.assertEqual((p["accepted"],p["sold"],p["turnover"],p["profit"]),(2,0,0,0))

    def test_rankings_by_identity_reconcile_to_each_period_even_for_older_offers(self):
        report = self.report([
            row(1,"fulfilled","a-x",0,"5","A","X"), row(2,"declined",client="A",product="X"),
            row(15,"fulfilled","a-y",6,"22","A","Y"), row(4,"fulfilled","b-x",0,None,"B","X"),
            row(100,"fulfilled","c-y",2,"0","C","Y"), row(45,"offered",client="B",product="Y"),
            row(8,"declined",client="B",product="X"),
        ])
        week, month, quarter = report["periods"]
        customers = {r["id"]: r for r in week["customers"]}
        products = {r["id"]: r for r in week["products"]}
        self.assertEqual((customers["A"]["conversionRate"],customers["A"]["turnover"],customers["A"]["profit"]),
                         (D(".5"),30,3))
        self.assertEqual((customers["B"]["conversionRate"],customers["B"]["profit"]), (1,None))
        self.assertEqual((customers["C"]["conversionRate"],customers["C"]["turnover"]), (None,15))
        self.assertEqual((products["x"]["sku"],products["x"]["sold"],products["x"]["offered"]), ("X",2,3))
        self.assertEqual((products["x"]["profit"],products["x"]["coveredProfit"]), (None,10))
        self.assertEqual((products["y"]["conversionRate"],products["y"]["profit"]), (None,8))
        self.assertEqual(next(r for r in month["customers"] if r["id"]=="A")["conversionRate"], D(2)/3)
        self.assertEqual(next(r for r in quarter["customers"] if r["id"]=="B")["conversionRate"], D(1)/3)
        for period in report["periods"]:
            for dimension in ("customers","products"):
                for field in ("offered","accepted","sold","invoices","turnover","coveredProfit","priced","estimated"):
                    self.assertEqual(sum(r[field] for r in period[dimension]), period[field])

    def test_empty_journal_has_no_ranked_entities(self):
        for period in self.report([])["periods"]:
            self.assertEqual((period["customers"], period["products"], period["conversionRate"]), ([],[],None))

    def test_prior_purchase_same_warehouse_and_unit_only_and_direct_cost_precedes_estimate(self):
        receipts = [dict(a="valko-dntrade",org="org",store="store",product="sku",u="0301",day=TODAY-timedelta(days=2),
                         id="in",number="1",stamp=None,qty=D("4"),amount=D("14"))]
        receipts += [dict(receipts[0], day=TODAY, amount=D("99")), dict(receipts[0], u="2009", amount=D("400")),
                     dict(receipts[0], store="other", amount=D("800"))]
        report = self.report([row(1,"fulfilled","estimated"),row(2,"fulfilled","direct",cost="16")],receipts)
        self.assertEqual([(i["profit"],i["estimated"]) for i in report["invoices"]], [(D("9.75"),True),(-1,False)])
        self.assertEqual((report["periods"][0]["profit"],report["periods"][0]["estimated"]),(D("8.75"),1))

    def test_unreconciled_or_invalid_cost_keeps_turnover_and_flags_profit_unknown(self):
        malformed = row(1,"fulfilled","wrong total",cost=1)
        malformed["lines"][0]["total"]="14"
        period = self.report([malformed,row(0,"fulfilled","wrong cost",cost="-1")])["periods"][0]
        self.assertEqual((period["invoices"],period["turnover"],period["profit"],period["priced"]), (2,30,None,0))

    def test_a_sale_belongs_to_the_day_its_invoice_was_posted_not_to_the_date_written_on_the_draft(self):
        # The draft is created when the customer agrees and posted at pickup; its date can also be edited.
        report = self.report([row(12,"fulfilled","picked up later",sale_age=0,dated=10,cost="5"),
                              row(3,"fulfilled","dated ahead",sale_age=1,dated=-3,cost="5"),
                              row(40,"fulfilled","dated today, posted long ago",sale_age=20,dated=0,cost="5")])
        week, month, quarter = report["periods"]
        self.assertEqual([(p["invoices"],p["turnover"],p["profit"]) for p in (week,month,quarter)],
                         [(2,30,20),(3,45,30),(3,45,30)])
        self.assertEqual({i["id"]: (i["day"],i["soldDay"]) for i in report["invoices"]}, {
            "picked up later": ("2026-11-12","2026-11-22"), "dated ahead": ("2026-11-25","2026-11-21"),
            "dated today, posted long ago": ("2026-11-22","2026-11-02")})

    def test_a_ranking_row_says_how_many_of_its_invoices_come_from_offers_made_before_the_period(self):
        report = self.report([row(100,"fulfilled","old offer",sale_age=1,cost="5",client="A"), row(1,"offered",client="A"),
                              row(2,"fulfilled","fresh",sale_age=0,cost="5",client="B")])
        week, _, quarter = report["periods"]
        rows = {r["id"]: (r["offered"],r["sold"],r["invoices"],r["earlierInvoices"]) for r in week["customers"]}
        self.assertEqual(rows, {"A": (1,0,1,1), "B": (1,1,1,0)})
        self.assertEqual([(p["invoices"],p["earlierInvoices"]) for p in (week,quarter)], [(2,1),(2,1)])
