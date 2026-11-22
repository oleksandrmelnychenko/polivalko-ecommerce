from datetime import date, timedelta
from decimal import Decimal
import unittest
from unittest.mock import patch

from analytics.recommendation_results import JOURNAL, RECEIPTS, recommendation_results


TODAY = date(2026, 11, 22)
D = Decimal


def row(age, decision, invoice=None, sale_age=0, cost=None):
    return dict(offered_day=TODAY-timedelta(days=age), decision=decision, invoice_id=invoice, number=invoice,
                day=TODAY-timedelta(days=sale_age) if invoice else None, total=D("15.00"), product="sku", unit="кг",
                org="org",store="store",external="dntrade-code:101",external_org="o",external_store="s",
                lines=[dict(product=dict(id="sku"), quantity="1.5", total="15.00", cogs_total=cost)] if invoice else None)


class RecommendationResultsTests(unittest.TestCase):
    def report(self, rows, purchases=()):
        with patch("analytics.recommendation_results.production") as production:
            query = production.return_value.__enter__.return_value.execute
            query.return_value.fetchall.return_value = rows
            query.side_effect = lambda sql, params: purchases if sql == RECEIPTS else query.return_value
            result = recommendation_results(TODAY)
            self.assertEqual(query.call_args_list[0].args, (JOURNAL, (TODAY-timedelta(days=89),TODAY,
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
