"""Outstanding DNTrade supplier order lines and explicitly linked goods receipts."""
from collections import Counter, defaultdict
from datetime import datetime
from decimal import Decimal

from .register import KYIV, identifier, number


# 17 is a supplier order; 18 is a customer order. Use the live archive body because
# the accounting projection can retain its original body after an upstream correction.
DOCUMENTS = """
WITH orders AS MATERIALIZED (
    SELECT source_id FROM integration.dntrade_archive_records
    WHERE source_account='valko-dntrade' AND entity_type='invoice' AND document_type='order'
      AND status='active' AND source_day<=%s
), candidates AS (
    SELECT r.id, lower(r.source_id) AS ref, r.source_day AS day, r.document_type AS kind,
           r.payload::jsonb->'raw' AS raw, r.organization_id, r.parent_source_id, d.parent_ref, d.parent_kind
    FROM integration.dntrade_archive_records r LEFT JOIN accounting.documents d ON d.id=r.id
    WHERE r.source_account='valko-dntrade' AND r.entity_type='invoice' AND r.document_type IN ('order','in')
      AND r.status='active' AND r.source_day<=%s
), linked AS (
    SELECT c.*, lower(coalesce(nullif(raw#>>'{parent_document,external_id}',''),
        CASE WHEN jsonb_typeof(raw->'parent_document')='string' THEN raw->>'parent_document' END,
        nullif(parent_source_id,''),parent_ref)) AS parent
    FROM candidates c
)
SELECT l.ref,l.id::text AS id,l.day,l.kind,l.parent,l.raw->>'number' AS number,
       lower(coalesce(nullif(l.organization_id,''),l.raw#>>'{organization,external_id}')) AS org,
       lower(l.raw#>>'{partner,external_id}') AS partner,l.raw#>>'{organization,title}' AS org_name,
       coalesce(l.raw#>>'{order_status,title}',l.raw->>'order_status') AS stage,
       coalesce(l.raw->>'planned_delivery_date',l.raw->>'delivery_date',l.raw->>'date_delivery') AS eta,
       l.raw->>'load' AS dispatched,
       (SELECT jsonb_agg(jsonb_build_object('code',p#>>'{product,code}','ref',p#>>'{product,id}',
               'unit',coalesce(p#>>'{product,unit,id}',p#>>'{product,unit,title}',p#>>'{product,unit}'),
               'store',p#>>'{store,external_id}','qty',p->>'quantity'))
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(l.raw->'products')='array' THEN l.raw->'products' ELSE '[]'::jsonb END) p) AS lines
FROM linked l
WHERE lower(coalesce(l.raw->>'status','active'))='active' AND coalesce(l.raw->>'type',l.kind)=l.kind
  AND (l.kind='order' OR (l.parent IN (SELECT lower(source_id) FROM orders)
    AND coalesce(nullif(l.raw#>>'{parent_document,type}',''),l.parent_kind,'order') IN ('17','order')))
"""

# The API invoice export may omit the planned delivery date shown in the supplier
# register. Read the most recent archived register if one has been imported.
REGISTER = """
SELECT payload::jsonb#>'{raw,tables}' AS tables FROM integration.dntrade_archive_records
WHERE source_account='valko-dntrade' AND entity_type='sourceReport' AND source_day<=%s
  AND payload::jsonb#>>'{raw,sourceView}'='/invoices/order'
ORDER BY source_day DESC, imported_at DESC, id DESC LIMIT 1
"""

def unit_label(value):
    value = str(value or "").strip().lower().rstrip(".")
    return {"2009": "шт", "301": "кг", "0301": "кг", "138": "л", "0138": "л",
            "метр": "м", "м. п": "м пог", "кв.м": "м²", "тони": "т"}.get(value, value)


def delivery_day(value):
    if not value:
        return None
    try:
        stamp = datetime.fromisoformat(str(value))
        return (stamp.astimezone(KYIV) if stamp.tzinfo else stamp).date()
    except ValueError:
        try:
            return datetime.strptime(str(value).split()[0], "%d.%m.%Y").date()
        except (ValueError, IndexError):
            return None


def register_entries(tables):
    entries = defaultdict(set)
    for table in tables or []:
        columns = {}
        for row in table:
            values = [str(c.get("value") or "").strip() for c in row["cells"]]
            if row["section"] == "THEAD" and {"Номер","Дата","Організація"} <= set(values):
                columns = {name: i for i,name in enumerate(values)}
            if row["section"] != "TBODY" or not columns or len(values) <= max(columns.values()):
                continue
            fields = {name: values[i] for name,i in columns.items()}
            key = (fields["Номер"],delivery_day(fields["Дата"]),identifier(fields["Організація"]))
            stage = fields.get("Стан замовл.") or fields.get("Стан замовлення")
            if identifier(fields.get("Статус")) in {"деактивований","видалений"}:
                stage = "скасовано"
            entries[key].add((delivery_day(fields.get("Планова дата поставки") or fields.get("Дата поставки")),stage))
    return entries


CONFIRMED = {"підтверджено","на виконанні","замовлено","confirmed","in progress"}
SHIPPED = {"відправлено","відвантажено","в дорозі","shipped","in transit"}
CLOSED = {"виконано","отримано","відмінено","скасовано","закрито","completed","received","cancelled","canceled"}


def line_amounts(doc, catalog_ids):
    amounts = defaultdict(Decimal)
    valid = bool(doc["lines"])
    for line in doc["lines"] or []:
        code, ref = identifier(line["code"]), identifier(line["ref"])
        ids = catalog_ids.get("dntrade-code:" + code, set()) | catalog_ids.get(ref, set())
        qty, unit, store = number(line["qty"]), unit_label(line["unit"]), identifier(line["store"])
        if len(ids) != 1 or qty is None or qty <= 0 or not unit or not store:
            valid = False
        else:
            amounts[next(iter(ids)),store,unit] += qty
    return amounts, valid


def incoming_by_product(documents, entries, catalog_ids):
    receipts = defaultdict(list)
    orders = []
    for doc in documents:
        if doc["kind"] == "order":
            orders.append(doc)
        else:
            receipts[doc["parent"]].append(doc)
    result = defaultdict(list)
    register_keys = [(o["number"],o["day"],identifier(o["org_name"])) for o in orders]
    key_counts = Counter(register_keys)
    for doc,key in zip(orders,register_keys):
        eta, stage = delivery_day(doc["eta"]), identifier(doc["stage"])
        matches = entries.get(key, set())
        if len(matches) == 1 and key_counts[key] == 1:
            register_eta, register_stage = next(iter(matches))
            eta = None if eta and register_eta and eta != register_eta else eta or register_eta
            if identifier(register_stage) in CLOSED or stage not in CONFIRMED | SHIPPED | CLOSED:
                stage = identifier(register_stage) or stage
        if stage in CLOSED | {"нове","чернетка","draft","new"}:
            continue
        ordered, order_valid = line_amounts(doc, catalog_ids)
        receipts_valid = True
        received = defaultdict(Decimal)
        for receipt in receipts[doc["ref"]]:
            amounts, receipt_valid = line_amounts(receipt, catalog_ids)
            if (not receipt_valid or not doc["org"] or not doc["partner"] or doc["org"] != receipt["org"]
                    or doc["partner"] != receipt["partner"] or receipt["day"] < doc["day"] or not amounts.keys() <= ordered.keys()):
                receipts_valid = False
                continue
            for line, qty in amounts.items():
                received[line] += qty
        for line, qty in ordered.items():
            remaining = max(Decimal(0), qty - received[line])
            if not remaining and receipts_valid and order_valid:
                continue
            product,store,unit = line
            state = "review"
            if order_valid and receipts_valid and stage in CONFIRMED | SHIPPED:
                state = "shipped" if stage in SHIPPED or doc["dispatched"] == "1" else "confirmed"
            result[product].append(dict(id=doc["id"], number=doc["number"], day=str(doc["day"]), unit=unit,
                                        ordered=qty, received=received[line] if receipts_valid else None,
                                        remaining=remaining if receipts_valid else None, state=state, eta=str(eta) if eta else None,
                                        org=doc["org"], store=store))
    return result, dict(documents=len(orders), latest=max((str(d["day"]) for d in orders), default=None))


def schedule(deliveries, product, today, cover_days):
    batches, dates = [], defaultdict(Decimal)
    confirmed = shipped = Decimal(0)
    possible = {}
    for batch in deliveries:
        state, eta = batch["state"], delivery_day(batch["eta"])
        scoped = (not product.get("bound") or
                  (product.get("org") == batch["org"] and product.get("store") == batch["store"]))
        unit_matches = batch["unit"] == unit_label(product.get("unit"))
        pending = batch["remaining"]
        if not scoped:
            timing = "other-store"
        elif not unit_matches:
            timing = "units"
        elif state == "review":
            timing = "review"
        else:
            confirmed += pending
            if state == "shipped":
                shipped += pending
            offset = (eta - today).days if eta else None
            if offset is None:
                timing = "undated"
            elif offset < 0:
                timing = "overdue"
            elif offset >= cover_days:
                timing = "later"
            else:
                timing = "within"
                dates[offset] += pending
        if timing in {"review","units","undated","overdue"}:
            offset = max(0, (eta - today).days) if eta else 0
            if offset < cover_days:
                if timing == "units":
                    possible[offset] = None
                elif possible.get(offset, 0) is not None:
                    possible[offset] = possible.get(offset, 0) + (pending if pending is not None else batch["ordered"])
        batches.append(dict((k,v) for k,v in batch.items() if k not in ("org","store")) | {"timing":timing})
    batches.sort(key=lambda b: (b["eta"] is None,b["eta"] or "",b["day"],b["id"]))
    return dict(confirmed=confirmed, inTransit=shipped, within=sum(dates.values(),Decimal(0)), orders=batches), dates, possible
