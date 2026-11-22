from decimal import Decimal
from unittest import TestCase
from unittest.mock import patch

from analytics.stock_turnover import exposure, purchase_plan, stock_page


def item(key, external, on_hand=0, reserved=0, visible=True):
    return dict(id=key, external=external, name="Назва " + key, sku=key, on_hand=on_hand, reserved=reserved, visible=visible, unit="шт")


def sale(account, code, ref, net, quantity=1, profit=None, unit="2009"):
    return dict(account=account, code=code, productRef=ref, net=Decimal(net), netQuantity=Decimal(quantity),
                profit=Decimal(profit) if profit is not None else None, salesUnit=unit)


def report(*sales, net=200, missing=0):
    return dict(start="2026-10-23", through="2026-11-21", days=30, products=list(sales), current={"net": Decimal(net)},
                incompleteProducts=missing)


class StockTurnoverTests(TestCase):
    def test_reservations_returns_and_identity_determine_scope_and_revenue(self):
        sales = report(sale("valko-dntrade","A","external",120),sale("polivalko-native",None,"a",-20),
                       sale("valko-dntrade","B","old-b",-8), sale("unrelated","A","x",10),sale("valko-dntrade","H","old-h",98))
        catalog = [item("a","dntrade-code:a",8,6),item("b","dntrade-code:b"),item("c","dntrade-code:c"),
                   item("new","manual:new"),item("h","dntrade-code:h",6),item("hidden","dntrade-code:d",visible=False)]
        result = exposure(sales,catalog)
        self.assertEqual((result["net"],result["share"],result["total"],result["outCount"],result["lowCount"]),
                         (92,Decimal(".46"),4,3,1))
        self.assertEqual([(r["id"],r["net"]) for r in result["rows"]],[("a",100),("c",0),("b",-8),("new",None)])
        self.assertEqual(result["rows"][0]["share"], Decimal(".5"))

    def test_ambiguous_mapping_and_unallocated_sales_do_not_produce_zeroes(self):
        ambiguous = exposure(report(sale("valko-dntrade","one","up-id",10)),
                             [item("first","dntrade-code:one"),item("second","up-id")])
        self.assertEqual(ambiguous["unknownCount"],2)
        self.assertIsNone(ambiguous["net"])
        incomplete = exposure(report(missing=1),[item("a","dntrade-code:a")])
        self.assertIsNone(incomplete["rows"][0]["net"])
        zero = exposure(report(net=0),[item("a","dntrade-code:a")])
        self.assertEqual(zero["rows"][0]["net"],0)
        self.assertIsNone(zero["share"])

    def test_search_and_paging_preserve_whole_group_totals(self):
        sales = report()
        result = exposure(sales,[item(str(i),"dntrade-code:"+str(i),int(i%2)) for i in range(65)])
        with patch("analytics.stock_turnover.dashboard",return_value=sales), patch.dict(
                "analytics.stock_turnover._cache",{(30,14):(sales,float("inf"),result)},clear=True):
            second = stock_page(None,30,2,"low","")
            self.assertEqual((second["total"],second["matches"],len(second["rows"])), (65,32,7))
            found = stock_page(None,30,1,"out","Назва 64")
            self.assertEqual((found["total"],found["matches"],found["rows"][0]["sku"]), (65,1,"64"))

    def test_buy_queue_prioritizes_profit_from_uncovered_demand_before_pagination(self):
        sales = report(sale("valko-dntrade","a","one",1800,30,180), sale("valko-dntrade","b","two",1200,30,600),
                       sale("polivalko-native",None,"b",-200,-5,-100,"catalog-base"),
                       sale("valko-dntrade","c","three",2200,50,None), net=5000)
        catalog = [item("a","dntrade-code:a"),item("b","dntrade-code:b",5,3),item("c","dntrade-code:c")]
        result = exposure(sales,catalog,14)
        with patch("analytics.stock_turnover.dashboard",return_value=sales), patch.dict(
                "analytics.stock_turnover._cache",{(30,14):(sales,float("inf"),result)},clear=True):
            page = stock_page(None,30,1,"buy","",14,"purchase")
            self.assertEqual((page["buyCount"],page["matches"],[r["id"] for r in page["rows"]]),(2,2,["b","a"]))
            b = page["rows"][0]
            self.assertEqual((b["share"],b["margin"],b["dailyRate"],b["stockDays"],b["buyQuantity"]),
                             (Decimal(".20"),Decimal(".50"),Decimal(25)/30,Decimal("2.4"),10))
            self.assertEqual(b["priorityProfit"], Decimal(580)/3)
            all_rows = stock_page(None,30,1,"all","",14,"turnover")["rows"]
            self.assertEqual((all_rows[0]["id"],all_rows[0]["purchaseStatus"],all_rows[0]["buyQuantity"]),("c","cost",None))

    def test_purchase_queue_shows_more_than_25_and_keeps_profit_order_across_pages(self):
        sales = report(*(sale("valko-dntrade", str(i), str(i), 200, 30, i) for i in range(1, 111)))
        catalog = [item(str(i), "dntrade-code:" + str(i)) for i in range(111)]
        result = exposure(sales, catalog)
        with patch("analytics.stock_turnover.dashboard", return_value=sales), patch.dict(
                "analytics.stock_turnover._cache", {(30, 14): (sales, float("inf"), result)}, clear=True):
            first = stock_page(None, 30, 1, "buy", "", sort="purchase")
            last = stock_page(None, 30, 2, "buy", "", sort="purchase")
            full_catalog = stock_page(None, 30, 1, "all", "", sort="purchase")
        self.assertEqual((first["matches"], len(first["rows"]), len(last["rows"])), (110, 100, 10))
        self.assertEqual([r["id"] for r in first["rows"] + last["rows"]], [str(i) for i in range(110, 0, -1)])
        self.assertEqual((full_catalog["matches"], len(full_catalog["rows"])), (111, 25))

    def test_horizon_rounding_negative_reserves_and_unreliable_inputs(self):
        product = sale("valko-dntrade","a","one",100,7,20)
        def plan(days=7, cover=7, stock=0, unit="шт"):
            return purchase_plan([product],True,unit,Decimal(stock),days,cover)
        self.assertEqual(plan(days=90,stock=1)["purchaseStatus"],"covered")
        self.assertEqual(plan(stock=-2)["buyQuantity"],9)
        self.assertEqual(plan(cover=30)["buyQuantity"],30)
        product.update(netQuantity=Decimal("1.033"),salesUnit="301")
        self.assertEqual(plan(days=30,cover=14,stock=".18",unit="кг")["buyQuantity"],Decimal(".303"))
        self.assertEqual(plan()["purchaseStatus"],"units")
        product.update(profit=None)
        self.assertEqual(plan(unit="кг")["purchaseStatus"],"cost")
        product.update(profit=-10)
        self.assertEqual(plan(unit="кг")["purchaseStatus"],"price")
        product.update(netQuantity=-2)
        self.assertEqual(plan(unit="кг")["purchaseStatus"],"no-demand")
        self.assertEqual(plan(stock=-1,unit="кг")["purchaseStatus"],"reserves")
        self.assertEqual(purchase_plan([],False,None,0,30,14)["purchaseStatus"],"sales")
