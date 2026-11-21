"""Daily sales KPIs from posted accounting documents in the production register."""
from datetime import timedelta
from decimal import Decimal
from itertools import chain
from threading import Lock
from time import monotonic

from .invoices import INDEPENDENT_RECEIPTS, currency_valid
from .register import kind_of, number, sale_line
from .source import production


FIELDS = """
SELECT d.day, d.entity_type, d.source_account AS account, d.kind, d.status, d.currency, d.total,
       d.details->>'type' AS raw_kind, d.details->>'status' AS raw_status, d.details->>'currency_iso' AS raw_currency,
       CASE WHEN d.day >= %s THEN (
           SELECT jsonb_agg(jsonb_build_object('quantity', l->'quantity', 'total', l->'total',
               'product', jsonb_build_object('id', l#>'{product,id}', 'sku', l#>'{product,sku}',
                              'code', l#>'{product,code}', 'title', l#>'{product,title}')))
           FROM jsonb_array_elements(CASE WHEN jsonb_typeof(d.details->'products')='array'
                                    THEN d.details->'products' ELSE '[]'::jsonb END) l)
       END AS lines
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
        for product, code, pid, sku, _, value in parsed:
            identity = pid or code or sku
            key = row["account"], "id" if pid else "code" if code else "sku", identity
            if key not in products:
                products[key] = dict(name=str(product.get("title") or identity), sku=str(product.get("sku") or ""), net=Decimal(0))
            products[key]["net"] += -value if refund else value
    for period in (current, previous):
        period["purchases"] = period["receipts"] + period["invoices"]
        period["net"] = period["gross"] - period["returned"]
    ranking = sorted((p for p in products.values() if p["net"] > 0), key=lambda p: (-p["net"], p["name"], p["sku"]))
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
            rows = chain(conn.execute(HEADERS, bounds), conn.execute(RECEIPTS, bounds))
            result = summarize(rows, through, days)
        _cache[days] = through, monotonic() + 120, result
        return result
