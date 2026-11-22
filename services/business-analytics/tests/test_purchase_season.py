from decimal import Decimal
from unittest import TestCase

from analytics.purchase_season import profiles
from analytics.stock_turnover import exposure, purchase_plan
from test_stock_turnover import item, report, sale


class PurchaseSeasonTests(TestCase):
    def test_compares_equal_weeks_across_years_in_units_and_handles_sparse_products(self):
        catalog = {k: dict(item(k, "dntrade-code:" + k), category="garden") for k in ("a", "b", "c")}
        external = {p["external"]: {k} for k, p in catalog.items()}
        facts = []
        for year in (1, 2):
            for offset in range(-6, 8):
                for product, qty in (("a", 2 if offset <= 0 else 4), ("b", 1 if offset == 1 else 0),
                                     ("c", 3 if offset > 0 else 0)):
                    if qty:
                        facts.append((year, offset, dict(account="valko-dntrade", code=product, ref="", unit="2009"), Decimal(qty)))
        def load(catalog, ids):
            return profiles(facts, catalog, ids, 7, 7)
        season = load(catalog, external)
        self.assertEqual(season["product", "a", "шт"]["factor"], Decimal("1.75"))
        self.assertNotIn(("product", "b", "шт"), season)
        sales = report(sale("valko-dntrade","a","one",70,7,35), sale("valko-dntrade","b","two",70,7,35))
        sales["days"] = 7
        result = exposure(sales, catalog.values(), 7, season_profiles=load)
        a, b, c = sorted(result["rows"], key=lambda r: r["id"])
        self.assertEqual((a["buyQuantity"], a["priorityProfit"]), (13, Decimal("61.25")))
        self.assertEqual(b["season"]["source"], "category")
        self.assertEqual((c["purchaseStatus"], c["historicalDemand"], result["seasonalReview"]), ("season-review", 21, 1))
        self.assertNotIn(("product", "a", "шт"), profiles([f for f in facts if f[0] == 1], catalog, external, 7, 7))
        self.assertFalse(profiles([f for f in facts if f[1] >= 0], catalog, external, 7, 7))

    def test_seasonal_adjustment_precedes_arrivals_and_rounding(self):
        sales = [sale("polivalko-native", None, "a", 70, 7, 35, "catalog-base")]
        plan = purchase_plan(sales, True, "шт", 2, 7, 7, [(4, 20)], factor=Decimal("1.5"))
        self.assertEqual((plan["needBeforeIncoming"], plan["buyQuantity"], plan["priorityProfit"]), (9, 4, 20))
        covered = purchase_plan(sales, True, "шт", 4, 7, 7, factor=Decimal(".5"))
        self.assertEqual(covered["purchaseStatus"], "covered")
