"""Product turnover shares and reconciled DNTrade gross-profit reports."""
from datetime import date
from decimal import Decimal
from itertools import groupby
from threading import Lock
from time import monotonic

from .register import number
from .source import production


def turnover_ranking(products, period_net):
    rows = sorted(products, key=lambda p: (-p["net"], p["name"], p["sku"], p["account"], p["code"] or ""))
    positive = sum(p["net"] for p in rows if p["net"] > 0)
    cumulative = Decimal(0)
    for net, tied in groupby(rows, key=lambda p: p["net"]):
        band = None
        if net > 0:
            band = "A" if cumulative < positive * Decimal(".80") else "B" if cumulative < positive * Decimal(".95") else "C"
        for p in tied:
            p["share"] = net / period_net if period_net > 0 else None
            p["abc"] = band
            p["margin"] = p["profit"] / net if p["profit"] is not None and net > 0 else None
            cumulative += max(net, 0)
    return rows


# Keep table order and strip cell styling before transferring the source report.
GROSS_REPORT = """
WITH report AS (
  SELECT source_account, payload::jsonb->'raw' AS raw
  FROM integration.dntrade_archive_records
  WHERE entity_type='financialReport' AND source_day<=%s AND payload::jsonb#>>'{raw,sourceView}'='/reports/grossprofit'
    AND payload::jsonb#>>'{raw,scope,warehouses}'='Без фільтра складу'
    AND payload::jsonb#>>'{raw,scope,organizations}'='Без фільтра організації'
    AND payload::jsonb#>>'{raw,period,to}'<=%s
  ORDER BY payload::jsonb#>>'{raw,period,to}' DESC, source_day DESC, id DESC LIMIT 1
)
SELECT source_account AS account, raw->'period' AS period,
  (SELECT jsonb_agg(jsonb_build_array(r->>'section',jsonb_path_query_array(r,'$.cells[*].value')) ORDER BY n)
   FROM jsonb_array_elements(raw#>'{tables,0}') WITH ORDINALITY t(r,n)) AS rows
FROM report
"""
HEADERS = ["Код", "Назва", "Од.вим.", "Кількість", "Закупка", "Продаж", "Прибуток", "% націнки"]


def source_money(value):
    text = "".join(str(value).removesuffix("грн.").split()).replace(",", ".").replace("−", "-")
    result = number(text)
    if result is None:
        raise ValueError("Invalid gross profit report amount")
    return result


def parse_profit(report):
    period = report["period"]
    rows = report["rows"]
    start, end = date.fromisoformat(period["from"]), date.fromisoformat(period["to"])
    if start > end or not rows or rows[0] != ["THEAD", HEADERS] or rows[-1][0] != "TFOOT":
        raise ValueError("Invalid gross profit report layout")
    totals = rows[-1][1]
    if len(totals) != 6 or totals[0].strip().rstrip(":") != "Всього":
        raise ValueError("Missing gross profit control totals")
    cost, sales, profit = map(source_money, totals[2:5])
    products = []
    codes = set()
    for section, cells in rows[1:-1]:
        if section != "TBODY" or len(cells) != len(HEADERS):
            raise ValueError("Unexpected gross profit report row")
        code, name = str(cells[0] or "").strip(), str(cells[1] or "").strip()
        if not code or not name or code in codes:
            raise ValueError("Missing or duplicated product code")
        codes.add(code)
        purchase, revenue, earned = map(source_money, cells[4:7])
        products.append(dict(code=code, name=name, cost=purchase, net=revenue, profit=earned,
                             share=revenue/sales if sales > 0 else None, margin=earned/revenue if revenue > 0 else None))
    if any(sum(p[k] for p in products) != control for k, control in (("cost", cost), ("net", sales), ("profit", profit))):
        raise ValueError("Product totals differ from the gross profit report")
    return dict(start=str(start), through=str(end), account=report["account"], net=sales, profit=profit,
                lossCount=sum(p["profit"] < 0 for p in products), products=products)


_lock = Lock()
_cached = None


def clear_cache():
    global _cached
    with _lock:
        _cached = None


def profit_page(today, page, sort, search, account="", code=""):
    global _cached
    with _lock:
        if _cached is None or _cached[0] != today or _cached[1] <= monotonic():
            with production() as conn:
                raw = conn.execute(GROSS_REPORT, (today, str(today))).fetchone()
            _cached = today, monotonic() + 600, parse_profit(raw) if raw else None
        report = _cached[2]
    if not report:
        return {"available": False}
    products = report["products"]
    term = search.strip().casefold()
    matches = [p for p in products if (not code or (account == report["account"] and code.casefold() == p["code"].casefold()))
               and (term in p["name"].casefold() or term in p["code"].casefold())]
    field = {"profit": "profit", "lowest": "profit", "margin": "margin", "sales": "net"}[sort]
    direction = 1 if sort == "lowest" else -1
    matches.sort(key=lambda p: (p[field] is None, direction * (p[field] or 0), p["code"]))
    return dict(available=True, **{k: v for k,v in report.items() if k != "products"},
                total=len(products), matches=len(matches), page=page, rows=matches[(page-1)*25:page*25])
