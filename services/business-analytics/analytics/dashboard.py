"""Daily sales KPIs from posted accounting documents in the production register."""
from datetime import timedelta
from decimal import Decimal
from itertools import chain
from threading import Lock
from time import monotonic

from .invoices import INDEPENDENT_RECEIPTS, currency_valid
from .product_contribution import turnover_ranking
from .purchase_cost import LINES, ORG, enrich_costs
from .register import kind_of, number, sale_line
from .source import production


FIELDS = f"""
SELECT d.day, d.entity_type, d.source_account AS account, d.kind, d.status, d.currency, d.total,
       {ORG} AS org, d.details->>'date' AS stamp, d.parent_ref AS parent,d.parent_kind,
       d.details->>'type' AS raw_kind, d.details->>'status' AS raw_status, d.details->>'currency_iso' AS raw_currency,
       CASE WHEN d.day >= %s THEN {LINES} END AS lines
FROM accounting.documents d
"""
HEADERS = FIELDS + "WHERE d.entity_type IN ('invoice','customerReturn') AND d.day >= %s AND d.day < %s"
RECEIPTS = FIELDS + INDEPENDENT_RECEIPTS


def totals():
    return dict(invoices=0, receipts=0, refunds=0, gross=Decimal(0), returned=Decimal(0))


def summarize(rows, through, days):
    start = through - timedelta(days=days - 1)
    current, previous = totals(), totals()
    by_day = {str(start + timedelta(days=i)): dict(net=Decimal(0), purchases=0) for i in range(days)}
    products = {}
    excluded = incomplete_products = 0
    latest = None
    for row in rows:
        kind = "receipt" if row["entity_type"] == "receipt" else kind_of(row)
        if kind not in ("sale", "receipt", "return", "invalid") or (kind == "receipt" and row["entity_type"] != "receipt"):
            continue
        amount = number(row["total"])
        day = row["day"]
        if kind == "invalid" or amount is None or (kind != "receipt" and not currency_valid(row)):
            excluded += int(day >= start)
            continue
        amount = abs(amount)
        refund = kind == "return"
        period = current if day >= start else previous
        period[{"sale": "invoices", "receipt": "receipts", "return": "refunds"}[kind]] += 1
        period["returned" if refund else "gross"] += amount
        if day < start:
            continue
        latest = max(latest or day, day)
        daily = by_day[str(day)]
        daily["net"] += -amount if refund else amount
        daily["purchases"] += int(not refund)
        parsed = [sale_line(line, refund) for line in (row["lines"] or [])]
        if not parsed or not all(parsed) or sum(line[-1] for line in parsed) != amount:
            incomplete_products += 1
            continue
        for line, (product, code, pid, sku, quantity, value) in zip(row["lines"], parsed):
            identity = pid or code or sku
            key = row["account"], "id" if pid else "code" if code else "sku", identity
            if key not in products:
                products[key] = dict(name=str(product.get("title") or identity), sku=str(product.get("sku") or ""),
                                     code=code, productRef=pid, account=row["account"], net=Decimal(0), profit=Decimal(0),
                                     netQuantity=Decimal(0), salesUnit=line.get("unit"),
                                     lines=0, costedLines=0, coveredNet=Decimal(0), coveredCost=Decimal(0), purchaseSources={})
            item = products[key]
            if item["code"] != code:
                item["code"] = None
            sign = -1 if refund else 1
            if item["salesUnit"] != line.get("unit"):
                item["salesUnit"] = None
            item["netQuantity"] += sign * quantity
            item["net"] += sign * value
            item["lines"] += 1
            cost = number(line.get("cogs_total"))
            if cost is None:
                cost = line.get("derived_cost")
                for ref, label, source_day in line.get("purchase_sources", ()):
                    item["purchaseSources"][ref] = dict(id=ref, number=label, day=source_day)
            if cost is None or (cost < 0 and not refund):
                item["profit"] = None
            else:
                item["costedLines"] += 1
                item["coveredNet"] += sign * value
                item["coveredCost"] += sign * abs(cost)
                if item["profit"] is not None:
                    item["profit"] += sign * (value - abs(cost))
    for period in (current, previous):
        period["purchases"] = period["receipts"] + period["invoices"]
        period["net"] = period["gross"] - period["returned"]
    ranking = turnover_ranking(products.values(), current["net"])
    for item in ranking:
        item["cost"] = item["net"] - item["profit"] if item["profit"] is not None else None
        item["purchaseSources"] = sorted(item["purchaseSources"].values(),key=lambda s: (s["day"],s["id"]))
    return dict(days=days, start=str(start), through=str(through), latest=str(latest) if latest else None,
                current=current, previous=previous, byDay=[dict(day=d, **v) for d, v in by_day.items()],
                products=ranking, excluded=excluded, incompleteProducts=incomplete_products)


_lock = Lock()
_cache = {}


def dashboard(through, days):
    if days not in (7, 30, 90):
        raise ValueError("Виберіть 7, 30 або 90 днів")
    start = through - timedelta(days=days - 1)
    bounds = start, start - timedelta(days=days), through + timedelta(days=1)
    with _lock:
        saved = _cache.get(days)
        if saved and saved[0] == through and saved[1] > monotonic():
            return saved[2]
        with production() as conn:
            rows = list(chain(conn.execute(HEADERS, bounds), conn.execute(RECEIPTS, bounds)))
            enrich_costs(conn, rows, start)
            result = summarize(rows, through, days)
        _cache[days] = through, monotonic() + 120, result
        return result
