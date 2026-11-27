"""Compare complete checkout baskets in the November–February season."""
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from .invoices import BODY_ACTIVE, BODY_IN_HRYVNIA, INDEPENDENT_RECEIPTS
from .product_contribution import GROSS_REPORT, parse_profit
from .purchase_cost import ORG, STORE, UNIT, direct_cost, enrich_costs
from .register import number
from .source import production
from .weekly_offers import add_weekly_offers

SALES = f"""
WITH sales AS (
    SELECT d.id, d.day, d.source_account, d.details, d.total, {ORG} AS org, d.native_store_id
    FROM accounting.documents d
""" + INDEPENDENT_RECEIPTS + f"""
    UNION ALL
    SELECT d.id, d.day, d.source_account, d.details, d.total, {ORG} AS org, d.native_store_id
    FROM accounting.documents d
    WHERE d.entity_type='invoice' AND lower(d.kind) IN ('out','3','sale','salesinvoice','outgoinginvoice')
      AND lower(d.status) IN ('active','активна','активний','posted')
      AND lower(d.currency) IN ('980','uah') AND {BODY_ACTIVE} AND {BODY_IN_HRYVNIA}
      AND coalesce(lower(d.details->>'type'),'out') IN ('out','3','sale','salesinvoice','outgoinginvoice')
      AND d.day >= %s AND d.day < %s
), lines AS (
    SELECT d.id, d.day, d.source_account, d.total, d.org, d.details->>'date' AS stamp,
           {STORE} AS store, {UNIT} AS unit, l AS item,
           coalesce(nullif(l#>>'{{product,category,title}}',''), cat.name) AS category
    FROM sales d CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(d.details->'products')='array' THEN d.details->'products' ELSE '[]'::jsonb END
    ) l
    LEFT JOIN LATERAL (
        SELECT c.name
        FROM catalog.products p JOIN catalog.categories c ON c.id=p.category_id
        WHERE (d.source_account='polivalko-native' AND lower(p.id::text)=lower(l#>>'{{product,id}}'))
           OR (d.source_account='valko-dntrade' AND (
                 lower(p.navkolo_id)=lower(l#>>'{{product,id}}')
                 OR (nullif(l#>>'{{product,code}}','') IS NOT NULL
                     AND lower(p.navkolo_id)='dntrade-code:'||lower(l#>>'{{product,code}}'))))
        ORDER BY p.id LIMIT 1
    ) cat ON true
), soil_baskets AS (
    SELECT id FROM lines WHERE category='Грунти та добавки' GROUP BY id
)
SELECT l.id::text, l.day, l.source_account AS account, l.total, l.category,
       l.org, l.stamp, l.store, l.unit,
       l.item#>>'{{product,id}}' AS product_id, l.item#>>'{{product,code}}' AS code,
       l.item->>'quantity' AS quantity, l.item->>'total' AS amount, l.item->>'cogs_total' AS cost
FROM lines l JOIN soil_baskets b ON b.id=l.id ORDER BY l.day,l.id
"""

def season_bounds(year, today):
    start = date(year, 11, 1)
    if year < 2000 or start > today:
        raise ValueError("Невідомий сезон")
    return start, min(date(year + 1, 3, 1) - timedelta(days=1), today)


def enrich_native_costs(conn, rows, start):
    by_doc = defaultdict(list)
    for row in rows:
        if row["account"] == "polivalko-native" and direct_cost({"cogs_total": row.get("cost")}) is None:
            by_doc[row["id"]].append(row)
    if not by_doc:
        return
    docs = []
    pairs = []
    for doc_rows in by_doc.values():
        first = doc_rows[0]
        lines = []
        for row in doc_rows:
            line = {
                "quantity": row.get("quantity"),
                "total": row.get("amount"),
                "cogs_total": row.get("cost"),
                "store": row.get("store"),
                "unit": row.get("unit") or "catalog-base",
                "product": {"id": row.get("product_id"), "code": row.get("code")},
            }
            lines.append(line)
            pairs.append((row, line))
        docs.append({
            "id": first["id"],
            "account": "polivalko-native",
            "entity_type": "invoice",
            "kind": "out",
            "status": "posted",
            "day": first["day"],
            "org": first.get("org"),
            "stamp": first.get("stamp"),
            "lines": lines,
        })
    enrich_costs(conn, docs, start)
    for row, line in pairs:
        if line.get("derived_cost") is not None:
            row["cost"] = line["derived_cost"]


def summarize(rows, start, end, margins, margin_account):
    baskets = defaultdict(list)
    for row in rows:
        baskets[row["id"]].append(row)

    def empty():
        return dict(count=0, sales=0, known=0, profit=0, estimated=0, estimatedProfit=0)

    weeks = {}
    day = start
    while day <= end:
        last = min(day + timedelta(days=6-day.weekday()), end)
        weeks[day - timedelta(days=day.weekday())] = dict(start=str(day), end=str(last), kit=empty(), soil=empty())
        day = last + timedelta(days=1)
    for lines in baskets.values():
        first = lines[0]
        total = number(first["total"])
        if total is None or total < 0:
            continue
        kit = any(row["category"] in ("Горщики", "Насіння") for row in lines)
        group = weeks[first["day"] - timedelta(days=first["day"].weekday())]["kit" if kit else "soil"]
        group["count"] += 1
        group["sales"] += total
        amounts = [number(row["amount"]) for row in lines]
        if None in amounts or min(amounts) < 0 or sum(amounts) != total:
            continue
        raw_costs = [number(row["cost"]) for row in lines]
        costs = [c if c is not None and (c > 0 or (c == 0 and amt == 0)) else None for c, amt in zip(raw_costs, amounts)]
        if None not in costs and min(costs) >= 0:
            profit = total - sum(costs)
            group["known"] += 1
            group["profit"] += profit
        else:
            gains = [amount-cost if cost is not None and cost >= 0 else
                     amount*margins[row["code"]] if row["account"] == margin_account and row["code"] in margins else None
                     for row, amount, cost in zip(lines, amounts, costs)]
            if None in gains:
                continue
            profit = sum(gains)
        group["estimated"] += 1
        group["estimatedProfit"] += profit
    for week in weeks.values():
        for group in (week["kit"], week["soil"]):
            for numerator, denominator, key in (("sales","count","ticket"), ("profit","known","actual"),
                                                 ("estimatedProfit","estimated","estimate")):
                total = group.pop(numerator)
                group[key] = round(Decimal(total) / group[denominator], 2) if group[denominator] else None
    return list(reversed(weeks.values()))


def winter(year, today):
    start, end = season_bounds(year, today)
    with production() as conn:
        raw = conn.execute(GROSS_REPORT, (today, str(today))).fetchone()
        try:
            reference = parse_profit(raw) if raw else {}
        except (ValueError, KeyError, TypeError):
            # The report only feeds the profit estimate. One that fails its control totals leaves
            # the estimate empty; it must not replace the whole season with an error.
            reference = {}
        margins = {p["code"]: p["margin"] for p in reference.get("products", []) if p["margin"] is not None}
        bounds = (start, end + timedelta(days=1))
        rows = list(conn.execute(SALES, (*bounds, *bounds)))
        enrich_native_costs(conn, rows, start)
        weeks = summarize(rows, start, end, margins, reference.get("account"))
        add_weekly_offers(conn, weeks, start, end, today)
    return dict(weeks=weeks, through=str(end), marginThrough=reference.get("through"))
