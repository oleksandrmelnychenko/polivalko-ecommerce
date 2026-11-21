"""Compare complete checkout baskets in the November–February season."""
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from .invoices import INDEPENDENT_RECEIPTS
from .product_contribution import GROSS_REPORT, parse_profit
from .register import number
from .source import production
from .weekly_offers import add_weekly_offers

SALES = """
WITH sales AS (
    SELECT d.id, d.day, d.source_account, d.details, d.total FROM accounting.documents d
""" + INDEPENDENT_RECEIPTS + """
    UNION ALL
    SELECT id, day, source_account, details, total FROM accounting.documents
    WHERE entity_type='invoice' AND kind='out' AND status IN ('active','posted')
      AND currency IN ('980','UAH') AND day >= %s AND day < %s
), lines AS (
    SELECT d.id, d.day, d.source_account, d.total, x.item, coalesce(
        nullif(x.item#>>'{product,category,title}',''), cat.name) AS category
    FROM sales d CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(d.details->'products')='array' THEN d.details->'products' ELSE '[]'::jsonb END
    ) x(item)
    LEFT JOIN catalog.products p ON d.source_account='polivalko-native' AND p.id::text=x.item#>>'{product,id}'
    LEFT JOIN catalog.categories cat ON cat.id=p.category_id
), soil_baskets AS (
    SELECT id FROM lines WHERE category='Грунти та добавки' GROUP BY id
)
SELECT l.id::text, l.day, l.source_account AS account, l.total, l.category,
       l.item#>>'{product,code}' AS code, l.item->>'total' AS amount, l.item->>'cogs_total' AS cost
FROM lines l JOIN soil_baskets b ON b.id=l.id ORDER BY l.day,l.id
"""

def season_bounds(year, today):
    start = date(year, 11, 1)
    if year < 2000 or start > today:
        raise ValueError("Невідомий сезон")
    return start, min(date(year + 1, 3, 1) - timedelta(days=1), today)


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
        costs = [number(row["cost"]) for row in lines]
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
        reference = parse_profit(raw) if raw else {}
        margins = {p["code"]: p["margin"] for p in reference.get("products", []) if p["margin"] is not None}
        bounds = (start, end + timedelta(days=1))
        weeks = summarize(conn.execute(SALES, (*bounds, *bounds)), start, end, margins, reference.get("account"))
        add_weekly_offers(conn, weeks, start, end, today)
    return dict(weeks=weeks, through=str(end), marginThrough=reference.get("through"))
