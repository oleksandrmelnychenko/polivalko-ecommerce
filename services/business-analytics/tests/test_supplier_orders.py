from datetime import date
from decimal import Decimal
from unittest import TestCase

from analytics.stock_turnover import exposure, purchase_plan
from analytics.supplier_orders import incoming_by_product, register_entries, schedule


TODAY = date(2026, 11, 21)
CATALOG = {"dntrade-code:42": {"p"}}
SKU = dict(id="p",external="dntrade-code:42",sku="42",name="Товар",unit="шт",visible=True,on_hand=2,reserved=2)
SALE = dict(account="valko-dntrade",code="42",productRef="p-ext",net=Decimal(300),profit=Decimal(90),
            netQuantity=Decimal(30),salesUnit="2009")
REPORT = dict(days=30,start="2026-10-23",through=str(TODAY),products=[SALE],current={"net":300},incompleteProducts=0)


def line(qty, store="s"):
    return dict(code="42",ref="p-ext",qty=qty,store=store,unit="2009")


def document(ref, qty, **changes):
    return dict(dict(kind="order",id=ref,ref=ref,number="123",day=TODAY,stage="Підтверджено",eta=str(TODAY),
                     org="o",org_name="Орг",partner="v",dispatched="0",lines=[line(qty)],parent=None), **changes)


class SupplierOrdersTests(TestCase):
    def test_receipts_net_once_and_arrivals_do_not_cover_an_earlier_stockout(self):
        docs = [document("o1",10,lines=[line(6),line(4)],dispatched="1",eta="2026-11-25"),
                document("r1",2,kind="in",parent="o1"),document("r2",1,kind="in",parent="o1"),
                document("o2",30,eta="2026-12-05"),document("other",80,kind="in",parent="unrelated")]
        row = exposure(REPORT,[SKU],14,docs)["rows"][0]
        self.assertEqual((row["supply"]["confirmed"],row["supply"]["inTransit"],row["supply"]["within"]),(37,7,7))
        batch = row["supply"]["orders"][0]
        self.assertEqual((batch["ordered"],batch["received"],batch["remaining"],batch["timing"]),(10,3,7,"within"))
        self.assertEqual((row["needBeforeIncoming"],row["buyQuantity"],row["priorityProfit"]),(14,7,21))
        earlier = purchase_plan([SALE],True,"шт",0,30,14,[(4,Decimal(20))])
        self.assertEqual((earlier["need"],earlier["priorityProfit"]),(4,12))
        covered = purchase_plan([SALE],True,"шт",-2,30,14,[(0,Decimal(16))])
        self.assertEqual((covered["purchaseStatus"],covered["need"]),("incoming",0))

    def test_unknown_overdue_and_out_of_scope_are_not_credited(self):
        docs = [document("u",2,stage="6",eta=None),document("over",3,eta="2026-11-20"),
                document("later",10,eta="2026-12-05"),document("elsewhere",14,lines=[line(14,"s2")]),
                document("cancel",100,stage="Скасовано"),document("full",12),document("in",12,kind="in",parent="full")]
        row = exposure(REPORT,[dict(SKU,bound=True,org="o",store="s")],14,docs)["rows"][0]
        self.assertEqual((row["supply"]["within"],row["minimumNeed"],row["need"],row["buyQuantity"]),(0,9,14,9))
        self.assertEqual({x["timing"] for x in row["supply"]["orders"]},{"review","overdue","later","other-store"})
        docs = [document("unknown",20,eta=None)]
        row = exposure(REPORT,[SKU],14,docs)["rows"][0]
        self.assertEqual((row["need"],row["minimumNeed"],row["buyQuantity"],row["purchaseStatus"]),(14,0,None,"supply-review"))

    def test_register_requires_unique_order_and_receipt_requires_same_owner_product_and_unit(self):
        def record(section, values):
            return dict(section=section,cells=[dict(value=v) for v in values])
        table = [record("THEAD",["Номер","Дата","Організація","Стан замовл.","Планова дата поставки"]),
                 record("TBODY",["123","21.11.2026 08:30","Орг","В дорозі","23.11.2026"])]
        entries = register_entries([table])
        order = document("a",20,stage="6",eta=None)
        def batches(docs):
            return incoming_by_product(docs,entries,CATALOG)[0]["p"]
        matched = batches([order])[0]
        self.assertEqual((matched["state"],matched["eta"]),("shipped","2026-11-23"))
        self.assertTrue(all(b["eta"] is None and b["state"]=="review" for b in batches([order,dict(order,ref="b")])))
        disputed = batches([order,document("r",8,kind="in",parent="a",org="different")])[0]
        self.assertEqual((disputed["received"],disputed["state"]),(None,"review"))
        supply, dates, possible = schedule([matched],dict(SKU,unit="кг"),TODAY,14)
        self.assertEqual((supply["orders"][0]["timing"],dict(dates),possible),("units",{},{2:None}))
        row = exposure(REPORT,[dict(SKU,unit="шт")],14,[dict(order,eta="2026-11-25")])["rows"][0]
        self.assertEqual((row["minimumNeed"],row["need"]),(4,14))
