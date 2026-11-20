from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, localcontext
from uuid import UUID

from .demand import ANNUAL_FORECAST_HISTORY_DAYS, FORECAST_HISTORY_DAYS, ZERO, covers, forecast, round_one, seasonality
from .insights import build_insights

PAGE_SIZE = 20


@dataclass(frozen=True, slots=True)
class Sale:
    day: date
    product_key: str
    catalog_id: str | None
    name: str
    sku: str
    sold: Decimal
    returned: Decimal
    gross: Decimal
    refunds: Decimal

    @classmethod
    def read(cls, row: dict) -> "Sale":
        return cls(
            date.fromisoformat(row["day"]), row["productKey"], row["catalogProductId"], row["name"], row["sku"],
            Decimal(row["soldUnits"]), Decimal(row["returnedUnits"]), Decimal(row["grossRevenue"]), Decimal(row["returnValue"]),
        )

    @property
    def net(self) -> Decimal:
        return self.gross - self.refunds


def build_report(payload: dict) -> dict:
    # Keep cent-level arithmetic exact even when a long history combines many high-value lines.
    with localcontext() as context:
        context.prec = 40
        return _build_report(payload)


def _build_report(payload: dict) -> dict:
    source = payload["source"]
    start = date.fromisoformat(payload["from"])
    end = date.fromisoformat(payload["to"])
    previous_start = date.fromisoformat(payload["previousFrom"])
    previous_end = start - timedelta(days=1)
    product = payload["product"]
    sales = payload["sales"]
    ignored = sales["ignoredDocuments"]
    returns_available = sales["returnsAvailable"]
    first = optional_date(sales["firstSourceDay"])
    last = optional_date(sales["lastSourceDay"])
    website = source == "web"
    through = end if website and first is not None else last

    reliable_demand = website or ignored == 0
    comparable = reliable_demand and covers(first, through, start, end) and covers(first, through, previous_start, previous_end)
    recent_start = end - timedelta(days=27)
    stock_coverage = website and payload["currentEnd"] and covers(first, through, recent_start, end)
    catalog = {item["id"]: item for item in payload["catalog"]}
    rows = [row for row in map(Sale.read, sales["rows"]) if row.day <= end]
    products = rank_products(rows, catalog, start, previous_start, recent_start, comparable, stock_coverage, product)
    selected = next((row for row in products if row["productKey"] == product), None)
    scope = rows if selected is None else [row for row in rows if row.product_key == selected["productKey"]]
    current = [row for row in scope if row.day >= start]
    previous = [row for row in scope if previous_start <= row.day < start]

    metrics = {
        "soldUnits": sum((row.sold for row in current), ZERO),
        "returnedUnits": sum((row.returned for row in current), ZERO),
        "grossRevenue": sum((row.gross for row in current), ZERO),
        "returnValue": sum((row.refunds for row in current), ZERO),
        "netRevenue": sum((row.net for row in current), ZERO),
        "activeProducts": len({row.product_key for row in current if row.sold > 0}),
        "previousSoldUnits": sum((row.sold for row in previous), ZERO) if comparable else None,
        "previousNetRevenue": sum((row.net for row in previous), ZERO) if comparable else None,
    }

    demand: dict[date, Decimal] = defaultdict(Decimal)
    for row in scope:
        demand[row.day] += row.sold

    seasonal_cycle = None
    if reliable_demand and first is not None and through is not None:
        seasonal_cycle = seasonality(demand, first, min(through, end))
    projections = None
    if reliable_demand and covers(first, through, end - timedelta(days=FORECAST_HISTORY_DAYS - 1), end):
        has_annual_history = covers(first, through, end - timedelta(days=ANNUAL_FORECAST_HISTORY_DAYS - 1), end)
        projections = forecast(demand, end, has_annual_history)

    insights = build_insights(
        metrics, products if selected is None else [selected], demand,
        to=end, first=first, through=through, forecast=projections, stock_coverage=stock_coverage,
        reliable_demand=reliable_demand, website=website, ignored_documents=ignored, returns_available=returns_available,
    )

    inventory = payload["inventory"]
    return {
        "source": source,
        "from": start.isoformat(),
        "to": end.isoformat(),
        "previousFrom": previous_start.isoformat(),
        "previousTo": previous_end.isoformat(),
        "coverage": {
            "firstSourceDay": sales["firstSourceDay"],
            "lastSourceDay": sales["lastSourceDay"],
            "ignoredDocuments": ignored,
            "unmatchedLines": sales["unmatchedLines"],
            "returnsAvailable": returns_available,
        },
        "inventory": {
            "healthyProducts": inventory["healthyProducts"],
            "lowStockProducts": inventory["lowStockProducts"],
            "outOfStockProducts": inventory["outOfStockProducts"],
            "lowStockThreshold": Decimal(inventory["lowStockThreshold"]),
        },
        "metrics": metrics,
        "trend": trend(current, start, end, first, through),
        "seasonality": seasonal_cycle,
        "forecast": projections,
        "products": product_page(products, previous_start, product, payload["search"], payload["page"]),
        "selectedProduct": selected,
        "insights": insights,
    }


def rank_products(
    rows: list[Sale], catalog: dict, start: date, previous_start: date, recent_start: date,
    comparable: bool, stock_coverage: bool, selected: str | None,
) -> list[dict]:
    by_product: dict[str, list[Sale]] = defaultdict(list)
    for row in rows:
        by_product[row.product_key].append(row)

    products = []
    for key, group in by_product.items():
        latest = max(group, key=lambda row: row.day)
        if key != selected and latest.day < previous_start:
            continue

        catalog_item = catalog.get(latest.catalog_id)
        current = [row for row in group if row.day >= start]
        positive = [row for row in group if row.sold > 0]
        last_sale = max((row.day for row in positive), default=None)
        stock = Decimal(catalog_item["stock"]) if catalog_item is not None else None
        stock_days = None
        if stock_coverage and stock is not None:
            recent = [row for row in positive if row.day >= recent_start]
            if len({row.day for row in recent}) >= 3:
                stock_days = round_one(stock * 28 / sum((row.sold for row in recent), ZERO))

        products.append({
            "productKey": key,
            "catalogProductId": catalog_item["id"] if catalog_item is not None else None,
            "name": catalog_item["name"] if catalog_item is not None else latest.name,
            "sku": catalog_item["sku"] if catalog_item is not None else latest.sku,
            "soldUnits": sum((row.sold for row in current), ZERO),
            "returnedUnits": sum((row.returned for row in current), ZERO),
            "netRevenue": sum((row.net for row in current), ZERO),
            "previousSoldUnits": sum((row.sold for row in group if previous_start <= row.day < start), ZERO) if comparable else None,
            "stock": stock,
            "stockDays": stock_days,
            "abcClass": None,
            "lastSaleDay": last_sale.isoformat() if last_sale is not None else None,
        })

    products.sort(key=lambda row: (-row["netRevenue"], -row["soldUnits"], row["sku"].lower(), row["productKey"]))
    selected_item = catalog.get(canonical_id(selected))
    if selected_item is not None and all(row["productKey"] != selected for row in products):
        products.append({
            "productKey": selected_item["id"], "catalogProductId": selected_item["id"],
            "name": selected_item["name"], "sku": selected_item["sku"], "soldUnits": ZERO, "returnedUnits": ZERO,
            "netRevenue": ZERO, "previousSoldUnits": ZERO if comparable else None, "stock": Decimal(selected_item["stock"]),
            "stockDays": None, "abcClass": None, "lastSaleDay": None,
        })

    positive_revenue = sum((row["netRevenue"] for row in products if row["netRevenue"] > 0), ZERO)
    cumulative = ZERO
    for row in products:
        if row["netRevenue"] <= 0:
            break
        share = cumulative / positive_revenue
        row["abcClass"] = "A" if share < Decimal("0.80") else "B" if share < Decimal("0.95") else "C"
        cumulative += row["netRevenue"]
    return products


def trend(rows: list[Sale], start: date, end: date, first: date | None, through: date | None) -> list[dict]:
    if first is None or through is None or first > end or through < start:
        return []

    length = (end - start).days + 1
    step = 1 if length <= 30 else 7 if length <= 180 else 14
    buckets: dict[int, list[Sale]] = defaultdict(list)
    for row in rows:
        buckets[(row.day - start).days // step].append(row)

    result = []
    for offset in range(0, length, step):
        visible_from = max(start + timedelta(days=offset), first)
        visible_to = min(start + timedelta(days=min(length, offset + step) - 1), through)
        if visible_from > visible_to:
            continue
        bucket = buckets[offset // step]
        result.append({
            "from": visible_from.isoformat(), "to": visible_to.isoformat(),
            "soldUnits": sum((row.sold for row in bucket), ZERO),
            "returnedUnits": sum((row.returned for row in bucket), ZERO),
            "netRevenue": sum((row.net for row in bucket), ZERO),
        })
    return result


def product_page(rows: list[dict], previous_start: date, product: str | None, search: str | None, page: int) -> dict:
    search = search.lower() if search is not None else None
    previous_floor = previous_start.isoformat()
    filtered = [row for row in rows
        if (row["soldUnits"] > 0 or row["returnedUnits"] > 0 or (row["previousSoldUnits"] or ZERO) > 0
            or (row["lastSaleDay"] is not None and row["lastSaleDay"] >= previous_floor) or row["productKey"] == product)
        and (search is None or search in row["sku"].lower() or search in row["name"].lower())]
    page = min(page, max(1, (len(filtered) + PAGE_SIZE - 1) // PAGE_SIZE))
    offset = (page - 1) * PAGE_SIZE
    return {"items": filtered[offset:offset + PAGE_SIZE], "page": page, "pageSize": PAGE_SIZE, "total": len(filtered)}


def optional_date(value: str | None) -> date | None:
    return date.fromisoformat(value) if value is not None else None


def canonical_id(value: str | None) -> str | None:
    if value is None or len(value) != 36:
        return None
    try:
        canonical = str(UUID(value))
    except ValueError:
        return None
    return canonical if canonical == value.lower() else None
