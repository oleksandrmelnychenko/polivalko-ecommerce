"""Suggestions for identified customers based on their own completed sales."""
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP
from statistics import median
from threading import Lock
from time import monotonic

from .invoices import INDEPENDENT_RECEIPTS, currency_valid
from .purchase_cost import UNIT
from .register import identifier, kind_of
from .source import INVENTORY_UNITS, production
from .supplier_orders import unit_label


SIGNAL_PRIORITY = {"due": 0, "season": 1, "repeat": 2, "single": 3}
_HEAD = """SELECT d.* FROM accounting.documents d """
_SALES = _HEAD + """WHERE d.day >= %s AND d.day < %s AND d.entity_type IN ('invoice','customerReturn')
    AND d.kind NOT IN ('in','order') UNION ALL """ + _HEAD + INDEPENDENT_RECEIPTS
RETAIL_PLACEHOLDER = (r"(^| )(роздрібний покупець|роздрібні покупці|розничный покупатель|розничные покупатели)"
                      r"( *[(].*[)])?$")
HISTORY = f"""
WITH identities AS (
    SELECT source_account,lower(source_id) AS ref,min(id::text)::uuid AS id FROM accounting.partners
    GROUP BY 1,2 HAVING count(*)=1
), recent AS (
    SELECT DISTINCT r.partner_id AS client,p.title AS name FROM accounting.document_register r
    JOIN accounting.partners p ON p.id=r.partner_id
    WHERE r.day BETWEEN %s AND %s AND r.entity_type IN ('invoice','receipt') AND trim(p.title)<>''
      AND lower(trim(p.title)) !~ '{RETAIL_PLACEHOLDER}'
      AND lower(trim(p.title)) NOT IN ('кінцевий споживач','покупець','роздріб','розница','анонімний покупець')
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
""" + INVENTORY_UNITS + """
WHERE p.id::text = ANY(%s::text[]) OR lower(trim(p.navkolo_id)) = ANY(%s::text[])
"""


def suggestion(product, unit, purchases, returned, today):
    days = sorted({day for day, _ in purchases})
    net = sum(purchases.values()) - returned
    step = Decimal(1) if unit == "шт" else Decimal(".001")
    available = product["available"].quantize(step, rounding=ROUND_DOWN)
    if net <= 0 or available <= 0:
        return None
    typical = (net / len(purchases)).quantize(step, rounding=ROUND_HALF_UP)
    requested = max(step, typical)
    quantity = min(available, requested)
    gap = round(median((b-a).days for a, b in zip(days, days[1:]))) if len(days) >= 2 else None
    due = days[-1] + timedelta(days=gap) if gap else None
    seasons = sum(any(start <= d < start+timedelta(days=30) for d in days)
                  for start in (today-timedelta(weeks=52*y) for y in (1, 2)))
    signal = ("due" if due and today-timedelta(days=gap) <= due <= today+timedelta(days=14) else "season" if seasons
              else "repeat" if len(days) > 1 else "single")
    return dict(id=product["id"], name=product["name"], sku=product["sku"], unit=unit,
                purchases=len(purchases), last=str(days[-1]), interval=gap, seasons=seasons, signal=signal,
                available=available, requested=requested, quantity=quantity, price=product["price"],
                dueOn=str(due) if signal == "due" else None,
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
        # A position's code is the product code; kind_of reads that name as the document type code.
        kind = "receipt" if row["entity_type"] == "receipt" else kind_of({**row, "code": None})
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
    for customer in customers.values():
        items = customer["items"]
        items.sort(key=lambda i: (SIGNAL_PRIORITY[i["signal"]], -i["seasons"], -i["purchases"], -i["amount"], i["id"]))
        del items[3:]
    return list(customers.values())


def buyer_priority(entry):
    client_id, item = entry
    return (SIGNAL_PRIORITY[item["signal"]], item["dueOn"] or "", -item["seasons"], -item["purchases"],
            -date.fromisoformat(item["last"]).toordinal(), client_id)


OFFER_LOG = """
SELECT o.id::text, o.partner_id::text AS client, p.title AS customer, o.product_id::text AS product,
       coalesce(nullif(c.display_name,''),c.name) AS name,c.sku,
       o.last_purchase::text AS last,o.quantity,o.unit,o.price,o.status,o.invoice_id::text AS "invoiceId",
       (s.warehouse_store_id IS NOT NULL AND s.warehouse_org_id IS NOT NULL) AS "hasWarehouseSource",
       (o.offered_at AT TIME ZONE 'Europe/Kyiv')::text AS "offeredAt",
       (o.changed_at AT TIME ZONE 'Europe/Kyiv')::text AS "changedAt"
FROM accounting.recommendation_offers o JOIN accounting.partners p ON p.id=o.partner_id
JOIN catalog.products c ON c.id=o.product_id
LEFT JOIN catalog.product_stock s ON s.product_id=o.product_id
WHERE o.status IN ('offered','reserved') OR o.last_purchase >= %s OR o.changed_at >= %s
ORDER BY o.offered_at,o.id
"""


def allocate_stock(active, offers=()):
    """Allocate one period's shortlist without modifying the cached sales history."""
    clients = []
    by_product = defaultdict(list)
    for customer in active:
        if not customer["items"]:
            continue
        items = [item.copy() for item in customer["items"]]
        clients.append(dict(customer, items=items))
        for item in items:
            by_product[item["id"]].append((customer["id"], item))

    cycles = {(o["client"], o["product"], o["last"]): o for o in offers}
    open_pairs = {(o["client"], o["product"]): o for o in offers if o["status"] in ("offered","reserved")}
    pending = defaultdict(list)
    for offer in offers:
        if offer["status"] == "offered":
            pending[offer["product"]].append(offer)
    offer_order = {o["id"]: n for n, o in enumerate(offers)}
    for product, queue in by_product.items():
        remaining = queue[0][1]["available"]
        assigned = {}
        for offer in pending[product]:
            assigned[offer["id"]] = min(offer["quantity"], remaining)
            remaining -= assigned[offer["id"]]
        for client, item in queue:
            offer = open_pairs.get((client, product)) or cycles.get((client, product, item["last"]))
            item["offerId"] = offer["id"] if offer else None
            item["offerStatus"] = offer["status"] if offer else None
            if offer and offer["status"] == "offered":
                item["price"] = offer["price"]
        def priority(entry):
            item = entry[1]
            if item["offerStatus"] == "offered":
                return (0, offer_order[item["offerId"]])
            return (2 if item["offerId"] else 1, buyer_priority(entry))
        queue.sort(key=priority)
        # A reserved, declined, released or shipped offer is an answer. Such a buyer stays on the list
        # with the decision, but no longer waits for stock: the queue, its need and any shortage are
        # counted from buyers who have not answered or have not been asked yet.
        waiting = sum(not item["offerId"] or item["offerStatus"] == "offered" for _, item in queue)
        # Stock kept for offers without an answer, also those made to customers outside this period.
        held = sum(assigned.values())
        for rank, (_, item) in enumerate(queue, start=1):
            if item["offerId"]:
                quantity = assigned.get(item["offerId"], 0)
            else:
                quantity = min(item["requested"], remaining)
                remaining -= quantity
            if item["offerId"] and item["offerStatus"] != "offered":
                item.update(rank=0, buyers=0, requested=Decimal(0))
            else:
                item.update(rank=rank, buyers=waiting)
            item.update(quantity=quantity, held=Decimal(0) if item["offerId"] else held,
                        amount=(quantity * item["price"]).quantize(Decimal(".01"), rounding=ROUND_HALF_UP))

    for customer in clients:
        customer["items"].sort(key=lambda item: item["quantity"] == 0)
    return sorted(clients, key=lambda c: (
        c["items"][0]["quantity"] == 0, SIGNAL_PRIORITY[c["items"][0]["signal"]],
        -sum(i["amount"] for i in c["items"]), c["name"].casefold(), c["id"]))


def allocation_report(customers, today, days, offers=()):
    start = str(today-timedelta(days=days-1))
    active = [c for c in customers if c["lastSale"] >= start]
    clients = allocate_stock(active, offers)
    visible_offers = {i["offerId"] for c in clients for i in c["items"] if i["offerId"]}
    return dict(start=start, through=str(today), active=len(active), clients=clients,
                offers=[o for o in reversed(offers) if o["status"] in ("offered","reserved") or o["changedAt"][:10] >= start
                        or o["id"] in visible_offers],
                # Customers still to be asked: a quantity held by an unanswered offer is already offered.
                offeredClients=sum(any(i["quantity"] > 0 and not i["offerId"] for i in c["items"]) for c in clients))


_history_cache = None
_lock = Lock()


def customer_recommendations(today, days):
    global _history_cache
    with production() as conn:
        with _lock:
            if not _history_cache or _history_cache[0] != today or _history_cache[1] <= monotonic():
                bounds = (today-timedelta(days=729), today+timedelta(days=1))
                rows = conn.execute(HISTORY, (today-timedelta(days=89), today, *bounds, *bounds)).fetchall()
                native_ids, external_ids = set(), set()
                for row in rows:
                    ref = identifier(row["ref"])
                    if row["account"] == "polivalko-native" and ref:
                        native_ids.add(ref)
                    elif row["account"] == "valko-dntrade":
                        if ref:
                            external_ids.add(ref)
                        if code := identifier(row["code"]):
                            external_ids.add("dntrade-code:" + code)
                _history_cache = today, monotonic()+120, rows, (sorted(native_ids), sorted(external_ids))
            _, _, rows, catalog_ids = _history_cache
        catalog = conn.execute(CATALOG, catalog_ids) if any(catalog_ids) else ()
        customers = rank_clients(rows, catalog, today)
        offers = conn.execute(OFFER_LOG, (today-timedelta(days=729), today-timedelta(days=days))).fetchall()
        return allocation_report(customers, today, days, offers)
