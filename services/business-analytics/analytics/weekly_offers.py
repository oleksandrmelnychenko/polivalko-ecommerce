"""Follow issued statistical offers through explicitly linked sales invoices."""
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from .purchase_cost import LINES, ORG, enrich_costs, reconcile_original
from .register import number


OFFERS = """
SELECT o.id::text,o.day,p.title AS partner,o.focus,o.selection_basis AS basis
FROM accounting.sales_offers o JOIN accounting.partners p ON p.id=o.partner_id
WHERE o.day BETWEEN %s AND %s AND (o.selection_basis='statistics' OR o.selection_basis IS NULL)
ORDER BY o.day DESC,p.title,o.id
"""
SHIPMENTS = f"""
SELECT o.id::text AS offer_id,d.id::text,d.number,d.day,d.total,d.source_account AS account,
       d.entity_type,d.kind,d.status,{ORG} AS org,d.details->>'date' AS stamp,{LINES} AS lines
FROM accounting.sales_offers o JOIN accounting.sales_offer_shipments s ON s.offer_id=o.id
JOIN accounting.offer_invoices v ON v.id=s.document_id AND v.partner_id=o.partner_id
JOIN accounting.documents d ON d.id=v.id
WHERE o.selection_basis='statistics' AND o.day BETWEEN %s AND %s AND v.day BETWEEN o.day AND %s
ORDER BY d.day,d.id
"""


def invoice_result(doc):
    profit = None
    estimated = False
    if reconcile_original(doc):
        costs = []
        for line in doc["lines"]:
            cost = number(line.get("cogs_total"))
            if cost is None:
                cost = line.get("derived_cost")
                estimated = True
            if cost is None or cost < 0:
                break
            costs.append(cost)
        else:
            profit = round(doc["total"] - sum(costs), 2)
    return dict(id=doc["id"], number=doc["number"], day=str(doc["day"]), amount=doc["total"],
                profit=profit, estimated=profit is not None and estimated)


def attach_results(weeks, offers, shipments):
    by_offer = defaultdict(list)
    for doc in shipments:
        by_offer[doc["offer_id"]].append(invoice_result(doc))
    by_week = {}
    for week in weeks:
        start = date.fromisoformat(week["start"])
        monday = start - timedelta(days=start.weekday())
        week["statOffers"] = by_week[monday] = dict(issued=0, converted=0, shipments=0, turnover=Decimal(0),
            profit=Decimal(0), costed=0, estimated=0, unknownBasis=0, offers=[])
    for offer in offers:
        monday = offer["day"] - timedelta(days=offer["day"].weekday())
        group = by_week[monday]
        if offer["basis"] is None:
            group["unknownBasis"] += 1
            continue
        invoices = by_offer[offer["id"]]
        group["issued"] += 1
        group["converted"] += int(bool(invoices))
        group["shipments"] += len(invoices)
        for invoice in invoices:
            group["turnover"] += invoice["amount"]
            if invoice["profit"] is not None:
                group["profit"] += invoice["profit"]
                group["costed"] += 1
                group["estimated"] += int(invoice["estimated"])
        group["offers"].append(dict(id=offer["id"], partner=offer["partner"], focus=offer["focus"],
                                    day=str(offer["day"]), invoices=invoices))
    for group in by_week.values():
        if group["shipments"] and not group["costed"]:
            group["profit"] = None


def add_weekly_offers(conn, weeks, start, end, today):
    offers = list(conn.execute(OFFERS, (start, end)))
    shipments = []
    if any(offer["basis"] == "statistics" for offer in offers):
        shipments = list(conn.execute(SHIPMENTS, (start, end, today)))
        enrich_costs(conn, shipments, start)
    attach_results(weeks, offers, shipments)
