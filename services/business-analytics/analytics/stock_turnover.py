"""Turnover of catalog products with little or no stock available to the shop."""
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal, ROUND_CEILING
from threading import Lock
from time import monotonic

from .dashboard import dashboard
from .purchase_season import history, profiles
from .register import identifier
from .source import INVENTORY_UNITS, production
from .supplier_orders import DOCUMENTS, REGISTER, incoming_by_product, register_entries, schedule, unit_label
from .supplier_prices import RECEIPT_PRICES, index_receipts, latest_purchase, supplier_budget


THRESHOLD = 3
PAGE_SIZE = 25
PURCHASE_PAGE_SIZE = 100
DEFAULT_COVER_DAYS = 14
COVER_OPTIONS = (7, DEFAULT_COVER_DAYS, 30)
CATALOG = """
SELECT p.id::text, p.navkolo_id AS external, p.sku, coalesce(nullif(p.display_name,''),p.name) AS name,
       p.category_id::text AS category,
       p.is_visible AND NOT p.is_archived AS visible, s.quantity AS on_hand, s.reserved_quantity AS reserved, u.unit,
       (s.warehouse_org_id IS NOT NULL OR s.warehouse_store_id IS NOT NULL) AS bound,
       lower(org.source_id) AS org,lower(store.source_id) AS store,
       s.warehouse_org_id::text AS native_org,s.warehouse_store_id::text AS native_store
FROM catalog.products p LEFT JOIN catalog.product_stock s ON s.product_id=p.id
LEFT JOIN accounting.references org ON org.id=s.warehouse_org_id AND org.source_account='valko-dntrade' AND org.kind='organization'
LEFT JOIN accounting.references store ON store.id=s.warehouse_store_id AND store.source_account='valko-dntrade' AND store.kind='store'
""" + INVENTORY_UNITS


def uncovered_gap(demand, available, days, cover_days, arrivals):
    balance, gap = available, Decimal(0)
    for offset, arriving in sorted(arrivals.items()):
        # Supply arrives before that day's demand, and cannot cover earlier shortages.
        if offset > 0:
            gap = max(gap, demand * offset - balance * days)
        balance += arriving
    return max(gap, demand * cover_days - balance * days)


def resolve_unit(stock_unit, sales):
    unit = unit_label(stock_unit)
    if unit:
        return unit, None
    if sales:
        units = {unit_label(p["salesUnit"]) for p in sales}
        named = units - {"catalog-base", ""}
        if len(named) == 1:
            # The stock report carries no unit for this product, and every sale names the same one.
            # The demand forecast already treats a product with one sales unit as stocked in it.
            return next(iter(named)), "sales"
    return "", None


def purchase_plan(sales, known, stock_unit, available, days, cover_days, arrivals=(), possible=(), factor=1):
    net = sum((p["net"] for p in sales), Decimal(0))
    priced = known and net > 0 and all(p["profit"] is not None for p in sales)
    profit = sum(p["profit"] for p in sales) if priced else None
    unit = unit_label(stock_unit)
    plan = dict(unit=unit or None, unitSource=None, dailyRate=None, stockDays=None, needBeforeIncoming=None, need=None, minimumNeed=None,
                buyQuantity=None, priorityProfit=None, margin=profit / net if priced else None, purchaseStatus="sales")
    if not known:
        return plan
    if sales:
        units = {unit_label(p["salesUnit"]) for p in sales}
        inferred, source = resolve_unit(stock_unit, sales)
        if not unit and inferred:
            unit = inferred
            plan["unitSource"] = source
        if "catalog-base" in units:
            units.remove("catalog-base")
            units.add(unit or "од")
        if units != {unit or "од"}:
            return dict(plan, purchaseStatus="units")
        unit = units.pop()
        if not unit:
            return dict(plan, purchaseStatus="units")
    quantity = sum((p["netQuantity"] for p in sales), Decimal(0))
    observed = max(0, quantity)
    demand = observed * factor
    plan.update(unit=unit or None, dailyRate=observed / Decimal(days))
    if demand > 0:
        plan["stockDays"] = max(0, available) * days / demand
    # Compare in unit-days before division to keep exact integer boundaries when rounding up.
    gross_gap = max(Decimal(0), demand * cover_days - available * days)
    scheduled = dict(arrivals)
    gap = uncovered_gap(demand, available, days, cover_days, scheduled)
    # "од" stands for a unit that neither the stock report nor a sale names: order it in whole units.
    step = Decimal(1) if unit in ("шт", "од") else Decimal(".001")
    need = (gap / (days * step)).to_integral_value(rounding=ROUND_CEILING) * step
    plan["needBeforeIncoming"] = (gross_gap / (days * step)).to_integral_value(rounding=ROUND_CEILING) * step
    plan["need"] = need
    # An unconvertible quantity could cover all demand from its possible arrival day.
    for offset, qty in possible:
        scheduled[offset] = scheduled.get(offset, 0) + (qty if qty is not None else plan["needBeforeIncoming"])
    certain_gap = uncovered_gap(demand, available, days, cover_days, scheduled) if possible else gap
    minimum = (certain_gap / (days * step)).to_integral_value(rounding=ROUND_CEILING) * step
    plan["minimumNeed"] = minimum
    if not demand:
        return dict(plan, purchaseStatus="reserves" if need > 0 else "no-demand")
    if not need:
        return dict(plan, purchaseStatus="incoming" if gross_gap > 0 else "covered")
    if not minimum:
        return dict(plan, purchaseStatus="supply-review")
    if net <= 0 or (priced and profit <= 0):
        return dict(plan, purchaseStatus="price")
    if not priced:
        return dict(plan, purchaseStatus="cost")
    # At the observed turnover share and margin, value only the demand the stock cannot cover.
    uncovered = min(certain_gap, demand * cover_days)
    return dict(plan, purchaseStatus="buy", buyQuantity=minimum, priorityProfit=profit * uncovered / (days * observed))


def exposure(report, catalog, cover_days=DEFAULT_COVER_DAYS, supplier_docs=(), register=None, receipt_prices=(), season_profiles=None,
             today=None):
    catalog = list(catalog)
    by_id = {p["id"]: p for p in catalog}
    by_external = defaultdict(set)
    for p in catalog:
        external = identifier(p["external"])
        if external:
            by_external[external].add(p["id"])
    # The sales period ends before the day of the plan; deliveries and prices are judged on that day.
    today = today or date.fromisoformat(report["through"])
    incoming, source = incoming_by_product(supplier_docs, register or {}, by_external)
    receipts = index_receipts(receipt_prices, by_id, by_external)
    seasons = season_profiles(by_id, by_external) if season_profiles else {}

    matched = defaultdict(list)
    ambiguous = set()
    for product in report["products"]:
        cid = identifier(product.get("catalogId"))
        if cid and cid in by_id:
            matched[cid].append(product)
            continue
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

    incomplete_ids = set()
    for item_ref in report.get("incompleteProductRefs") or ():
        cid = identifier(item_ref.get("catalogId"))
        if cid and cid in by_id:
            incomplete_ids.add(cid)
            continue
        ref, code = identifier(item_ref.get("productRef")), identifier(item_ref.get("code"))
        if item_ref.get("account") == "polivalko-native":
            if ref in by_id:
                incomplete_ids.add(ref)
        elif item_ref.get("account") == "valko-dntrade":
            code_ids = by_external.get("dntrade-code:" + code, set()) if code else set()
            incomplete_ids.update(code_ids | by_external.get(ref, set()))

    period_net = report["current"]["net"]
    rows = []
    for p in catalog:
        if not p["visible"] or p["on_hand"] is None or p["reserved"] is None:
            continue
        available = p["on_hand"] - p["reserved"]
        external = identifier(p["external"])
        imported = external.startswith("dntrade-code:") and len(external) > len("dntrade-code:")
        identified = p["id"] in matched or (imported and len(by_external[external]) == 1)
        known = identified and p["id"] not in ambiguous and p["id"] not in incomplete_ids
        sales = matched.get(p["id"], [])
        net = sum((item["net"] for item in sales), Decimal(0)) if known else None
        supply, arrivals, possible = schedule(incoming.get(p["id"], ()), p, today, cover_days)
        unit, _ = resolve_unit(p["unit"], sales if known else ())
        season = (seasons.get(("product", p["id"], unit)) or seasons.get(("category", p.get("category"), unit))) if unit else None
        plan = purchase_plan(sales, known, p["unit"], available, report["days"], cover_days, arrivals.items(), possible.items(),
                             season["factor"] if season else 1)
        stock_days = plan["stockDays"]
        if available > THRESHOLD and (stock_days is None or stock_days >= cover_days):
            continue
        upcoming = seasons.get(("upcoming", p["id"], unit)) if unit else None
        if upcoming and plan["purchaseStatus"] == "no-demand":
            gap = uncovered_gap(upcoming["rate"], available, 1, cover_days, arrivals)
            if gap > 0:
                plan.update(purchaseStatus="season-review", historicalDemand=upcoming["rate"] * cover_days,
                            historicalSeasons=upcoming["years"])
        rows.append(dict(id=p["id"], name=p["name"], sku=p["sku"], onHand=p["on_hand"], reserved=p["reserved"],
                         available=available, net=net, share=net/period_net if net is not None and period_net>0 else None,
                         supply=supply, season=season,
                         lastPurchase=latest_purchase(receipts.get(p["id"]), plan["unit"], plan["buyQuantity"]), **plan))
    rows.sort(key=lambda r: (r["net"] is None, -(r["net"] or 0), r["available"], r["name"], r["id"]))
    known = [r["net"] for r in rows if r["net"] is not None]
    subtotal = sum(known, Decimal(0)) if known or not rows else None
    out = sum(r["available"] <= 0 for r in rows)
    return dict(start=report["start"], through=report["through"], asOf=str(today), periodNet=period_net, threshold=THRESHOLD,
                coverDays=cover_days, buyCount=sum(r["purchaseStatus"] == "buy" for r in rows),
                incompleteSales=report["incompleteProducts"],
                supplyReview=sum(r["purchaseStatus"] == "supply-review" for r in rows),
                seasonal=season_profiles is not None, seasonalReview=sum(r["purchaseStatus"] == "season-review" for r in rows),
                supplierSource=source, supplierBudget=supplier_budget(rows, today),
                withOrders=sum(bool(r["supply"]["orders"]) for r in rows),
                withDatedSupply=sum(r["supply"]["within"] > 0 for r in rows),
                total=len(rows), outCount=out, lowCount=len(rows)-out, unknownCount=len(rows)-len(known),
                net=subtotal, share=subtotal/period_net if subtotal is not None and period_net>0 else None, rows=rows)


_lock = Lock()
_cache = {}
_profiles = {}


def clear_cache():
    with _lock:
        _cache.clear()
        _profiles.clear()


def stock_page(through, days, page, stock, search, cover_days=DEFAULT_COVER_DAYS, sort="turnover", seasonal=False, refresh=False):
    # Today's sales are not finished. Counted as a whole day they would lower a 7-day rate, and the
    # purchase need with it, by up to a seventh until closing time.
    sold_through = through - timedelta(days=1)
    report = dashboard(sold_through, days, refresh=True) if refresh else dashboard(sold_through, days)
    cache_key = (days, cover_days, "seasonal") if seasonal else (days, cover_days)
    with _lock:
        cached = None if refresh else _cache.get(cache_key)
        if cached is None or cached[0] is not report or cached[1] <= monotonic():
            with production() as conn:
                def load_seasons(by_id, by_external):
                    saved = None if refresh else _profiles.get((days, cover_days))
                    if saved and saved[0] == sold_through and saved[1] > monotonic():
                        return saved[2]
                    result = profiles(history(conn, sold_through, days, cover_days), by_id, by_external, days, cover_days)
                    _profiles[days, cover_days] = sold_through, monotonic() + 1800, result
                    return result

                supplier_docs = list(conn.execute(DOCUMENTS, (through,through)))
                register = conn.execute(REGISTER, (through,)).fetchone()
                prices = conn.execute(RECEIPT_PRICES, (through,))
                result = exposure(report, conn.execute(CATALOG), cover_days, supplier_docs,
                                  register_entries(register["tables"]) if register else {}, prices,
                                  load_seasons if seasonal else None, today=through)
            _cache[cache_key] = report, monotonic()+120, result
        else:
            result = cached[2]
    term = search.casefold().strip()
    searched = [r for r in result["rows"] if term in r["name"].casefold() or term in r["sku"].casefold()]
    # The filter labels count what the search leaves; the turnover header above them keeps every product.
    counts = dict(all=len(searched), buy=sum(r["purchaseStatus"] == "buy" for r in searched),
                  supplyReview=sum(r["purchaseStatus"] == "supply-review" for r in searched),
                  seasonReview=sum(r["purchaseStatus"] == "season-review" for r in searched),
                  ordered=sum(bool(r["supply"]["orders"]) for r in searched),
                  out=sum(r["available"] <= 0 for r in searched), low=sum(r["available"] > 0 for r in searched))
    filtered = [r for r in searched
                if stock == "all" or (stock in ("buy", "season-review", "supply-review") and r["purchaseStatus"] == stock)
                or (stock == "ordered" and r["supply"]["orders"])
                or (stock == "low" and r["available"] > 0) or (stock == "out" and r["available"] <= 0)]
    if sort == "purchase":
        priority = {"buy": 0, "supply-review": 1, "season-review": 1, "reserves": 1, "cost": 2, "price": 3,
                    "units": 4, "sales": 4, "covered": 5, "incoming": 5, "no-demand": 6}
        # The existing turnover order breaks ties and orders positions requiring review.
        filtered.sort(key=lambda r: (priority[r["purchaseStatus"]], -(r["priorityProfit"] or 0)))
    page_size = PURCHASE_PAGE_SIZE if stock == "buy" else PAGE_SIZE
    page = min(page, max(1, (len(filtered) + page_size - 1) // page_size))
    return dict(result, counts=counts, matches=len(filtered), page=page, pageSize=page_size,
                rows=filtered[(page-1)*page_size:page*page_size])
