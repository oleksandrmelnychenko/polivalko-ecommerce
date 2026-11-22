"""Compare net unit sales around the same trading weeks in previous years."""
from collections import defaultdict
from datetime import timedelta
from decimal import Decimal
from statistics import median

from .invoices import INDEPENDENT_RECEIPTS, currency_valid
from .purchase_cost import UNIT
from .register import identifier, kind_of
from .supplier_orders import unit_label


_HEAD = """SELECT d.id,d.day,d.source_account AS account,d.entity_type,d.kind,d.status,d.currency,d.total,
    d.details->>'type' AS raw_kind,d.details->>'status' AS raw_status,d.details->>'currency_iso' AS raw_currency,
    d.details->'products' AS lines FROM accounting.documents d """
_DOCS = _HEAD + """WHERE d.entity_type IN ('invoice','customerReturn') AND d.kind NOT IN ('in','order')
    AND d.day >= %s AND d.day < %s UNION ALL """ + _HEAD + INDEPENDENT_RECEIPTS
_HISTORY = f"""
WITH docs AS ({_DOCS}), positions AS (
    SELECT d.id,d.day,d.account,d.entity_type,d.kind,d.status,d.currency,d.total,d.raw_kind,d.raw_status,d.raw_currency,
        lower(l#>>'{{product,id}}') AS ref,lower(l#>>'{{product,code}}') AS code,
        {UNIT.replace('d.source_account','d.account')} AS unit,accounting.stock_number(l->>'quantity') AS qty,
        accounting.stock_number(l->>'total') AS amount
    FROM docs d CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(d.lines)='array' THEN d.lines ELSE '[]'::jsonb END) l
), checked AS (
    SELECT *, sum(abs(amount)) OVER doc = abs(total) AND
      bool_and(qty IS NOT NULL AND qty<>0 AND amount IS NOT NULL
        AND (nullif(ref,'') IS NOT NULL OR nullif(code,'') IS NOT NULL)) OVER doc AS valid,
        bool_and(qty > 0 AND amount >= 0) OVER doc AS sale_signs
    FROM positions WINDOW doc AS (PARTITION BY id)
)
SELECT day,account,entity_type,kind,status,currency,raw_kind,raw_status,raw_currency,ref,code,unit,sale_signs,
    sum(abs(qty)) AS qty FROM checked WHERE valid
GROUP BY day,account,entity_type,kind,status,currency,raw_kind,raw_status,raw_currency,ref,code,unit,sale_signs
"""


def history(conn, through, days, cover):
    for years_ago in (1, 2, 3):
        pivot = through - timedelta(weeks=52 * years_ago)
        bounds = pivot - timedelta(days=days - 1), pivot + timedelta(days=cover + 1)
        for row in conn.execute(_HISTORY, bounds * 2):
            # A position's code is the product code; kind_of reads that name as the document type code.
            kind = "receipt" if row["entity_type"] == "receipt" else kind_of({**row, "code": None})
            if (kind not in ("sale", "receipt", "return") or not currency_valid(row)
                    or (kind != "return" and not row["sale_signs"])):
                continue
            yield years_ago, (row["day"] - pivot).days, row, -row["qty"] if kind == "return" else row["qty"]


def profiles(rows, catalog, external_ids, days, cover):
    # Use only seasons with observed trade on both sides of the boundary. A missing
    # archive or a few isolated sales must not look like a seasonal collapse.
    coverage = defaultdict(set)
    category_products = defaultdict(set)
    samples = defaultdict(lambda: defaultdict(lambda: [Decimal(0), Decimal(0), set()]))
    for year, offset, row, quantity in rows:
        side = int(offset > 0)
        if quantity > 0:
            coverage[year, side].add(offset)
        if row["account"] == "polivalko-native":
            product = catalog.get(row["ref"])
        elif row["account"] == "valko-dntrade":
            code, ref = identifier(row["code"]), identifier(row["ref"])
            ids = external_ids.get("dntrade-code:" + code, set()) | external_ids.get(ref, set())
            product = catalog[next(iter(ids))] if len(ids) == 1 else None
        else:
            continue
        if not product:
            continue
        unit = unit_label(product["unit"])
        if not unit or (row["unit"] != "catalog-base" and unit_label(row["unit"]) != unit):
            continue
        keys = [("product", product["id"], unit)]
        if product.get("category"):
            keys.append(("category", product["category"], unit))
            if quantity > 0:
                category_products[keys[-1], year, side].add(product["id"])
        for key in keys:
            sample = samples[key][year]
            sample[side] += quantity
            if quantity > 0:
                sample[2].add(offset)
    result = {}
    for key, seasons in samples.items():
        ratios = []
        upcoming = []
        for year, (before, after, dates) in seasons.items():
            if (len(coverage[year, 0]) * 3 < days * 2 or len(coverage[year, 1]) * 3 < cover * 2
                    or after < 0 or len(dates) < 4):
                continue
            if after > 0 and sum(offset > 0 for offset in dates) >= 3:
                upcoming.append(after / cover)
            # No observed SKU sales can also mean it was unavailable that year.
            if key[0] == "category":
                # Measure a typical comparable SKU. A single exceptional bulk sale
                # must not become the demand pattern of every product in its category.
                comparable = category_products[key, year, 0] & category_products[key, year, 1]
                item_ratios = []
                for sku in comparable:
                    prior, future, observed = samples["product", sku, key[2]][year]
                    if prior > 0 and future > 0 and len(observed) >= 4:
                        item_ratios.append(future * days / (prior * cover))
                if len(item_ratios) >= 3:
                    ratios.append(median(item_ratios))
            elif before > 0 and after > 0:
                ratios.append(after * days / (before * cover))
        # Require the direction to repeat. With just two concordant comparisons
        # use the smaller effect; one exceptional season cannot drive a large order.
        rising = [r for r in ratios if r >= 1]
        falling = [r for r in ratios if r < 1]
        repeated = rising if len(rising) >= 2 else falling
        if len(repeated) >= 2:
            representative = median(repeated) if len(repeated) >= 3 else min(repeated, key=lambda r: abs(r - 1))
            weight = Decimal("0.75") if key[0] == "product" else Decimal("0.5")
            ratio = 1 + weight * (representative - 1)
            low, high = (Decimal(".25"), Decimal(4)) if key[0] == "product" else (Decimal("0.67"), Decimal("1.5"))
            result[key] = {"source": key[0], "years": len(repeated),
                           "factor": max(low, min(high, ratio)).quantize(Decimal(".0001"))}
        if key[0] == "product" and len(upcoming) >= 2:
            result["upcoming", key[1], key[2]] = {"years": len(upcoming), "rate": median(upcoming)}
    return result
