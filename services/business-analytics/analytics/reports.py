import json
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from itertools import chain
from operator import itemgetter

from .forecast import replenishment


def window(snapshot, query):
    # A link built from today's date can ask for a day the snapshot does not cover yet, for example
    # before the nightly refresh. The report then ends where the data ends and says so in "end".
    end = min(date.fromisoformat(query.get("to") or snapshot["asOf"]), date.fromisoformat(snapshot["asOf"]))
    start = date.fromisoformat(query.get("from") or str(end.replace(month=1, day=1)))
    if start > end or start.year < 1900:
        raise ValueError("Перевірте дати періоду")
    return start, end


def prev_year(day, closing=False):
    try:
        result = day.replace(year=day.year - 1)
    except ValueError:
        return day.replace(year=day.year - 1, day=28)
    # A period that ends with February compares with the whole February a year earlier, the 29th included.
    if closing and (day + timedelta(days=1)).month == 3:
        result = result.replace(month=3, day=1) - timedelta(days=1)
    return result


def matches(row, query):
    return all(not query.get(k) or query[k] == row.get(k) for k in ("org", "store", "category", "product"))


def page(rows, query):
    n = int(query.get("page", 1))
    if not 1 <= n <= 1000000:
        raise ValueError("Невірна сторінка")
    return {"rows": rows[(n - 1) * 40 : n * 40], "total": len(rows), "page": n}


def aggregate(rows):
    gross = returns = covered = cost = net_covered = Decimal(0)
    covered_lines = 0
    for row in rows:
        amount = row["amount"]
        if row["refund"]:
            returns += amount
        else:
            gross += amount
        if row["cost"] is not None:
            covered_lines += 1
            sign = -1 if row["refund"] else 1
            covered += amount
            net_covered += sign * amount
            cost += sign * row["cost"]
    return {
        "gross": gross if rows else None,
        "returns": returns if rows else None,
        "net": gross - returns if rows else None,
        "profit": net_covered - cost if covered_lines else None,
        "coverage": covered / (gross + returns) if gross + returns else None,
        "documents": len({r["doc"] for r in rows}),
    }


def group(rows, key):
    result = defaultdict(list)
    for r in rows:
        result[key(r)].append(r)
    return result


def dimension_options(snapshot, rows):
    keys = {name: set() for name in ("org", "store", "category")}
    for row in rows:
        for field, values in keys.items():
            values.add(row[field])
    options = {}
    for field, values in keys.items():
        labels = snapshot["categories" if field == "category" else "locations"]
        options[field] = sorted((dict(value=k, label=labels.get(k, k)) for k in values),
                                key=lambda item: item["label"])
    return options


def report(snapshot, q):
    start, end = window(snapshot, q)
    facts = snapshot["facts"]
    scoped = [r for r in facts if matches(r, q)]
    current_start, current_end = str(start), str(end)
    previous_start, previous_end = str(prev_year(start)), str(prev_year(end, closing=True))
    rows = [r for r in scoped if current_start <= r["day"] <= current_end]
    before = [r for r in scoped if previous_start <= r["day"] <= previous_end]
    monthly = group(rows, lambda r: r["day"][:7])
    earlier = group(before, lambda r: r["day"][:7])
    months = []
    day = start.replace(day=1)
    while day <= end:
        key, previous = str(day)[:7], str(prev_year(day))[:7]
        months.append(
            {
                "month": key,
                "current": aggregate(monthly[key]) if monthly[key] else None,
                "previous": aggregate(earlier[previous]) if earlier[previous] else None,
            }
        )
        day = (day.replace(day=28) + timedelta(days=4)).replace(day=1)
    products = []
    for (product, unit), items in group(rows, lambda r: (r["product"], r["unit"])).items():
        sold = sum(r["qty"] for r in items if not r["refund"])
        stats = aggregate(items)
        products.append(
            dict(
                id=product,
                name=items[0]["name"],
                sku=items[0]["sku"],
                unit=unit,
                sold=sold,
                returned=sum(r["qty"] for r in items if r["refund"]),
                price=stats["gross"] / sold if sold else None,
                **stats,
            )
        )
    search = q.get("search", "").casefold()
    products = [r for r in products if search in (r["name"] + " " + r["sku"]).casefold()]
    products.sort(key=lambda r: (-r["net"], r["name"], r["id"]))
    contributions = {}
    for dim in ("store", "category"):
        contributions[dim] = sorted(
            [dict(id=k, **aggregate(v)) for k, v in group(rows, itemgetter(dim)).items()],
            key=lambda r: -r["net"],
        )
    annual = defaultdict(lambda: defaultdict(Decimal))
    for r in scoped:
        year = r["day"][:4]
        if year + "-12-31" <= current_end:
            annual[r["category"], year][int(r["day"][5:7])] += -r["amount"] if r["refund"] else r["amount"]
    seasonal = defaultdict(list)
    for (category, _), values in annual.items():
        total = sum(values.values())
        if len(values) == 12 and total > 0:
            seasonal[category].append([1200 * values[m] / total for m in range(1, 13)])
    heatmap = []
    period_categories = group(rows, itemgetter("category"))
    for cat in sorted(period_categories.keys() | seasonal.keys()):
        items = period_categories[cat]
        by_month = group(items, lambda r: int(r["day"][5:7]))
        years = len(seasonal[cat])
        heatmap.append(
            {
                "category": cat,
                "years": years,
                "indices": [
                    sum(values[i] for values in seasonal[cat]) / years if years >= 2 else None
                    for i in range(12)
                ],
                # A period longer than a year repeats calendar months. Show a typical month, not their sum.
                "months": [aggregate(by_month[m])["net"] / len({r["day"][:4] for r in by_month[m]}) if by_month[m] else None
                           for m in range(1, 13)],
            }
        )
    coverage = []
    mismatches = {a["doc"] for a in snapshot["audits"] if a["invalid"] or a["difference"] not in (0, None)}
    # A year can have documents only from the first month of the history to the month of the snapshot.
    span = (min((r["day"][:7] for r in facts), default=""), snapshot["asOf"][:7])
    for (year, store), items in sorted(group(scoped, lambda r: (r["day"][:4], r["store"])).items()):
        coverage.append(
            dict(
                year=year,
                store=store,
                months=len({r["day"][:7] for r in items}),
                expected=sum(span[0] <= f"{year}-{m:02}" <= span[1] for m in range(1, 13)),
                mismatches=len(mismatches.intersection(r["doc"] for r in items)),
                **aggregate(items),
            )
        )

    return {
        "asOf": snapshot["asOf"],
        "start": str(start),
        "end": str(end),
        "summary": aggregate(rows),
        "previous": aggregate(before) if before else None,
        "months": months,
        "heatmap": heatmap,
        "products": page(products, q),
        "contributions": contributions,
        "coverage": coverage,
        "diagnostics": snapshot["diagnostics"],
        "options": {
            **dimension_options(snapshot, chain(facts, snapshot["models"])),
            "years": sorted({r["day"][:4] for r in facts}, reverse=True),
        },
    }


def documents(snapshot, q):
    start, end = window(snapshot, q)
    by_doc = group(
        (r for r in snapshot["facts"] if matches(r, q) and str(start) <= r["day"] <= str(end)),
        lambda r: r["doc"],
    )
    audits = {a["doc"]: a for a in snapshot["audits"]}
    data = []
    for doc, rows in by_doc.items():
        audit = audits.get(doc, {})
        first = rows[0]
        data.append(
            {
                "id": doc,
                "day": first["day"],
                "number": first["number"],
                "origin": first["origin"],
                "selected": aggregate(rows)["net"],
                "recorded": audit.get("recorded"),
                "difference": audit.get("difference"),
                "invalid": audit.get("invalid", 0),
            }
        )
    data.sort(key=lambda r: (r["day"], r["id"]), reverse=True)
    return page(data, q)


def policy_key(row):
    return json.dumps([row[k] for k in ("org", "store", "product", "unit")], ensure_ascii=False)


def forecasts(snapshot, q, policies, today):
    start = date.fromisoformat(snapshot["asOf"]) + timedelta(days=1)
    stocks = {(s["org"], s["store"], s["product"]): s for s in snapshot["stocks"]}
    units = defaultdict(set)
    for model in snapshot["models"]:
        if model["kind"] == "sku":
            units[model["org"], model["store"], model["product"]].add(model["unit"])
    rows = []
    for m in snapshot["models"]:
        if (
            not matches(m, q)
            or m["kind"] != q.get("kind", "sku")
            or q.get("search", "").casefold() not in m["name"].casefold()
        ):
            continue
        row = {k: v for k, v in m.items() if k != "signature"}
        if row["kind"] == "sku":
            key = (row["org"], row["store"], row["product"])
            policy = policies.get(policy_key(row))
            row.update(policy=policy, purchase=replenishment(row, stocks.get(key), policy, start, today))
            if len(units[key]) > 1:
                row["purchase"].update(
                    order=None,
                    stockout=None,
                    reason="Звірте одиниці виміру цього товару зі складським залишком",
                )
        rows.append(row)
    if q.get("kind", "sku") == "sku":
        rows.sort(key=lambda r: (r["purchase"]["order"] is None, -(r["purchase"]["order"] or 0),
                                 not r["weeks"], r["name"]))
    else:
        rows.sort(key=lambda r: (not r["weeks"], r["name"]))
    coverage = dict(ready=sum(bool(r["weeks"]) for r in rows),
                    regression=sum(r["model"] in ("ridge", "ridgeRecent") for r in rows),
                    intermittent=sum(r["model"] == "intermittent" for r in rows))
    return dict(asOf=snapshot["asOf"], start=str(start), version=snapshot["version"], coverage=coverage,
                options=dimension_options(snapshot, snapshot["models"]), **page(rows, q))
