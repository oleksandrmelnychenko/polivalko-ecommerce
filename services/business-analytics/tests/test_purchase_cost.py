from datetime import date, timedelta
from decimal import Decimal
from unittest import TestCase

from analytics.dashboard import summarize
from analytics.purchase_cost import PARENTS, PURCHASES, PurchaseBook, enrich_costs, return_cost


DAY = date(2026, 11, 10)


def position(qty=1, amount=100, **fields):
    return dict(product={"id": "sku-1", "code": "11"}, store="stock", unit="box", quantity=qty, total=amount, **fields)


def document(day=DAY, **fields):
    doc = dict(entity_type="receipt", account="shop", org="owner", day=day, stamp=f"{day}T10:00:00Z",
               kind="cash", currency="UAH", status="active", total=100, lines=[position()])
    return dict(doc, **fields)


def purchase(day, qty, amount, hour=8, **fields):
    row = dict(a="shop", o="owner", s="stock", p="id:sku-1", u="box", day=day, qty=Decimal(qty),
               amount=Decimal(amount) if amount is not None else None, id=f"{day}-{hour}", number="A",
               stamp=f"{day}T{hour:02}:00:00Z")
    return dict(row, **fields)


class PurchaseCostTests(TestCase):
    def test_as_of_uses_last_day_weighted_by_quantity_and_never_a_later_delivery(self):
        previous = DAY - timedelta(days=3)
        book = PurchaseBook([purchase(previous, 1, 10), purchase(DAY, 1, 30, 7), purchase(DAY, 3, 150, 9),
                             purchase(DAY, 1, 250, 10), purchase(DAY + timedelta(days=1), 4, 1000)])
        sale = document()
        cost, refs = book.cost(sale, position(), Decimal(2))
        self.assertEqual((cost,len(refs)), (90,2))
        self.assertEqual(book.cost(dict(sale,stamp=None), position(), Decimal(2))[0],20)
        self.assertEqual(book.cost(document(previous - timedelta(days=1)), position(), Decimal(1)), (None,()))
        self.assertEqual(book.cost(dict(sale,org="other"), position(), 1), (None,()))
        self.assertEqual(book.cost(sale, dict(position(),unit="piece"), 1), (None,()))
        self.assertEqual(book.cost(sale, dict(position(),store="other"), 1), (None,()))

    def test_unreconciled_latest_day_does_not_silently_reuse_old_cost(self):
        book = PurchaseBook([purchase(DAY-timedelta(days=1), 1, 10),purchase(DAY, 1, None)])
        self.assertEqual(book.cost(document(),position(),1),(None,()))

    def test_partial_return_uses_original_cost_and_rejects_ambiguous_units(self):
        parent = document(lines=[position(2,200,cogs_total=70),position(1,100,cogs_total=50)])
        book = PurchaseBook([])
        self.assertEqual(return_cost(parent,position(),1,book),(None,()))
        self.assertEqual(return_cost(parent,position(),3,book),(120,()))
        self.assertEqual(return_cost(parent,position(),4,book),(None,()))

    def test_return_outside_original_sale_period_and_partial_product_coverage(self):
        previous = DAY - timedelta(days=80)
        parent = document(previous,ref="sale")
        new = document()
        refund = document(entity_type="customerReturn", kind="back", parent_kind="cash",parent="SALE")
        unknown = document(org="other")
        class Source:
            def execute(self,sql,params):
                if sql == PARENTS:
                    return [parent]
                if sql == PURCHASES:
                    return [purchase(previous,1,25), purchase(DAY,1,60)]
                raise AssertionError(sql)
        enrich_costs(Source(), [new,refund,unknown],DAY)
        priced = summarize([new,refund],DAY,7)["products"][0]
        self.assertEqual((priced["cost"],priced["profit"],priced["margin"]),(35,-35,None))
        self.assertEqual(len(priced["purchaseSources"]),2)
        incomplete = summarize([new,refund,unknown],DAY,7)["products"][0]
        self.assertEqual((incomplete["profit"],incomplete["costedLines"],incomplete["lines"],
                          incomplete["coveredNet"],incomplete["coveredCost"]),(None,2,3,0,35))

    def test_missing_or_future_original_never_values_a_return_at_today_purchase(self):
        refund = document(entity_type="customerReturn",kind="back",parent="sale")
        class Source:
            def execute(self,sql,params):
                return [document(ref="sale",stamp=f"{DAY}T18:00:00Z")] if sql == PARENTS else [purchase(DAY,1,60)]
        enrich_costs(Source(),[refund],DAY)
        self.assertIsNone(summarize([refund],DAY,7)["products"][0]["profit"])
