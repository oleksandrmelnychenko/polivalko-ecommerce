import unittest
from datetime import date
from decimal import Decimal

from analytics.weekly_offers import attach_results


class WeeklyOfferTests(unittest.TestCase):
    def test_issue_week_collects_later_invoices_and_keeps_missing_costs_visible(self):
        issue = date(2026, 11, 1)  # partial opening week, on Sunday
        weeks = [{"start": "2026-11-02"}, {"start": str(issue)}]
        offers = [dict(id=key, day=issue, basis=basis, partner=key, focus="general")
                  for key, basis in (("A", "statistics"), ("B", "statistics"), ("C", None))]
        next_week = date(2026, 11, 4)
        def invoice(ref, line):
            return dict(id=ref, offer_id="A", day=next_week, number=ref, total=Decimal(100),
                        lines=[dict(product={"id":"p"}, quantity=1, total=100, **line)])
        attach_results(weeks, offers, [invoice("N1", {"cogs_total":120}), invoice("N2", {"derived_cost":Decimal(70)}),
                                       invoice("N3", {})])
        group = weeks[1]["statOffers"]
        self.assertEqual((group["issued"], group["converted"], group["shipments"], group["unknownBasis"]), (2,1,3,1))
        self.assertEqual((group["turnover"], group["profit"], group["costed"], group["estimated"]), (300,10,2,1))
        self.assertEqual([d["profit"] for d in group["offers"][0]["invoices"]], [-20,30,None])
        self.assertEqual(group["offers"][1]["invoices"], [])
        self.assertEqual(weeks[0]["statOffers"]["turnover"], 0)

    def test_unreconciled_invoice_has_turnover_and_unknown_profit(self):
        day = date(2026,11,2)
        weeks = [{"start": str(day)}]
        attach_results(weeks, [dict(id="A", day=day, basis="statistics", partner="A", focus="irrigation")],
                       [dict(id="doc", number=None, offer_id="A", day=day, total=Decimal(100),
                             lines=[dict(product={"id":"p"}, quantity=1, total=30, cogs_total=0)])])
        group = weeks[0]["statOffers"]
        self.assertEqual((group["turnover"], group["profit"], group["costed"]), (100,None,0))
