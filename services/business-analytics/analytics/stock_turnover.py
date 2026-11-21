"""Turnover of catalog products with little or no stock available to the shop."""
from collections import defaultdict
from decimal import Decimal
from threading import Lock
from time import monotonic

from .dashboard import dashboard
from .register import identifier
from .source import production


THRESHOLD = 3
PAGE_SIZE = 25
CATALOG = """
SELECT p.id::text, p.navkolo_id AS external, p.sku, coalesce(nullif(p.display_name,''),p.name) AS name,
       p.is_visible AND NOT p.is_archived AS visible, s.quantity AS on_hand, s.reserved_quantity AS reserved
FROM catalog.products p LEFT JOIN catalog.product_stock s ON s.product_id=p.id
"""


def exposure(report, catalog):
    catalog = list(catalog)
    by_id = {p["id"] for p in catalog}
    by_external = defaultdict(set)
    for p in catalog:
        external = identifier(p["external"])
        if external:
            by_external[external].add(p["id"])

    matched = defaultdict(Decimal)
    ambiguous = set()
    for product in report["products"]:
        ref, code = identifier(product.get("productRef")), identifier(product.get("code"))
        if product["account"] == "polivalko-native":
            if ref in by_id:
                matched[ref] += product["net"]
        elif product["account"] == "valko-dntrade":
            code_ids = by_external.get("dntrade-code:" + code, set()) if code else set()
            candidates = code_ids | by_external.get(ref, set())
            if len(candidates) == 1:
                matched[next(iter(candidates))] += product["net"]
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
        net = matched[p["id"]] if complete and identified and p["id"] not in ambiguous else None
        rows.append(dict(id=p["id"], name=p["name"], sku=p["sku"], onHand=p["on_hand"], reserved=p["reserved"],
                         available=available, net=net, share=net/period_net if net is not None and period_net>0 else None))
    rows.sort(key=lambda r: (r["net"] is None, -(r["net"] or 0), r["available"], r["name"], r["id"]))
    known = [r["net"] for r in rows if r["net"] is not None]
    subtotal = sum(known, Decimal(0)) if known or not rows else None
    out = sum(r["available"] <= 0 for r in rows)
    return dict(start=report["start"], through=report["through"], periodNet=period_net, threshold=THRESHOLD,
                total=len(rows), outCount=out, lowCount=len(rows)-out, unknownCount=len(rows)-len(known),
                net=subtotal, share=subtotal/period_net if subtotal is not None and period_net>0 else None, rows=rows)


_lock = Lock()
_cache = {}


def stock_page(through, days, page, stock, search):
    report = dashboard(through, days)
    with _lock:
        cached = _cache.get(days)
        if cached is None or cached[0] is not report or cached[1] <= monotonic():
            with production() as conn:
                result = exposure(report, conn.execute(CATALOG))
            _cache[days] = report, monotonic()+120, result
        else:
            result = cached[2]
    term = search.casefold().strip()
    filtered = [r for r in result["rows"]
                if (stock == "all" or (r["available"] <= 0) == (stock == "out"))
                and (term in r["name"].casefold() or term in r["sku"].casefold())]
    page = min(page, max(1, (len(filtered) + PAGE_SIZE - 1) // PAGE_SIZE))
    return dict(result, matches=len(filtered), page=page, pageSize=PAGE_SIZE,
                rows=filtered[(page-1)*PAGE_SIZE:page*PAGE_SIZE])
