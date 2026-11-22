"""Offer cohorts and revenue from their posted, explicitly linked outgoing invoices."""
import json
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from .purchase_cost import LINES, ORG, PurchaseBook, checked_purchases, reconcile_original
from .register import identifier, number
from .source import production
from .supplier_orders import unit_label


PERIODS = (7, 30, 90)
JOURNAL = f"""
SELECT (o.offered_at AT TIME ZONE 'Europe/Kyiv')::date AS offered_day,o.status AS decision,
       o.product_id::text AS product,o.unit,lower(p.navkolo_id) AS external,
       d.id::text AS invoice_id,d.number,d.day,d.total,d.native_org_id::text AS org,d.native_store_id::text AS store,
       lower(org.source_id) AS external_org,lower(store.source_id) AS external_store,
       CASE WHEN d.day >= %s THEN {LINES} END AS lines
FROM accounting.recommendation_offers o
LEFT JOIN accounting.documents d ON d.id=o.invoice_id AND o.status='fulfilled'
  AND d.native_partner_id=o.partner_id AND d.source_account='polivalko-native'
  AND d.entity_type='invoice' AND d.kind='out' AND d.status='posted' AND d.currency='UAH' AND d.day<=%s
LEFT JOIN catalog.products p ON p.id=o.product_id
LEFT JOIN accounting.references org ON org.id=d.native_org_id AND org.source_account='valko-dntrade' AND org.kind='organization'
LEFT JOIN accounting.references store ON store.id=d.native_store_id AND store.source_account='valko-dntrade' AND store.kind='store'
WHERE (o.offered_at >= (%s::date::timestamp AT TIME ZONE 'Europe/Kyiv')
       AND o.offered_at < (%s::date::timestamp AT TIME ZONE 'Europe/Kyiv')) OR d.day >= %s
ORDER BY d.day DESC NULLS LAST,d.number,d.id
"""

# Normalize both accounting sources to the invoice's actual owner, warehouse and catalog product.
# Retain the last prior buying day for each raw unit before combining equivalent units and sources.
OWNERS = f"""AND ((d.source_account='polivalko-native' AND d.native_org_id IN (SELECT org::uuid FROM needed))
    OR (d.source_account='valko-dntrade' AND {ORG} IN (SELECT external_org FROM needed)
        AND coalesce(d.details->>'load','1')='1'))"""
RECEIPTS = """
WITH needed AS (SELECT * FROM jsonb_to_recordset(%s::jsonb) AS n(
    org text,store text,product text,external text,external_org text,external_store text,first_day date,last_day date)),
""" + checked_purchases(OWNERS) + """, matched AS (
    SELECT n.org,n.store,n.product,c.a,c.u,c.day,c.id,c.number,c.stamp,c.qty,c.amount,
       c.ok AND (c.a='polivalko-native' OR NOT EXISTS (
         SELECT 1 FROM catalog.products other WHERE other.id::text<>n.product
           AND (c.p='id:'||lower(other.navkolo_id) OR lower(other.navkolo_id)='dntrade-code:'||c.external_code)
       )) AS valid,n.first_day
    FROM checked c JOIN needed n ON c.day<=n.last_day AND (
      (c.a='polivalko-native' AND c.o=n.org AND c.s=n.store AND c.p='id:'||n.product)
      OR (c.a='valko-dntrade' AND c.o=n.external_org AND c.s=n.external_store
          AND (c.p='id:'||n.external OR 'dntrade-code:'||c.external_code=n.external)))
), recent AS (
    SELECT *,max(day) FILTER (WHERE day<first_day) OVER (PARTITION BY org,store,product,a,u) AS prior
    FROM matched
)
SELECT org,store,product,a,u,day,id::text AS id,number,stamp,sum(qty) AS qty,
       CASE WHEN bool_and(coalesce(valid,false)) THEN sum(amount) END AS amount
FROM recent WHERE day>=first_day OR day=prior GROUP BY org,store,product,a,u,day,id,number,stamp
"""


def stock(doc):
    return doc["org"], doc["store"], doc["product"]


def receipt_book(conn, sales):
    needs = {}
    for doc in sales:
        if not any(isinstance(line, dict) and line.get("cogs_total") is None for line in doc["lines"] or ()):
            continue
        key = stock(doc)
        if key not in needs:
            needs[key] = {k: doc[k] for k in ("product","org","store","external","external_org","external_store")}
            needs[key].update(first_day=doc["day"], last_day=doc["day"])
        needs[key]["first_day"] = min(needs[key]["first_day"], doc["day"])
        needs[key]["last_day"] = max(needs[key]["last_day"], doc["day"])
    rows = conn.execute(RECEIPTS, (json.dumps(list(needs.values()), default=str),)) if needs else ()
    # Native quantities are already in the catalog base unit. Use the agreed unit for that product.
    indexed = []
    units = {}
    for doc in sales:
        units.setdefault(stock(doc), set()).add(unit_label(doc["unit"]))
    for row in rows:
        native = row["a"] == "polivalko-native"
        labels = units[stock(row)] if native else {unit_label(row["u"])}
        for unit in labels:
            indexed.append(dict(row, a="journal", o=row["org"], s=row["store"], p="id:"+row["product"], u=unit,
                                amount=None if native and len(labels)>1 else row["amount"]))
    return PurchaseBook(indexed)


def invoice_profit(doc, book):
    if not reconcile_original(doc) or len(doc["lines"]) != 1:
        return None, False
    line, = doc["lines"]
    if identifier(line["product"].get("id")) != doc["product"]:
        return None, False
    estimated = line.get("cogs_total") is None
    if estimated:
        priced_line = dict(line, store=doc["store"], unit=unit_label(doc["unit"]))
        cost, _ = book.cost(dict(day=doc["day"], account="journal", org=doc["org"]), priced_line, number(line["quantity"]))
    else:
        cost = number(line["cogs_total"])
    if cost is None or cost < 0:
        return None, False
    return (doc["total"]-cost).quantize(Decimal(".01"), rounding=ROUND_HALF_UP), estimated


def recommendation_results(today):
    start = today-timedelta(days=89)
    with production() as conn:
        rows = conn.execute(JOURNAL, (start,today,start,today+timedelta(days=1),start)).fetchall()
        sales = [r for r in rows if r["invoice_id"] and start <= r["day"] <= today]
        book = receipt_book(conn, sales)
    invoices = []
    for doc in sales:
        profit, estimated = invoice_profit(doc, book)
        invoices.append(dict(id=doc["invoice_id"], number=doc["number"], day=str(doc["day"]), turnover=doc["total"],
                             profit=profit, estimated=estimated))
    periods = []
    for days in PERIODS:
        since = today-timedelta(days=days-1)
        cohort = [r for r in rows if since <= r["offered_day"] <= today]
        sales_period = [i for i in invoices if i["day"] >= str(since)]
        priced = [i for i in sales_period if i["profit"] is not None]
        covered_profit = sum((i["profit"] for i in priced), Decimal(0))
        periods.append(dict(days=days, start=str(since), offered=len(cohort),
                            accepted=sum(r["decision"] in ("reserved","released","fulfilled") for r in cohort),
                            sold=sum(bool(r["invoice_id"]) for r in cohort), invoices=len(sales_period),
                            turnover=sum((i["turnover"] for i in sales_period), Decimal(0)),
                            profit=covered_profit if len(priced)==len(sales_period) else None,
                            coveredProfit=covered_profit, priced=len(priced), estimated=sum(i["estimated"] for i in priced)))
    return dict(through=str(today), periods=periods, invoices=invoices)
