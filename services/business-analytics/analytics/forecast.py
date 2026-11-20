from collections import defaultdict
from datetime import date, timedelta
from hashlib import sha256
from math import ceil
from statistics import mean

VERSION = "weekly-2"
WEEKS = 156


def predict(history, horizon, method):
    recent = [v for v in history[-8:] if v is not None]
    if len(recent) < 6:
        return None
    level = mean(recent)
    if method == "mean8":
        return [level] * horizon
    if method == "season52":
        season = history[-52:][:horizon]
        return season if len(history) >= 52 and None not in season else None
    tail = [v for v in history[-4:] if v is not None]
    if len(tail) < 3:
        return None
    return [mean(tail)] * horizon


def fit(values, horizon):
    result = {
        "model": None,
        "wape": None,
        "bias": None,
        "folds": 0,
        "history": values[-13:],
        "weeks": [],
        "reason": None,
    }
    if sum(x is not None and x > 0 for x in values[-52:]) < 5:
        return dict(result, reason="Замало тижнів із продажами")
    # Non-overlapping origins. The newest complete fold is reserved for evaluation.
    origins = [
        i
        for i in range(len(values) - horizon, 7, -horizon)
        if None not in values[i : i + horizon] and sum(values[i : i + horizon]) > 0
    ][:7]
    if len(origins) < 3:
        return dict(result, reason="Недостатньо повних періодів для перевірки прогнозу")
    methods = ("mean8", "mean4", "season52")
    candidates = {m for m in methods if predict(values, horizon, m) is not None}
    folds = []
    for i in origins:
        predictions = {m: predict(values[:i], horizon, m) for m in candidates}
        if predictions.get("mean8") is not None:
            folds.append((values[i : i + horizon], predictions))
    if len(folds) < 3:
        return dict(result, reason="Історія містить пропуски перед контрольними періодами")
    scores = {}
    for method in methods:
        if not all(pred.get(method) is not None for _, pred in folds):
            continue
        errors = [abs(p - a) for actual, pred in folds[1:] for p, a in zip(pred[method], actual)]
        scores[method] = sum(errors)
    if not scores:
        return dict(result, reason="Немає порівнюваних моделей")
    model = min(scores, key=scores.get)
    actual, preds = folds[0]
    error = [p - a for p, a in zip(preds[model], actual)]
    # Empirical 80th percentile absolute weekly error, in native series units.
    residuals = sorted(
        abs(p - a) for observed, predictions in folds for p, a in zip(predictions[model], observed)
    )
    radius = residuals[ceil(0.8 * len(residuals)) - 1]
    projected = predict(values, horizon, model)
    return dict(
        result,
        model=model,
        folds=len(folds),
        wape=round(sum(map(abs, error)) / sum(actual), 4),
        bias=round(sum(error) / sum(actual), 4),
        weeks=[
            {"value": round(p, 3), "low": round(max(0, p - radius), 3), "high": round(p + radius, 3)}
            for p in projected
        ],
    )


def build_models(snapshot, previous=None):
    end = date.fromisoformat(snapshot["asOf"])
    seen, totals, meta, outages = defaultdict(set), defaultdict(dict), {}, defaultdict(set)
    for row in snapshot["outages"]:
        age = (end - date.fromisoformat(row["day"])).days // 7
        until = (end - date.fromisoformat(row.get("through", row["day"]))).days // 7
        outages[row["org"], row["store"], row["product"]].update(
            range(max(0, until), min(WEEKS - 1, age) + 1)
        )
    for row in snapshot["facts"]:
        age = (end - date.fromisoformat(row["day"])).days // 7
        if not 0 <= age < WEEKS:
            continue
        org, store, cat, prod, unit = (row[k] for k in ("org", "store", "category", "product", "unit"))
        seen[org, store].add(age)
        series = [("sku", prod, unit, "qty"), ("category", cat, "грн", "amount")]
        if unit:
            series.append(("category", cat, unit, "qty"))
        for kind, key, measure, field in series:
            index = (kind, org, store, key, measure)
            meta[index] = {
                "kind": kind,
                "org": org,
                "store": store,
                "product": prod if kind == "sku" else None,
                "category": cat,
                "name": row["name"] if kind == "sku" else snapshot["categories"].get(cat, cat),
                "unit": measure,
            }
            values = totals[index]
            values[age] = values.get(age, 0.0) + (0 if row["refund"] else float(row[field]))
    models = []
    previous_models = {
        (m["kind"], m["org"], m["store"], m["product"] or m["category"], m["unit"]): m
        for m in (previous or {}).get("models", [])
        if (previous or {}).get("version") == VERSION
    }
    existing = {k[1:4] for k in totals if k[0] == "sku"}
    for stock in snapshot.get("stocks", []):
        org, store, prod = (stock[k] for k in ("org", "store", "product"))
        if (org, store, prod) not in existing:
            p = snapshot.get("stockMeta", {}).get(prod, {})
            unit = (p.get("unit") or "").rstrip(".")
            models.append(
                dict(
                    kind="sku",
                    org=org,
                    store=store,
                    product=prod,
                    category=p.get("category") or "unknown",
                    name=p.get("name") or prod,
                    unit=unit,
                    stockoutWeeks=0,
                    **fit([], 4),
                )
            )
    for key, weekly in totals.items():
        kind, org, store, identity, unit = key
        first = max(weekly)
        censored = outages[org, store, identity] if kind == "sku" else set()
        series = [
            weekly.get(i, 0.0) if i in seen[org, store] and i not in censored else None
            for i in range(first, -1, -1)
        ]
        signature = sha256(repr(series).encode()).hexdigest()
        old = previous_models.get(key, {})
        if old.get("signature") == signature:
            model = {k: old[k] for k in ("model", "wape", "bias", "folds", "history", "weeks", "reason")}
        else:
            model = fit(series, 4 if kind == "sku" else 13)
        models.append(dict(meta[key], **model, signature=signature, stockoutWeeks=len(censored)))
    return sorted(models, key=lambda r: (r["kind"], r["name"], r["org"], r["store"], r["unit"]))


def replenishment(model, stock, policy, start, today):
    result = {"order": None, "stockout": None, "available": None, "incoming": None, "reason": None}
    if not stock:
        return dict(result, reason="Залишок на цьому складі невідомий")
    available = float(stock["quantity"] - stock["reserved"])
    result["available"] = available
    if start != today:
        return dict(result, reason="Оновіть залишки й прогноз на сьогодні")
    if model["reason"] or not model["weeks"]:
        return dict(result, reason=model["reason"] or "Бракує прогнозу")
    if not policy:
        return dict(result, reason="Вкажіть строк поставки, резерв і підтверджені надходження")
    if policy["confirmed"] != str(today):
        return dict(result, reason="Підтвердьте надходження станом на сьогодні")
    days = policy["lead"] + policy["review"] + policy["safety"]
    if days > 7 * len(model["weeks"]):
        return dict(result, reason="Період закупівлі перевищує доступний горизонт прогнозу")
    deliveries = defaultdict(float)
    for item in policy["deliveries"]:
        deliveries[item["day"]] += float(item["qty"])
    balance, shortage, incoming = available, 0.0, 0.0
    for i in range(7 * len(model["weeks"])):
        day = str(start + timedelta(days=i))
        demand = float(model["weeks"][i // 7]["value"]) / 7
        balance += deliveries[day] - demand
        if balance <= 0 and demand > 0 and result["stockout"] is None:
            result["stockout"] = day
        if i < days:
            incoming += deliveries[day]
            # A later delivery cannot cover a shortage earlier in the review window.
            if i >= policy["lead"]:
                shortage = max(shortage, -balance)
    return dict(result, incoming=round(incoming, 3), order=round(shortage, 3))
