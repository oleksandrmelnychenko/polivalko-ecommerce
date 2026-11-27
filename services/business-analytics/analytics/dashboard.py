"""Daily sales KPIs from posted accounting documents in the production register."""
from collections import defaultdict
from datetime import timedelta
from decimal import Decimal
from itertools import chain
from threading import Lock
from time import monotonic

from .invoices import INDEPENDENT_RECEIPT_ROWS, PARENT_REF, body_in_hryvnia, currency_valid
from .product_contribution import turnover_ranking
from .purchase_cost import LINES, ORG, direct_cost, enrich_costs
from .register import identifier, kind_of, number, sale_line, unit_label
from .source import production


FIELDS = f"""
SELECT d.day, d.entity_type, d.source_account AS account, d.kind, d.status, d.currency, d.total,
       {ORG} AS org, d.details->>'date' AS stamp, {PARENT_REF} AS parent,d.parent_kind,
       d.details->>'type' AS raw_kind, d.details->>'status' AS raw_status, d.details->>'currency_iso' AS raw_currency,
       CASE WHEN d.day >= %s THEN {LINES} END AS lines
FROM accounting.documents d
"""
HEADERS = FIELDS + "WHERE d.entity_type IN ('invoice','customerReturn') AND d.day >= %s AND d.day < %s"
RECEIPTS = FIELDS + INDEPENDENT_RECEIPT_ROWS
CATALOG_LINKS = """
SELECT id::text AS id, lower(navkolo_id) AS external, sku, coalesce(nullif(display_name,''), name) AS name
FROM catalog.products
"""


def totals():
    return dict(invoices=0, receipts=0, refunds=0, gross=Decimal(0), returned=Decimal(0))


def _merge_unit(current, conflict, incoming):
    if conflict:
        return None, True
    if incoming == "catalog-base":
        return (current if current is not None else "catalog-base"), False
    if current == "catalog-base":
        return incoming, incoming is None
    if current == incoming:
        return current, False
    return None, True


def summarize(rows, through, days, catalog=None):
    start = through - timedelta(days=days - 1)
    current, previous = totals(), totals()
    by_day = {str(start + timedelta(days=i)): dict(net=Decimal(0), purchases=0) for i in range(days)}
    by_id = {identifier(p["id"]): p for p in (catalog or ()) if identifier(p.get("id"))}
    by_external = defaultdict(set)
    for p in (catalog or ()):
        ext = identifier(p.get("external") or p.get("navkolo_id"))
        pid = identifier(p.get("id"))
        if ext and pid:
            by_external[ext].add(pid)

    def canonical_product(account, code, pid):
        if account == "polivalko-native":
            return pid if pid in by_id else None
        if account == "valko-dntrade":
            candidates = (by_external.get("dntrade-code:" + code, set()) if code else set()) | (
                by_external.get(pid, set()) if pid else set()
            )
            if len(candidates) == 1:
                return next(iter(candidates))
        return None

    products = {}
    incomplete_refs = set()
    excluded = incomplete_products = 0
    latest = None
    for row in rows:
        kind = "receipt" if row["entity_type"] == "receipt" else kind_of(row)
        if kind not in ("sale", "receipt", "return", "invalid") or (kind == "receipt" and row["entity_type"] != "receipt"):
            continue
        amount = number(row["total"])
        day = row["day"]
        if kind == "invalid" or amount is None or not (body_in_hryvnia if kind == "receipt" else currency_valid)(row):
            excluded += int(day >= start)
            continue
        amount = abs(amount)
        refund = kind == "return"
        period = current if day >= start else previous
        period[{"sale": "invoices", "receipt": "receipts", "return": "refunds"}[kind]] += 1
        period["returned" if refund else "gross"] += amount
        # Keep the date when the newest document is older than the period: zeros then have a reason.
        latest = max(latest or day, day)
        if day < start:
            continue
        daily = by_day[str(day)]
        daily["net"] += -amount if refund else amount
        daily["purchases"] += int(not refund)
        parsed = [sale_line(line, refund) for line in (row["lines"] or [])]
        if not parsed or not all(parsed) or sum(line[-1] for line in parsed) != amount:
            incomplete_products += 1
            for raw_line in (row["lines"] or []):
                if not isinstance(raw_line, dict) or not isinstance(raw_line.get("product"), dict):
                    continue
                p = raw_line["product"]
                code = identifier(p.get("code"))
                pid = identifier(p.get("id"))
                cid = canonical_product(row["account"], code, pid)
                if cid or pid or code:
                    incomplete_refs.add((row["account"], cid or "", pid, code))
            continue
        for line, (product, code, pid, sku, quantity, value) in zip(row["lines"], parsed):
            identity = pid or code or sku
            cid = canonical_product(row["account"], code, pid)
            key = ("catalog", cid) if cid else (row["account"], "id" if pid else "code" if code else "sku", identity)
            raw_unit = line.get("unit")
            line_unit = unit_label(raw_unit) or None if raw_unit is not None else None
            if key not in products:
                meta = by_id.get(cid, {}) if cid else {}
                item = products[key] = dict(name=str(meta.get("name") or product.get("title") or identity),
                                            sku=str(meta.get("sku") or product.get("sku") or ""),
                                            code=code, productRef=pid, catalogId=cid, account=row["account"],
                                            net=Decimal(0), profit=Decimal(0), netQuantity=Decimal(0),
                                            salesUnit=line_unit, _unitConflict=False,
                                            lines=0, costedLines=0, coveredNet=Decimal(0), coveredCost=Decimal(0),
                                            purchaseSources={})
            else:
                item = products[key]
                if code:
                    if item["code"] and item["code"] != code:
                        item["code"] = None
                    elif item["code"] == "":
                        item["code"] = code
                elif not cid and item["code"] != code:
                    item["code"] = None
                if cid and row["account"] == "valko-dntrade":
                    item["account"] = "valko-dntrade"
                    if pid and not item["productRef"]:
                        item["productRef"] = pid
                item["salesUnit"], item["_unitConflict"] = _merge_unit(item["salesUnit"], item["_unitConflict"], line_unit)
            sign = -1 if refund else 1
            item["netQuantity"] += sign * quantity
            item["net"] += sign * value
            item["lines"] += 1
            cost = direct_cost(line)
            if cost is None:
                cost = line.get("derived_cost")
                for ref, label, source_day in line.get("purchase_sources", ()):
                    item["purchaseSources"][ref] = dict(id=ref, number=label, day=source_day)
            if cost is None or (cost <= 0 and not refund):
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
        item.pop("_unitConflict", None)
        item["cost"] = item["net"] - item["profit"] if item["profit"] is not None else None
        item["purchaseSources"] = sorted(item["purchaseSources"].values(),key=lambda s: (s["day"],s["id"]))
    return dict(days=days, start=str(start), through=str(through), latest=str(latest) if latest else None,
                current=current, previous=previous, byDay=[dict(day=d, **v) for d, v in by_day.items()],
                products=ranking, excluded=excluded, incompleteProducts=incomplete_products,
                incompleteProductRefs=[
                    dict(account=acc, catalogId=cid or None, productRef=pid or None, code=code or None)
                    for acc, cid, pid, code in sorted(incomplete_refs)
                ])


_lock = Lock()
_cache = {}


def clear_cache():
    with _lock:
        _cache.clear()


def dashboard(through, days, refresh=False):
    if days not in (7, 30, 90):
        raise ValueError("Виберіть 7, 30 або 90 днів")
    start = through - timedelta(days=days - 1)
    bounds = start, start - timedelta(days=days), through + timedelta(days=1)
    with _lock:
        saved = None if refresh else _cache.get((days, through))
        if saved and saved[0] > monotonic():
            return saved[1]
        with production() as conn:
            rows = list(chain(conn.execute(HEADERS, bounds), conn.execute(RECEIPTS, bounds)))
            enrich_costs(conn, rows, start)
            catalog = list(conn.execute(CATALOG_LINKS))
            result = summarize(rows, through, days, catalog)
        # The sales tiles read the period that ends today, the purchase queue the one that ended
        # yesterday. Both stay; periods that ended earlier are of no use any more.
        for stale in [key for key in _cache if key[1] < through - timedelta(days=1)]:
            del _cache[stale]
        _cache[days, through] = monotonic() + 120, result
        return result
