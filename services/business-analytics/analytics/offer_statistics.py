"""Rank available products from repeat purchases and the shop's seasonal basket mix."""
from collections import Counter
from datetime import timedelta


# A receipt attached to a posted sales invoice describes the same sale.
SALES = """
    d.status IN ('active','posted') AND d.currency IN ('980','UAH')
    AND ((d.entity_type='invoice' AND d.kind='out') OR
        (d.entity_type='receipt' AND d.kind='cash' AND NOT EXISTS (
            SELECT 1 FROM accounting.documents i WHERE i.source_account=d.source_account
              AND lower(i.source_id)=lower(d.parent_ref) AND i.entity_type='invoice'
              AND i.kind='out' AND i.status IN ('active','posted'))))
"""
HISTORY = """
WITH documents AS (
    SELECT d.id,d.source_account,d.details,d.day,true AS personal
    FROM accounting.document_register r JOIN accounting.documents d ON d.id=r.id
    WHERE r.partner_id=%s::uuid AND d.day BETWEEN %s AND %s AND """ + SALES + """
    UNION ALL
    SELECT d.id,d.source_account,d.details,d.day,false AS personal
    FROM accounting.documents d WHERE ((d.day >= %s AND d.day < %s) OR (d.day >= %s AND d.day < %s))
      AND """ + SALES + """
), baskets AS (
    SELECT DISTINCT d.id,d.day,d.personal,
        CASE WHEN d.source_account='polivalko-native' THEN item#>>'{product,id}'
             WHEN d.source_account='valko-dntrade' THEN 'dntrade-code:'||(item#>>'{product,code}') END AS ref
    FROM documents d CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(d.details->'products')='array' THEN d.details->'products' ELSE '[]'::jsonb END
    ) AS item
)
SELECT ref,count(*) FILTER (WHERE personal)::int AS purchases,max(day) FILTER (WHERE personal) AS last_day,
       sum(power(0.5::float8,(%s::date-day)/180.0)) FILTER (WHERE personal) AS weight,
       count(*) FILTER (WHERE NOT personal)::int AS seasonal
FROM baskets WHERE ref IS NOT NULL GROUP BY ref
"""
CATALOG = """
SELECT p.id::text,p.navkolo_id,p.name,p.sku,c.name AS category,price.amount AS price,
       s.quantity-s.reserved_quantity AS available
FROM catalog.products p JOIN catalog.product_prices price ON price.product_id=p.id
JOIN catalog.product_stock s ON s.product_id=p.id JOIN catalog.categories c ON c.id=p.category_id
WHERE NOT p.is_archived AND price.amount>0 AND s.quantity-s.reserved_quantity>0
  AND (NOT %s OR c.name IN ('Hunter','Irritec','Капельний полив','Труби/Фумка/Крани','Шланги'))
"""


def season_window(today, years_ago):
    first = today.replace(year=today.year-years_ago, month=today.month, day=1)
    return first, (first + timedelta(days=32)).replace(day=1)


def recommendations(conn, partner, focus, today):
    history = conn.execute(HISTORY, (partner, today-timedelta(days=730), today,
                           *season_window(today, 1), *season_window(today, 2), today))
    catalog = conn.execute(CATALOG, (focus == "irrigation",))
    return rank(catalog, {row["ref"]: row for row in history}, today)


def rank(catalog, history, today):
    items = []
    categories = Counter()
    for product in catalog:
        refs = {product["id"], product["navkolo_id"]}
        rows = [history[ref] for ref in refs if ref in history]
        purchases = sum(row["purchases"] for row in rows)
        weight = sum(float(row["weight"] or 0) for row in rows)
        categories[product["category"]] += weight
        seasonal = sum(row["seasonal"] for row in rows)
        last = max((row["last_day"] for row in rows if row["last_day"]), default=None)
        item = {key: value for key, value in product.items() if key != "navkolo_id"}
        item.update(purchases=purchases, seasonal=seasonal)
        reasons = []
        if last:
            reasons.append(f"Документів продажу клієнту за два роки — {purchases}. Остання покупка {last:%d.%m.%Y}.")
        if seasonal:
            reasons.append(f"Документів магазину з цим товаром за {today:%m}.{today.year-2} і {today:%m}.{today.year-1} — {seasonal}.")
        item["reason"] = " ".join(reasons)
        items.append((item, weight))
    # Smooth the time-decayed personal counts with three equivalent observations
    # distributed by seasonal frequency, favouring categories the buyer has used.
    personal_total = sum(categories.values())
    def prior(item):
        affinity = categories[item["category"]] / personal_total if personal_total else 0
        return item["seasonal"] * (1 + affinity)
    prior_total = sum(prior(item) for item, _ in items)
    scored = []
    for item, weight in items:
        item["related"] = categories[item["category"]] > 0
        score = weight + (3 * prior(item) / prior_total if prior_total else 0)
        if score:
            scored.append((score, item))
    if scored:
        scored.sort(key=lambda entry: (-entry[0], entry[1]["name"], entry[1]["id"]))
        return "statistics", [item for _, item in scored[:3]]
    fallback = sorted((item for item, _ in items), key=lambda item: (item["name"], item["id"]))[:3]
    for item in fallback:
        item["reason"] = "Доступна позиція каталогу. Даних для статистичної рекомендації бракує."
    return "catalog", fallback
