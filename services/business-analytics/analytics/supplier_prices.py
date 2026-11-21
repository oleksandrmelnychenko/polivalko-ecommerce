"""Last received purchase price and supplier for replenishment estimates."""
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP

from .purchase_cost import ORG, STORE, UNIT, timestamp
from .register import identifier
from .supplier_orders import unit_label


RECEIPT_PRICES = f"""
WITH positions AS (
    SELECT d.source_account AS account,d.id::text AS doc,d.number,d.day,d.details->>'date' AS stamp,
           {ORG} AS org,{STORE} AS store,{UNIT} AS unit,
           coalesce(d.native_partner_id::text,nullif(d.partner_ref,''),d.details#>>'{{partner,external_id}}') AS partner,
           coalesce(nullif(trim(d.partner_title),''),nullif(trim(d.details#>>'{{partner,title}}'),'')) AS supplier,
           lower(l#>>'{{product,id}}') AS ref,lower(l#>>'{{product,code}}') AS code,
           accounting.stock_number(l->>'quantity') AS qty,accounting.stock_number(l->>'total') AS amount,
           lower(d.currency) IN ('uah','980') AND coalesce(lower(d.details->>'currency_iso'),'uah') IN ('uah','980') AS uah,
           d.total AS invoice_total
    FROM accounting.documents d CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(d.details->'products')='array' THEN d.details->'products' ELSE '[]'::jsonb END) l
    WHERE d.day BETWEEN %s AND %s AND d.entity_type='invoice' AND d.kind='in'
      AND ((d.source_account='polivalko-native' AND d.status='posted')
        OR (d.source_account='valko-dntrade' AND lower(d.status) IN ('active','активна','активний','posted')
        AND coalesce(lower(d.details->>'status'),'active') IN ('active','активна','активний','posted')
        AND coalesce(lower(d.details->>'type'),'in') IN ('in','2')
        AND coalesce(d.details->>'load','1')='1'))
), checked AS (
    SELECT *,uah AND round(sum(amount) OVER doc_lines,2)=round(invoice_total,2)
            AND bool_and(qty IS NOT NULL AND qty>0 AND amount IS NOT NULL AND amount>=0) OVER doc_lines AS valid,
           max(day) OVER (PARTITION BY account,org,store,ref,code) AS latest
    FROM positions WINDOW doc_lines AS (PARTITION BY doc)
)
SELECT account,doc,number,day,stamp,org,store,ref,code,partner,supplier,unit,sum(qty) AS qty,
       CASE WHEN bool_and(valid) THEN sum(amount) END AS amount
FROM checked WHERE day=latest
GROUP BY account,doc,number,day,stamp,org,store,ref,code,partner,supplier,unit
"""


def index_receipts(receipts, catalog, external_ids):
    indexed = defaultdict(list)
    for r in receipts:
        if r["account"] == "polivalko-native":
            ids = {r["ref"]} if r["ref"] in catalog else set()
        else:
            code = identifier(r["code"])
            code_ids = external_ids.get("dntrade-code:" + code, set()) if code else set()
            ids = external_ids.get(identifier(r["ref"]), set()) | code_ids
        for product_id in ids:
            product = catalog[product_id]
            if product.get("bound"):
                native = r["account"] == "polivalko-native"
                org = product.get("native_org" if native else "org")
                store = product.get("native_store" if native else "store")
                if ((product["native_org"] and (not org or r["org"] != org))
                        or (product["native_store"] and (not store or r["store"] != store))):
                    continue
            indexed[product_id].append((r, len(ids) == 1))
    return indexed


def latest_purchase(entries, unit, buy_quantity):
    if not entries:
        return None
    day = max(r["day"] for r, _ in entries)
    latest = [(r, matched) for r, matched in entries if r["day"] == day]
    if len({r["doc"] for r, _ in latest}) > 1:
        moments = [timestamp(r["stamp"], day) for r, _ in latest]
        if all(moments):
            last = max(moments)
            latest = [entry for entry, moment in zip(latest, moments) if moment == last]
    purchase = dict(day=str(day), documentId=None, number=None, supplierId=None, supplier=None,
                    unit=None, unitPrice=None, amount=None, issue=None)
    if len({r["doc"] for r, _ in latest}) != 1 or not all(matched for _, matched in latest):
        return dict(purchase, issue="ambiguous")
    lines = [r for r, _ in latest]
    doc = lines[0]
    purchase.update(documentId=doc["doc"], number=doc["number"], supplier=doc["supplier"],
                    supplierId=(doc["account"] + ":" + identifier(doc["partner"])) if identifier(doc["partner"]) else None)
    units = {unit_label(r["unit"]) if r["unit"] != "catalog-base" else unit for r in lines}
    if len(units) != 1 or not all(units):
        return dict(purchase, issue="unit")
    purchase["unit"] = units.pop()
    if any(r["amount"] is None or not r["qty"] or r["qty"] <= 0 for r in lines):
        return dict(purchase, issue="price")
    quantity = sum(r["qty"] for r in lines)
    amount = sum(r["amount"] for r in lines)
    if amount <= 0:
        return dict(purchase, issue="price")
    purchase["unitPrice"] = amount / quantity
    if purchase["unit"] != unit:
        return dict(purchase, issue="unit")
    if buy_quantity is not None:
        purchase["amount"] = (buy_quantity * amount / quantity).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return purchase


def supplier_budget(rows):
    groups = {}
    for row in rows:
        if row["buyQuantity"] is None:
            continue
        purchase = row["lastPurchase"] or {}
        key = purchase.get("supplierId") if purchase.get("supplier") else None
        group = groups.setdefault(key, dict(id=key, name=purchase.get("supplier") if key else None,
                                             subtotal=Decimal(0), unpriced=0, items=[]))
        amount = purchase.get("amount")
        if amount is None:
            group["unpriced"] += 1
        else:
            group["subtotal"] += amount
        group["items"].append(dict(id=row["id"], sku=row["sku"], name=row["name"], quantity=row["buyQuantity"],
                                   unit=row["unit"], unitPrice=purchase.get("unitPrice") if amount is not None else None,
                                   amount=amount))
    suppliers = sorted(groups.values(), key=lambda g: (not g["id"], -g["subtotal"], g["name"] or "", g["id"] or ""))
    return dict(subtotal=sum((g["subtotal"] for g in suppliers), Decimal(0)),
                unpriced=sum(g["unpriced"] for g in suppliers), suppliers=suppliers)
