from collections import Counter, defaultdict
from decimal import Decimal, InvalidOperation
from itertools import groupby
from zoneinfo import ZoneInfo

UNKNOWN = "unknown"
KYIV = ZoneInfo("Europe/Kyiv")
ACTIVE = {"active", "активний", "активна"}
INACTIVE = {
    "inactive",
    "deactivated",
    "deleted",
    "draft",
    "cancelled",
    "canceled",
    "видалений",
    "видалена",
    "деактивований",
    "деактивована",
    "чернетка",
}
KINDS = {
    "sale": {"3", "out", "sale", "salesinvoice", "outgoinginvoice", "видаткованакладна"},
    "receipt": {"6", "cash", "receipt", "salereceipt", "salebyreceipt", "продажпочеку", "продажапочеку"},
    "return": {"7", "back", "return", "customerreturn", "поверненнятовару"},
}
UNIT_LABELS = {
    "2009": "шт",
    "796": "шт",
    "2454": "шт",
    "0301": "кг",
    "301": "кг",
    "0304": "г",
    "304": "г",
    "0305": "мг",
    "305": "мг",
    "0306": "т",
    "306": "т",
    "0138": "л",
    "138": "л",
    "0166": "л",
    "166": "л",
    "112": "л",
    "0168": "мл",
    "168": "мл",
    "0003": "мм",
    "003": "мм",
    "0004": "см",
    "004": "см",
    "0006": "м",
    "006": "м",
    "0008": "км",
    "008": "км",
    "0055": "м²",
    "055": "м²",
    "55": "м²",
    "0113": "м³",
    "113": "м³",
    "2006": "уп",
    "2007": "компл",
    "2008": "пара",
    "2010": "рул",
    "2011": "набір",
    "2012": "пачка",
    "2013": "міш",
    "2014": "короб",
    "2015": "бухт",
    "2016": "лист",
    "2017": "банка",
    "2018": "флак",
    "2019": "каністр",
    "2020": "відро",
    "метр": "м",
    "м. п": "м пог",
    "м.п": "м пог",
    "мп": "м пог",
    "кв.м": "м²",
    "кв м": "м²",
    "куб.м": "м³",
    "куб м": "м³",
    "тони": "т",
    "тонна": "т",
    "штук": "шт",
    "штука": "шт",
    "упак": "уп",
    "упаковка": "уп",
    "комплект": "компл",
    "літр": "л",
    "кілограм": "кг",
    "грам": "г",
}


def unit_label(value):
    value = str(value or "").strip().lower().rstrip(".")
    return UNIT_LABELS.get(value, value)


def identifier(value):
    if isinstance(value, dict):
        value = value.get("external_id") or value.get("id")
    text = str(value or "").strip().lower()
    return "" if text in {"0", "00000000-0000-0000-0000-000000000000"} else text


def number(value):
    try:
        n = Decimal(str(value))
        return n if n.is_finite() and n.copy_abs() <= 10**15 else None
    except InvalidOperation:
        return None


def apply_inventory_cost(facts, events):
    """Historical moving average only from an evidenced empty opening balance.

    Movements are evaluated per (org, product) chronologically by day. Transfer outflows
    are processed before transfer inflows on the same day so a transfer carries the source
    warehouse's moving-average unit cost into the destination warehouse. Multiple movements
    for the same warehouse on one day without a provable intraday order invalidate that
    warehouse's valuation.
    """
    by_line = defaultdict(list)
    for r in facts:
        if not r["refund"] and r["cost"] is None:
            by_line[r["doc"], r["org"], r["store"], r["product"]].append(r)

    grouped = defaultdict(list)
    for e in events:
        grouped[e["org"], e["product"]].append(e)

    for (org, product), product_events in grouped.items():
        by_day = defaultdict(lambda: defaultdict(list))
        for e in product_events:
            by_day[e["day"]][e["store"]].append(e)

        state = {}
        for day in sorted(by_day):
            transfer_costs = {}
            day_stores = sorted(
                by_day[day].items(),
                key=lambda item: (
                    1 if len(item[1]) == 1 and item[1][0].get("kind") == "transfer" and item[1][0]["delta"] > 0 else 0,
                    item[0],
                ),
            )
            for store, batch in day_stores:
                balance, value = state.get(store, (None, None))
                if len(batch) != 1:
                    state[store] = (None, None)
                    continue
                e = batch[0]
                before = e["balance"] - e["delta"]
                if before == 0:
                    value = Decimal(0)
                elif balance != before:
                    value = None
                balance = e["balance"]
                if value is not None:
                    if e["delta"] > 0:
                        inflow_cost = e["purchase"]
                        if inflow_cost is None and e.get("kind") == "transfer":
                            inflow_cost = transfer_costs.get(e["doc"])
                        value = value + inflow_cost if inflow_cost is not None else None
                    elif before > 0:
                        cost = value / before
                        if e.get("kind") == "transfer":
                            transfer_costs[e["doc"]] = -e["delta"] * cost
                        matched = by_line[e["doc"], org, store, product]
                        if sum(r["qty"] for r in matched) <= -e["delta"]:
                            for r in matched:
                                r["cost"] = r["qty"] * cost
                        value += e["delta"] * cost
                state[store] = (balance, value)
    original = defaultdict(set)
    for r in facts:
        if not r["refund"]:
            original[r["doc"], r["product"], r["unit"]].add(
                None if r["cost"] is None else r["cost"] / r["qty"]
            )
    for r in facts:
        if r["refund"] and r["cost"] is None:
            costs = original.get((r.get("original"), r["product"], r["unit"]))
            if costs and len(costs) == 1 and None not in costs:
                r["cost"] = next(iter(costs)) * r["qty"]


def kind_of(doc):
    if doc["account"] == "polivalko-native":
        if doc["status"] != "posted":
            return None
        if doc["kind"] == "out":
            return "sale"
        if (doc["kind"] in ("back", "return", "customerReturn")
                or doc.get("entity_type") == "customerReturn"
                or doc.get("entity") == "customerReturn"):
            return "return"
        return None
    values = [
        "".join(ch for ch in identifier(doc.get(k)) if ch.isalnum()) for k in ("code", "kind", "raw_kind")
    ]
    kinds = [k for value in values for k, aliases in KINDS.items() if value in aliases]
    if not kinds or (values[0].isdigit() and values[0] not in {"3", "6", "7"}):
        return None
    statuses = {identifier(doc.get(k)) for k in ("requested", "status", "raw_status")}
    if statuses & INACTIVE:
        return None
    if not statuses & ACTIVE or ("return" in kinds and len(set(kinds)) > 1):
        return "invalid"
    return kinds[0]


def sale_line(line, refund):
    if not isinstance(line, dict) or not isinstance(line.get("product"), dict):
        return None
    p = line["product"]
    code, pid, sku = (identifier(p.get(k)) for k in ("code", "id", "sku"))
    qty, amount = number(line.get("quantity")), number(line.get("total"))
    if not (pid or code or sku) or not qty or amount is None or (not refund and min(qty, amount) < 0):
        return None
    return p, code, pid, sku, abs(qty), abs(amount)


def reconcile(documents, website, catalog, refs, as_of):
    products = {r["id"]: r for r in catalog}
    external = {identifier(r["navkolo_id"]): r["id"] for r in catalog if r["navkolo_id"]}
    ref_index = {(r["account"], r["kind"], identifier(r["ref"])): r["id"] for r in refs}
    titles = {r["id"]: r["title"] for r in refs}
    titles[UNKNOWN] = "Не визначено"
    categories = {r["category"]: r["category_name"] for r in catalog if r["category"]}
    categories[UNKNOWN] = "Без категорії"

    def location(account, kind, key):
        value = identifier(key)
        if not value:
            return UNKNOWN
        if value in titles:
            return value
        return ref_index.get((account, kind, value), f"{account}/{kind}/{value}")

    diagnostics = Counter()
    audits, candidates, orders, aliases = [], {}, {}, {}
    for d in documents:
        account = d["account"]
        ref = identifier(d.get("external")) or identifier(d["ref"])
        day = d["day"]
        if not day or day > as_of:
            continue
        if d["entity"] == "order":
            keys = {ref, identifier(d["ref"]), identifier(d.get("client"))} - {""}
            for key in keys:
                orders[account, key] = keys
            continue
        kind = kind_of(d)
        if not kind:
            continue
        currencies = {identifier(d.get(k)) for k in ("currency", "raw_currency")} - {""}
        if not currencies or currencies - {"uah", "980"} or kind == "invalid":
            diagnostics["unverifiedDocuments"] += 1
            continue
        raw_stores = d["store_ids"] or []
        org = location(account, "organization", d["org"])
        default_store = raw_stores[0] if len(raw_stores) == 1 else None
        rows = []
        invalid = 0
        raw_lines = d.get("products")
        for line in raw_lines if isinstance(raw_lines, list) else []:
            parsed = sale_line(line, kind == "return")
            if parsed is None:
                invalid += 1
                continue
            p, code, pid, sku, qty, amount = parsed
            identity = pid or code or sku
            key = None
            if account == "polivalko-native" and pid in products:
                key = pid
            elif account == "valko-dntrade":
                key = external.get("dntrade-code:" + code) or external.get(pid)
            key = key or f"{account}/product/{identity}"
            meta = products.get(key, {})
            store = location(account, "store", identifier(line.get("store")) or default_store)
            if isinstance(line.get("store"), dict) and line["store"].get("title"):
                titles.setdefault(store, line["store"]["title"])
            unit = p.get("unit") or line.get("unit")
            if isinstance(unit, dict):
                unit = unit.get("title") or unit.get("name") or unit.get("external_id") or unit.get("id")
            unit = unit_label(unit or meta.get("unit") or "")
            cost = number(line.get("cogs_total"))
            rows.append(
                {
                    "day": str(day),
                    "doc": d["id"],
                    "number": d.get("number") or d["ref"],
                    "origin": "accounting",
                    "product": key,
                    "name": meta.get("name") or p.get("title") or identity,
                    "sku": meta.get("sku") or p.get("sku") or "",
                    "category": meta.get("category") or UNKNOWN,
                    "org": org,
                    "store": store,
                    "unit": unit,
                    "qty": abs(qty),
                    "amount": abs(amount),
                    "cost": abs(cost) if cost is not None else None,
                    "refund": kind == "return",
                }
            )
        if not rows:
            diagnostics["emptyDocuments"] += 1
            diagnostics["invalidLines"] += invalid
            continue
        parent = identifier(d.get("parent_document")) or identifier(d.get("parent"))
        doc = {
            "ref": ref,
            "parent": parent,
            "client": identifier(d.get("client")),
            "kind": kind,
            "day": str(day),
            "id": d["id"],
            "rows": rows,
            "total": number(d.get("total")),
            "invalid": invalid,
        }
        key = (account, ref, kind == "return")
        aliases[account, identifier(d["ref"])] = ref
        old = candidates.get(key)
        if old:
            diagnostics["duplicateDocuments"] += 1
        if not old or (kind == "receipt", invalid, d["id"]) < (
            old["kind"] == "receipt",
            old["invalid"],
            old["id"],
        ):
            candidates[key] = doc

    for (account, _, _), d in candidates.items():
        d["parent"] = aliases.get((account, d["parent"]), d["parent"])
    invoices = {(acc, ref) for (acc, ref, _), d in candidates.items() if d["kind"] == "sale"}
    receipt_parents = {
        (account, ref): d["parent"]
        for (account, ref, _), d in candidates.items()
        if d["kind"] == "receipt" and (account, d["parent"]) in invoices
    }
    facts, original_costs, sale_links = [], defaultdict(list), {}
    counted = defaultdict(Decimal)
    for (account, ref, _), d in sorted(
        candidates.items(), key=lambda item: (item[1]["kind"] == "return", item[1]["day"], item[1]["id"])
    ):
        if d["kind"] == "receipt" and (account, ref) in receipt_parents:
            diagnostics["linkedReceipts"] += 1
            continue
        # Lines of a duplicate copy or of a receipt linked to its invoice belong to documents that are not counted.
        diagnostics["invalidLines"] += d["invalid"]
        parent = receipt_parents.get((account, d["parent"]), d["parent"])
        linked = {ref, parent, d["client"]} - {""}
        linked.update(orders.get((account, parent), set()))
        if d["kind"] == "return":
            linked.update(sale_links.get((account, parent), set()))
        else:
            sale_links[account, ref] = linked
        for r in d["rows"]:
            if r["refund"]:
                r["original"] = candidates.get((account, parent, False), {}).get("id")
            cost_key = (account, parent if r["refund"] else ref, r["product"], r["unit"])
            if r["refund"]:
                costs = original_costs.get(cost_key, [])
                if r["cost"] is None and costs and None not in costs and len(set(costs)) == 1:
                    r["cost"] = costs[0] * r["qty"]
            else:
                original_costs[cost_key].append(None if r["cost"] is None else r["cost"] / r["qty"])
            for link in linked:
                counted[link, r["product"], r["refund"]] += r["qty"]
            facts.append(r)
        line_total = sum(r["amount"] for r in d["rows"])
        audits.append(
            {
                "day": d["day"],
                "doc": d["id"],
                "number": d["rows"][0]["number"],
                "stores": sorted({r["store"] for r in d["rows"]}),
                "org": d["rows"][0]["org"],
                "recorded": d["total"],
                "lines": line_total,
                "invalid": d["invalid"],
                "difference": None if d["total"] is None else line_total - abs(d["total"]),
            }
        )

    for w in sorted(website, key=lambda row: (row["day"], row["id"], row["product"], row["total"])):
        qty = Decimal(w["quantity"])
        if qty <= 0:
            continue
        keys = [
            (key, w["product"], w["refund"])
            for key in {identifier(w["order_id"]), identifier(w["upstream"])}
            if key
        ]
        overlap = min(qty, max((counted[k] for k in keys), default=0))
        for key in keys:
            counted[key] = max(0, counted[key] - overlap)
        if overlap:
            diagnostics["linkedWebLines"] += 1
        if overlap == qty:
            continue
        meta = products.get(w["product"], {})
        facts.append(
            {
                "day": str(w["day"]),
                "doc": w["id"],
                "number": w["number"],
                "origin": "web",
                "product": w["product"],
                "name": meta.get("name") or w["name"],
                "sku": w["sku"],
                "category": meta.get("category") or UNKNOWN,
                "org": w["org"] or UNKNOWN,
                "store": w["store"] or UNKNOWN,
                "unit": unit_label(meta.get("unit") or ""),
                "qty": qty - overlap,
                "original": w["order_id"] if w["refund"] else None,
                "amount": w["total"] * (qty - overlap) / qty,
                "cost": None,
                "refund": w["refund"],
            }
        )
    facts.sort(key=lambda r: (r["day"], r["doc"], r["product"]))
    return {
        "asOf": str(as_of),
        "facts": facts,
        "audits": audits,
        "diagnostics": dict(diagnostics),
        "categories": categories,
        "locations": titles,
    }
