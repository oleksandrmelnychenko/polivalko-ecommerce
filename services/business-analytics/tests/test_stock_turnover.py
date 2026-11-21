from decimal import Decimal
from unittest import TestCase
from unittest.mock import patch

from analytics.stock_turnover import exposure, stock_page


def item(key, external, on_hand=0, reserved=0, visible=True):
    return dict(id=key, external=external, name="Назва " + key, sku=key, on_hand=on_hand, reserved=reserved, visible=visible)


def sale(account, code, ref, net):
    return dict(account=account, code=code, productRef=ref, net=Decimal(net))


def report(*sales, net=200, missing=0):
    return dict(start="2026-10-23", through="2026-11-21", products=list(sales), current={"net": Decimal(net)},
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
                "analytics.stock_turnover._cache",{30:(sales,float("inf"),result)},clear=True):
            second = stock_page(None,30,2,"low","")
            self.assertEqual((second["total"],second["matches"],len(second["rows"])), (65,32,7))
            found = stock_page(None,30,1,"out","Назва 64")
            self.assertEqual((found["total"],found["matches"],found["rows"][0]["sku"]), (65,1,"64"))
