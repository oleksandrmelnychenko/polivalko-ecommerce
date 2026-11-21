"""Turnover of catalog products with little or no stock available to the shop."""
from collections import defaultdict
from decimal import Decimal, ROUND_CEILING
from threading import Lock
from time import monotonic

from .dashboard import dashboard
from .register import identifier
from .source import INVENTORY_UNITS, production


THRESHOLD = 3
PAGE_SIZE = 25
DEFAULT_COVER_DAYS = 14
COVER_OPTIONS = (7, DEFAULT_COVER_DAYS, 30)
CATALOG = """
SELECT p.id::text, p.navkolo_id AS external, p.sku, coalesce(nullif(p.display_name,''),p.name) AS name,
       p.is_visible AND NOT p.is_archived AS visible, s.quantity AS on_hand, s.reserved_quantity AS reserved, u.unit
FROM catalog.products p LEFT JOIN catalog.product_stock s ON s.product_id=p.id
""" + INVENTORY_UNITS


def unit_label(value):
    value = str(value or "").strip().lower().rstrip(".")
    return {"2009": "шт", "301": "кг", "0301": "кг", "138": "л", "0138": "л",
            "метр": "м", "м. п": "м пог", "кв.м": "м²", "тони": "т"}.get(value, value)


def purchase_plan(sales, known, stock_unit, available, days, cover_days):
    net = sum((p["net"] for p in sales), Decimal(0))
    priced = known and net > 0 and all(p["profit"] is not None for p in sales)
    profit = sum(p["profit"] for p in sales) if priced else None
    unit = unit_label(stock_unit)
    plan = dict(unit=unit or None, dailyRate=None, stockDays=None, need=None, buyQuantity=None,
                priorityProfit=None, margin=profit / net if priced else None, purchaseStatus="sales")
    if not known:
        return plan
    if sales:
        units = {unit_label(p["salesUnit"]) for p in sales}
        if "catalog-base" in units:
            units.remove("catalog-base")
            units.add(unit or "од")
        if units != {unit or "од"}:
            return dict(plan, purchaseStatus="units")
        unit = units.pop()
        if not unit:
            return dict(plan, purchaseStatus="units")
    quantity = sum((p["netQuantity"] for p in sales), Decimal(0))
    demand = max(0, quantity)
    plan.update(unit=unit or None, dailyRate=demand / Decimal(days))
    if demand > 0:
        plan["stockDays"] = max(0, available) * days / demand
    # Compare in unit-days before division to keep exact integer boundaries when rounding up.
    gap = max(Decimal(0), demand * cover_days - available * days)
    step = Decimal(1) if unit == "шт" else Decimal(".001")
    need = (gap / (days * step)).to_integral_value(rounding=ROUND_CEILING) * step
    plan["need"] = need
    if not demand:
        return dict(plan, purchaseStatus="reserves" if available < 0 else "no-demand")
    if not need:
        return dict(plan, purchaseStatus="covered")
    if net <= 0 or (priced and profit <= 0):
        return dict(plan, purchaseStatus="price")
    if not priced:
        return dict(plan, purchaseStatus="cost")
    # At the observed turnover share and margin, value only the demand the stock cannot cover.
    uncovered = min(gap, demand * cover_days)
    return dict(plan, purchaseStatus="buy", buyQuantity=need, priorityProfit=profit * uncovered / (days * demand))


def exposure(report, catalog, cover_days=DEFAULT_COVER_DAYS):
    catalog = list(catalog)
    by_id = {p["id"] for p in catalog}
    by_external = defaultdict(set)
    for p in catalog:
        external = identifier(p["external"])
        if external:
            by_external[external].add(p["id"])

    matched = defaultdict(list)
    ambiguous = set()
    for product in report["products"]:
        ref, code = identifier(product.get("productRef")), identifier(product.get("code"))
        if product["account"] == "polivalko-native":
            if ref in by_id:
                matched[ref].append(product)
        elif product["account"] == "valko-dntrade":
            code_ids = by_external.get("dntrade-code:" + code, set()) if code else set()
            candidates = code_ids | by_external.get(ref, set())
            if len(candidates) == 1:
                matched[next(iter(candidates))].append(product)
            elif candidates:
                ambiguous.update(candidates)

    period_net = report["current"]["net"]
    complete = report["incompleteProducts"] == 0
    rows = []
    for p in catalog:
        if not p["visible"] or p["on_hand"] is None or p["reserved"] is None:
            continue
        available = p["on_hand"] - p["reserved"]
        if available > THRESHOLD:
            continue
        external = identifier(p["external"])
        imported = external.startswith("dntrade-code:") and len(external) > len("dntrade-code:")
        identified = p["id"] in matched or (imported and len(by_external[external]) == 1)
        known = complete and identified and p["id"] not in ambiguous
        sales = matched.get(p["id"], [])
        net = sum((item["net"] for item in sales), Decimal(0)) if known else None
        plan = purchase_plan(sales, known, p["unit"], available, report["days"], cover_days)
        rows.append(dict(id=p["id"], name=p["name"], sku=p["sku"], onHand=p["on_hand"], reserved=p["reserved"],
                         available=available, net=net, share=net/period_net if net is not None and period_net>0 else None, **plan))
    rows.sort(key=lambda r: (r["net"] is None, -(r["net"] or 0), r["available"], r["name"], r["id"]))
    known = [r["net"] for r in rows if r["net"] is not None]
    subtotal = sum(known, Decimal(0)) if known or not rows else None
    out = sum(r["available"] <= 0 for r in rows)
    return dict(start=report["start"], through=report["through"], periodNet=period_net, threshold=THRESHOLD,
                coverDays=cover_days, buyCount=sum(r["purchaseStatus"] == "buy" for r in rows),
                total=len(rows), outCount=out, lowCount=len(rows)-out, unknownCount=len(rows)-len(known),
                net=subtotal, share=subtotal/period_net if subtotal is not None and period_net>0 else None, rows=rows)


_lock = Lock()
_cache = {}


def stock_page(through, days, page, stock, search, cover_days=DEFAULT_COVER_DAYS, sort="turnover"):
    report = dashboard(through, days)
    with _lock:
        cached = _cache.get((days, cover_days))
        if cached is None or cached[0] is not report or cached[1] <= monotonic():
            with production() as conn:
                result = exposure(report, conn.execute(CATALOG), cover_days)
            _cache[days, cover_days] = report, monotonic()+120, result
        else:
            result = cached[2]
    term = search.casefold().strip()
    filtered = [r for r in result["rows"]
                if (stock == "all" or (stock == "buy" and r["purchaseStatus"] == "buy")
                    or (stock == "low" and r["available"] > 0) or (stock == "out" and r["available"] <= 0))
                and (term in r["name"].casefold() or term in r["sku"].casefold())]
    if sort == "purchase":
        priority = {"buy": 0, "reserves": 1, "cost": 2, "price": 3, "units": 4, "sales": 4, "covered": 5, "no-demand": 6}
        # The existing turnover order breaks ties and orders positions requiring review.
        filtered.sort(key=lambda r: (priority[r["purchaseStatus"]], -(r["priorityProfit"] or 0)))
    page = min(page, max(1, (len(filtered) + PAGE_SIZE - 1) // PAGE_SIZE))
    return dict(result, matches=len(filtered), page=page, pageSize=PAGE_SIZE,
                rows=filtered[(page-1)*PAGE_SIZE:page*PAGE_SIZE])
