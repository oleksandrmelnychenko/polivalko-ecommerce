"""A product whose unit the stock report does not carry is still planned, in the unit its sales name."""
from decimal import Decimal
from unittest import TestCase

from analytics.stock_turnover import purchase_plan
from test_stock_turnover import sale


def plan(sales, stock_unit=None):
    return purchase_plan(sales, True, stock_unit, Decimal(0), 30, 14)


class StockUnitTests(TestCase):
    def test_a_product_without_a_unit_in_the_stock_report_is_planned_in_the_unit_of_its_sales(self):
        result = plan([sale("valko-dntrade", "a", "one", 300, 30, 90)])
        self.assertEqual((result["purchaseStatus"], result["buyQuantity"], result["unit"], result["unitSource"]),
                         ("buy", 14, "шт", "sales"))
        mixed = plan([sale("valko-dntrade", "a", "one", 150, 15, 45),
                      sale("polivalko-native", None, "a", 150, 15, 45, "catalog-base")])
        self.assertEqual((mixed["purchaseStatus"], mixed["buyQuantity"], mixed["unit"]), ("buy", 14, "шт"))

    def test_sales_in_two_units_or_against_another_stock_unit_still_need_checking(self):
        pieces, kilos = sale("valko-dntrade", "a", "one", 300, 30, 90), sale("valko-dntrade", "a", "one", 300, 30, 90, "301")
        self.assertEqual(plan([pieces, kilos])["purchaseStatus"], "units")
        self.assertEqual(plan([kilos], "шт")["purchaseStatus"], "units")
        self.assertIsNone(plan([pieces], "шт")["unitSource"])

    def test_a_unit_that_nothing_names_is_ordered_in_whole_units(self):
        result = plan([sale("polivalko-native", None, "a", 300, 10, 90, "catalog-base")])
        self.assertEqual((result["purchaseStatus"], result["buyQuantity"], result["unit"]), ("buy", 5, "од"))
