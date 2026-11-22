"""Suggestions for identified customers based on their own completed sales."""
from collections import defaultdict
from datetime import timedelta
from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP
from statistics import median
from threading import Lock
from time import monotonic

from .invoices import INDEPENDENT_RECEIPTS, currency_valid
from .purchase_cost import UNIT
from .register import identifier, kind_of
from .source import INVENTORY_UNITS, production
from .supplier_orders import unit_label


_HEAD = """SELECT d.* FROM accounting.documents d """
_SALES = _HEAD + """WHERE d.day >= %s AND d.day < %s AND d.entity_type IN ('invoice','customerReturn')
    AND d.kind NOT IN ('in','order') UNION ALL """ + _HEAD + INDEPENDENT_RECEIPTS
HISTORY = f"""
WITH identities AS (
    SELECT source_account,lower(source_id) AS ref,min(id::text)::uuid AS id FROM accounting.partners
    GROUP BY 1,2 HAVING count(*)=1
), recent AS (
    SELECT DISTINCT r.partner_id AS client,p.title AS name FROM accounting.document_register r
    JOIN accounting.partners p ON p.id=r.partner_id
    WHERE r.day BETWEEN %s AND %s AND r.entity_type IN ('invoice','receipt') AND trim(p.title)<>''
      AND lower(trim(p.title)) NOT IN
        ('роздрібний покупець','розничный покупатель','кінцевий споживач','покупець','роздріб','розница','анонімний покупець')
), positions AS (
    SELECT d.id,r.client::text,r.name,d.source_account AS account,d.entity_type,d.kind,d.status,d.day,d.currency,
        d.details->>'type' AS raw_kind,d.details->>'status' AS raw_status,d.details->>'currency_iso' AS raw_currency,
        d.total,lower(l#>>'{{product,id}}') AS ref,lower(l#>>'{{product,code}}') AS code,{UNIT} AS unit,
        accounting.stock_number(l->>'quantity') AS qty,accounting.stock_number(l->>'total') AS amount
    FROM ({_SALES}) d LEFT JOIN identities i ON i.source_account=d.source_account AND i.ref=lower(d.partner_ref)
    JOIN recent r ON r.client=coalesce(d.native_partner_id,i.id)
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(d.details->'products')='array' THEN d.details->'products' ELSE '[]'::jsonb END) l
), checked AS (
    SELECT *,sum(abs(amount)) OVER doc=abs(total) AND
        bool_and(qty IS NOT NULL AND qty<>0 AND amount IS NOT NULL) OVER doc AS valid,
        bool_and(qty>0 AND amount>=0) OVER doc AS sale_signs
    FROM positions WINDOW doc AS (PARTITION BY id)
)
SELECT id,client,name,account,entity_type,kind,status,day,currency,raw_kind,raw_status,raw_currency,
       ref,code,unit,sale_signs,sum(abs(qty)) AS qty
FROM checked WHERE valid AND amount<>0
GROUP BY id,client,name,account,entity_type,kind,status,day,currency,raw_kind,raw_status,raw_currency,
         ref,code,unit,sale_signs
"""
CATALOG = """
SELECT p.id::text,p.navkolo_id,p.sku,coalesce(nullif(p.display_name,''),p.name) AS name,u.unit,
       (s.quantity-s.reserved_quantity)::numeric AS available,price.amount AS price,p.is_archived
FROM catalog.products p LEFT JOIN catalog.product_prices price ON price.product_id=p.id
LEFT JOIN catalog.product_stock s ON s.product_id=p.id
""" + INVENTORY_UNITS


def suggestion(product, unit, purchases, returned, today):
    days = sorted({day for day, _ in purchases})
    net = sum(purchases.values()) - returned
    step = Decimal(1) if unit == "шт" else Decimal(".001")
    available = product["available"].quantize(step, rounding=ROUND_DOWN)
    if net <= 0 or available <= 0:
        return None
    typical = (net / len(purchases)).quantize(step, rounding=ROUND_HALF_UP)
    quantity = min(available, max(step, typical))
    gap = round(median((b-a).days for a, b in zip(days, days[1:]))) if len(days) >= 2 else None
    due = days[-1] + timedelta(days=gap) if gap else None
    seasons = sum(any(start <= d < start+timedelta(days=30) for d in days)
                  for start in (today-timedelta(weeks=52*y) for y in (1, 2)))
    signal = ("due" if due and today-timedelta(days=gap) <= due <= today+timedelta(days=14) else "season" if seasons
              else "repeat" if len(days) > 1 else "single")
    return dict(id=product["id"], name=product["name"], sku=product["sku"], unit=unit,
                purchases=len(purchases), last=str(days[-1]), interval=gap, seasons=seasons, signal=signal,
                available=available, quantity=quantity, price=product["price"],
                amount=(quantity*product["price"]).quantize(Decimal(".01"), rounding=ROUND_HALF_UP))


def rank_clients(rows, catalog, today):
    products = {p["id"]: p for p in catalog}
    external = defaultdict(set)
    for p in products.values():
        if ref := identifier(p["navkolo_id"]):
            external[ref].add(p["id"])
    customers = {}
    sales = defaultdict(lambda: defaultdict(Decimal))
    refunds = defaultdict(Decimal)
    for row in rows:
        kind = "receipt" if row["entity_type"] == "receipt" else kind_of(row)
        if kind not in ("sale", "return", "receipt") or not currency_valid(row):
            continue
        if kind != "return" and (not row["sale_signs"] or (kind == "receipt" and row["entity_type"] != "receipt")):
            continue
        client = row["client"]
        if kind != "return" and row["day"] >= today-timedelta(days=89):
            current = customers.get(client)
            if not current or current["lastSale"] < str(row["day"]):
                customers[client] = dict(id=client, name=row["name"], lastSale=str(row["day"]), items=[])
        ref = identifier(row["ref"])
        if row["account"] == "polivalko-native":
            product = products.get(ref)
        elif row["account"] == "valko-dntrade":
            ids = external.get(ref, set()) | external.get("dntrade-code:"+identifier(row["code"]), set())
            product = products[next(iter(ids))] if len(ids) == 1 else None
        else:
            continue
        if not product or product["is_archived"] or (product["price"] or 0) <= 0 or (product["available"] or 0) <= 0:
            continue
        unit = unit_label(product["unit"])
        if row["unit"] == "catalog-base":
            unit = unit or "од."
        elif not unit or unit != unit_label(row["unit"]):
            continue
        key = client, product["id"], unit
        if kind == "return":
            refunds[key] += row["qty"]
        else:
            sales[key][row["day"], row["id"]] += row["qty"]
    for key, purchases in sales.items():
        client, pid, unit = key
        if client in customers:
            item = suggestion(products[pid], unit, purchases, refunds[key], today)
            if item:
                customers[client]["items"].append(item)
    priority = {"due": 0, "season": 1, "repeat": 2, "single": 3}
    for customer in customers.values():
        items = customer["items"]
        items.sort(key=lambda i: (priority[i["signal"]], -i["seasons"], -i["purchases"], -i["amount"], i["id"]))
        del items[3:]
    return sorted(customers.values(), key=lambda c: (
        priority[c["items"][0]["signal"]] if c["items"] else 4,
        -sum(i["amount"] for i in c["items"]), c["name"].casefold(), c["id"]))


_cache = None
_lock = Lock()


def customer_recommendations(today, days):
    global _cache
    with _lock:
        if not _cache or _cache[0] != today or _cache[1] <= monotonic():
            bounds = (today-timedelta(days=729), today+timedelta(days=1))
            with production() as conn:
                rows = conn.execute(HISTORY, (today-timedelta(days=89), today, *bounds, *bounds)).fetchall()
                customers = rank_clients(rows, conn.execute(CATALOG), today)
            _cache = today, monotonic()+120, customers
        start = str(today-timedelta(days=days-1))
        active = [c for c in _cache[2] if c["lastSale"] >= start]
    return dict(start=start, through=str(today), active=len(active), clients=[c for c in active if c["items"]])
