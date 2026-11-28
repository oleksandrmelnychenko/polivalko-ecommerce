from datetime import date, timedelta
from decimal import Decimal
from unittest import TestCase

from analytics.dashboard import summarize
from analytics.purchase_cost import PARENTS, PURCHASES, PurchaseBook, checked_purchases, enrich_costs, return_cost


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

    def test_a_sale_late_in_the_evening_follows_a_delivery_received_earlier_that_evening(self):
        # DNTrade marks the shop's clock time as UTC; the stamp is read as written.
        book = PurchaseBook([purchase(DAY - timedelta(days=3), 1, 10), purchase(DAY, 1, 30, 22)])
        cost, refs = book.cost(document(stamp=f"{DAY}T23:30:00Z"), position(), Decimal(1))
        self.assertEqual((cost, len(refs)), (30, 1))

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

    def test_cross_source_bridging_matches_native_sales_to_dntrade_purchases_and_normalizes_units(self):
        self.assertIn("accounting.references", PURCHASES)
        self.assertIn("catalog.products", PURCHASES)
        self.assertIn("amount>0", checked_purchases())
        self.assertNotIn("amount>=0", checked_purchases())
        sale = document(account="polivalko-native", entity_type="invoice", kind="out", status="posted",
                        org="native-org", lines=[dict(product={"id": "prod-1"}, store="native-store",
                                                      unit="catalog-base", quantity=2, total=200)])
        prior = DAY - timedelta(days=5)
        bridged = dict(a="polivalko-native", o="native-org", s="native-store", p="id:prod-1", u="catalog-base",
                       src_a="valko-dntrade", src_u="2009", catalog_unit="шт", day=prior,
                       qty=Decimal(4), amount=Decimal(100), id="dn-1", number="P-1", stamp=None)
        wrong_unit = dict(bridged, src_u="301", day=DAY - timedelta(days=2), amount=Decimal(999), id="dn-wrong")
        book = PurchaseBook([bridged, wrong_unit])
        cost, refs = book.cost(sale, sale["lines"][0], Decimal(2))
        self.assertEqual((cost, refs), (Decimal(50), (("dn-1", "P-1", str(prior)),)))
        native_newer = dict(a="polivalko-native", o="native-org", s="native-store", p="id:prod-1", u="catalog-base",
                            src_a="polivalko-native", src_u="catalog-base", catalog_unit="шт", day=DAY - timedelta(days=1),
                            qty=Decimal(2), amount=Decimal(70), id="nat-1", number="ПН-1", stamp=None)
        newer_book = PurchaseBook([bridged, native_newer])
        self.assertEqual(newer_book.cost(sale, sale["lines"][0], Decimal(2))[0], Decimal(70))
        ambiguous = PurchaseBook([dict(bridged, catalog_unit=None), dict(wrong_unit, catalog_unit=None)])
        self.assertEqual(ambiguous.cost(sale, sale["lines"][0], Decimal(2)), (None, ()))

    def test_numeric_parent_kind_matches_original_sale_and_rejects_wrong_kind(self):
        previous = DAY - timedelta(days=10)
        parent_out = document(previous, entity_type="invoice", kind="out", ref="inv-1")
        parent_cash = document(previous, entity_type="receipt", kind="cash", ref="rcpt-1")
        refund_out = document(entity_type="customerReturn", kind="back", parent_kind="3", parent="inv-1")
        refund_cash = document(entity_type="customerReturn", kind="back", parent_kind="6", parent="rcpt-1")
        refund_mismatch = document(entity_type="customerReturn", kind="back", parent_kind="3", parent="rcpt-1")
        class Source:
            def execute(self, sql, params):
                if sql == PARENTS:
                    return [parent_out, parent_cash]
                if sql == PURCHASES:
                    return [purchase(previous, 1, 40)]
                raise AssertionError(sql)
        enrich_costs(Source(), [refund_out, refund_cash, refund_mismatch], DAY)
        self.assertEqual(refund_out["lines"][0].get("derived_cost"), Decimal(40))
        self.assertEqual(refund_cash["lines"][0].get("derived_cost"), Decimal(40))
        self.assertIsNone(refund_mismatch["lines"][0].get("derived_cost"))

    def test_zero_cogs_total_is_treated_as_uncosted_and_zero_amount_purchase_is_rejected(self):
        zero_book = PurchaseBook([purchase(DAY - timedelta(days=1), 1, 0)])
        self.assertEqual(zero_book.cost(document(), position(), Decimal(1)), (None, ()))
        sale_with_zero_cogs = document(lines=[position(cogs_total=0)])
        class Source:
            def execute(self, sql, params):
                if sql == PURCHASES:
                    return [purchase(DAY - timedelta(days=1), 1, 65)]
                raise AssertionError(sql)
        enrich_costs(Source(), [sale_with_zero_cogs], DAY)
        self.assertEqual(sale_with_zero_cogs["lines"][0].get("derived_cost"), Decimal(65))
        self.assertEqual(summarize([sale_with_zero_cogs], DAY, 7)["products"][0]["profit"], Decimal(35))
        uncosted = document(lines=[position(cogs_total=0)])
        self.assertIsNone(summarize([uncosted], DAY, 7)["products"][0]["profit"])

    def test_purchases_query_propagates_cost_across_posted_warehouse_transfers(self):
        self.assertIn("d.entity_type='stockOperation' AND d.kind='transfer' AND d.status='posted'", PURCHASES)
        self.assertIn("d.native_target_store_id", PURCHASES)
        self.assertIn("transfer_priced", PURCHASES)
