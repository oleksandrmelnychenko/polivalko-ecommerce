"""As-of acquisition prices for dashboard sales, isolated by stock owner and warehouse."""
from bisect import bisect_left
from collections import defaultdict
from datetime import datetime
import json

from .invoices import currency_valid
from .register import ACTIVE, INACTIVE, KINDS, identifier, kind_of, number, sale_line


ORG = "lower(coalesce(d.native_org_id::text, nullif(d.organization_id,''), d.details#>>'{organization,external_id}'))"
STORE = "lower(coalesce(nullif(l#>>'{store,external_id}',''),nullif(l#>>'{store,id}',''),d.native_store_id::text))"
UNIT = """lower(coalesce(nullif(l#>>'{product,unit,external_id}',''),nullif(l#>>'{product,unit,id}',''),
    nullif(l#>>'{product,unit,title}',''), CASE WHEN jsonb_typeof(l#>'{product,unit}') IN ('number','string') THEN l#>>'{product,unit}' END,
    CASE WHEN d.source_account='polivalko-native' THEN 'catalog-base' END))"""
LINES = f"""(SELECT jsonb_agg(jsonb_build_object('quantity',l->'quantity','total',l->'total','cogs_total',l->'cogs_total',
    'store',{STORE},'unit',{UNIT},'product',jsonb_build_object('id',l#>'{{product,id}}','sku',l#>'{{product,sku}}',
    'code',l#>'{{product,code}}','title',l#>'{{product,title}}')))
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(d.details->'products')='array' THEN d.details->'products' ELSE '[]'::jsonb END) l)"""
PARENTS = f"""
SELECT d.source_account AS account, lower(d.source_id) AS ref, d.entity_type,d.kind,d.status,d.currency,d.total,
       {ORG} AS org, d.day, d.details->>'date' AS stamp,d.details->>'type' AS raw_kind,
       d.details->>'status' AS raw_status,d.details->>'currency_iso' AS raw_currency,{LINES} AS lines
FROM jsonb_to_recordset(%s::jsonb) n(a text,r text) JOIN accounting.documents d
 ON d.source_account=n.a AND lower(d.source_id)=n.r AND d.entity_type IN ('receipt','invoice')
"""
# Only transfer invoices for requested products and dates. Keep one previous buying day
# per stock key as the opening price, including an unpriced day if its checks failed.
def checked_purchases(document_filter=""):
    return f"""positions AS (
  SELECT d.id,d.number,d.day,d.source_account AS a,{ORG} AS o,{STORE} AS s,
    CASE WHEN nullif(l#>>'{{product,id}}','') IS NOT NULL THEN 'id:'||lower(l#>>'{{product,id}}')
         ELSE 'code:'||lower(l#>>'{{product,code}}') END AS p,{UNIT} AS u,d.details->>'date' AS stamp,
    lower(l#>>'{{product,code}}') AS external_code,d.total,
    accounting.stock_number(l->>'quantity') AS qty,accounting.stock_number(l->>'total') AS amount,
    d.details->>'extra_costs' AS extras
  FROM accounting.documents d CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(d.details->'products')='array' THEN d.details->'products' ELSE '[]'::jsonb END) l
  WHERE d.entity_type='invoice' AND d.kind='in' AND d.day <= (SELECT max(last_day) FROM needed)
    AND ((d.source_account='polivalko-native' AND d.status='posted') OR (d.source_account<>'polivalko-native'
         AND lower(d.status) IN ('active','активний','активна','posted')
         AND coalesce(lower(d.details->>'status'),'active') IN ('active','активний','активна','posted')
         AND coalesce(lower(d.details->>'type'),'in') IN ('in','2')))
    AND lower(d.currency) IN ('uah','980') AND coalesce(lower(d.details->>'currency_iso'),'uah') IN ('uah','980')
    {document_filter}
), checked AS (
  SELECT positions.*, round(sum(amount) OVER doc,2)=round(total,2)
    AND bool_and(qty IS NOT NULL AND qty>0 AND amount IS NOT NULL AND amount>=0) OVER doc
    AND (extras IS NULL OR extras IN ('[]','{{}}') OR accounting.stock_number(extras)=0) AS ok
  FROM positions WINDOW doc AS (PARTITION BY id)
)"""


PURCHASES = """
WITH needed AS (
  SELECT * FROM jsonb_to_recordset(%s::jsonb) AS n(a text,o text,s text,p text,u text,first_day date,last_day date)
), """ + checked_purchases() + """, matched AS (
  SELECT c.*,n.first_day,max(day) FILTER (WHERE day<n.first_day) OVER (PARTITION BY a,o,s,p,u) AS prior_day
  FROM checked c JOIN needed n USING(a,o,s,p,u) WHERE c.day<=n.last_day
)
SELECT a,o,s,p,u,day,stamp,id::text AS id,number,sum(qty) AS qty,
       CASE WHEN bool_and(coalesce(ok,false)) THEN sum(amount) END AS amount
FROM matched WHERE day>=first_day OR day=prior_day GROUP BY a,o,s,p,u,day,stamp,id,number
ORDER BY a,o,s,p,u,day,id
"""


def product_key(line):
    product = line.get("product")
    if isinstance(product, dict):
        for field in ("id", "code"):
            value = identifier(product.get(field))
            if value:
                return field + ":" + value
    return None


def stock_key(doc, line):
    return doc["account"], identifier(doc.get("org")), identifier(line.get("store")), product_key(line), identifier(line.get("unit"))


def timestamp(raw, day):
    """The moment of a document, to order documents of one day. The stamp is the shop's clock as written."""
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo and dt.date() == day:
            return dt
    except (ValueError, TypeError):
        pass
    return None


class PurchaseBook:
    def __init__(self, purchases):
        self.groups = defaultdict(lambda: defaultdict(list))
        for row in purchases:
            key = tuple(row[k] for k in ("a", "o", "s", "p", "u"))
            self.groups[key][row["day"]].append(row)
        self.days = {key: sorted(groups) for key, groups in self.groups.items()}

    def cost(self, doc, line, qty):
        key = stock_key(doc, line)
        days = self.days.get(key)
        if not days:
            return None, ()
        day = doc["day"]
        groups = self.groups[key]
        moment = timestamp(doc.get("stamp"), day)
        receipts = []
        if moment:
            for purchase in groups.get(day, ()):
                posted = timestamp(purchase["stamp"], day)
                if posted and posted < moment:
                    receipts.append(purchase)
        if not receipts:
            index = bisect_left(days, day) - 1
            if index < 0:
                return None, ()
            receipts = groups[days[index]]
        if any(p["amount"] is None or not p["qty"] or p["qty"] <= 0 for p in receipts):
            return None, ()
        unit_cost = sum(p["amount"] for p in receipts) / sum(p["qty"] for p in receipts)
        return qty * unit_cost, tuple((p["id"], p["number"], str(p["day"])) for p in receipts)


def original_sale(row):
    if not currency_valid(row):
        return False
    if row["entity_type"] == "receipt":
        return (identifier(row["kind"]) in KINDS["receipt"] and identifier(row["status"]) in ACTIVE | {"posted"}
                and identifier(row.get("raw_status")) not in INACTIVE)
    return kind_of(row) == "sale"


def reconcile_original(doc):
    lines = doc["lines"] or []
    parsed = [sale_line(line, False) for line in lines]
    return parsed and all(parsed) and sum(p[-1] for p in parsed) == number(doc["total"])


def before_return(parent, refund):
    if parent["day"] != refund["day"]:
        return parent["day"] < refund["day"]
    original = timestamp(parent.get("stamp"), parent["day"])
    returned = timestamp(refund.get("stamp"), refund["day"])
    return not original or not returned or original <= returned


def return_cost(parent, line, qty, book):
    key = product_key(line), identifier(line.get("unit"))
    if not all(key):
        return None, ()
    portions = []
    sources = set()
    for original in parent["lines"]:
        if (product_key(original), identifier(original.get("unit"))) != key:
            continue
        sold = number(original["quantity"])
        cost = number(original.get("cogs_total"))
        if cost is None:
            cost, refs = book.cost(parent, original, sold)
            sources.update(refs)
        if cost is None or cost < 0:
            return None, ()
        portions.append((sold, cost))
    sold = sum(q for q, _ in portions)
    if qty > sold or not sold:
        return None, ()
    if qty < sold and len({c/q for q,c in portions}) != 1:
        return None, ()
    return sum(c for _,c in portions) * qty / sold, tuple(sorted(sources))


def enrich_costs(conn, rows, start):
    sales, refunds = [], []
    for doc in rows:
        if doc["day"] < start or not doc["lines"]:
            continue
        kind = "receipt" if doc["entity_type"] == "receipt" else kind_of(doc)
        if kind in ("receipt", "sale"):
            sales.append(doc)
        elif kind == "return":
            refunds.append(doc)
    refs = {(d["account"], identifier(d.get("parent"))) for d in refunds if identifier(d.get("parent"))}
    parents = defaultdict(list)
    if refs:
        for row in conn.execute(PARENTS, (json.dumps([dict(a=a,r=r) for a,r in refs]),)):
            if original_sale(row) and reconcile_original(row):
                parents[row["account"], row["ref"]].append(row)
    valuation_docs = sales + [p for candidates in parents.values() for p in candidates]
    ranges = {}
    for doc in valuation_docs:
        for line in doc["lines"]:
            if not isinstance(line, dict) or line.get("cogs_total") is not None:
                continue
            key = stock_key(doc,line)
            if all(key):
                first, last = ranges.get(key,(doc["day"],doc["day"]))
                ranges[key] = min(first,doc["day"]), max(last,doc["day"])
    needs = [dict(a=a,o=o,s=s,p=p,u=u,first_day=str(first),last_day=str(last))
             for (a,o,s,p,u),(first,last) in ranges.items()]
    book = PurchaseBook(conn.execute(PURCHASES, (json.dumps(needs),)) if needs else [])
    for doc in sales + refunds:
        refund = doc["entity_type"] == "customerReturn" or kind_of(doc) == "return"
        parent = None
        if refund:
            parent_kind = identifier(doc.get("parent_kind"))
            candidates = [p for p in parents[doc["account"], identifier(doc.get("parent"))]
                          if before_return(p,doc) and doc.get("org") and p.get("org") == doc["org"]
                          and (not parent_kind or parent_kind == identifier(p["kind"]))]
            if len(candidates) == 1:
                parent = candidates[0]
        for line in doc["lines"]:
            if not isinstance(line,dict) or line.get("cogs_total") is not None:
                continue
            qty = number(line.get("quantity"))
            if not qty or (not refund and qty < 0):
                continue
            if refund and parent is None:
                continue
            cost, sources = return_cost(parent,line,abs(qty),book) if refund else book.cost(doc,line,qty)
            if cost is not None:
                line["derived_cost"], line["purchase_sources"] = cost, sources
