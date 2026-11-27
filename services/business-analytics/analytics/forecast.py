from collections import defaultdict
from datetime import date, timedelta
from hashlib import sha256
from math import ceil
from statistics import mean, median
from .learning import lag_regression
from .register import unit_label

VERSION = "weekly-5"
WEEKS = 156
YEAR = 52
# A product that was out of stock is forecast from its sales before the gap, but no further back than this.
KNOWN_WEEKS = 20
METHODS = ("mean8", "mean4", "season52", "seasonScaled", "intermittent", "ridgeRecent", "ridge")
SEASONAL = ("season52", "seasonScaled", "ridge")


def known(history, count, minimum):
    """Latest weeks with observed demand. A week without stock or documents is unknown, not zero."""
    values = [v for v in history[-KNOWN_WEEKS:] if v is not None][-count:]
    return values if len(values) >= minimum else None


def usual_limit(values):
    """Three times the 90th percentile of weeks with sales. A week above it is a one-off, such as a bulk order."""
    sold = sorted(v for v in values if v)
    return 3 * sold[ceil(0.9 * len(sold)) - 1] if sold else float("inf")


def year_ago(history, horizon):
    """Last year's same weeks. A one-off order among them is replaced by the level of the weeks around it."""
    season = history[-YEAR:][:horizon]
    if len(history) < YEAR or None in season:
        return None
    limit = usual_limit(history[-YEAR:])
    weeks = []
    for step, value in enumerate(season):
        at = len(history) - YEAR + step
        # The same weeks a year earlier, give or take two. A peak that repeats is a season and stays;
        # with one season of history there is nothing to compare with, so nothing is replaced.
        earlier = [v for v in history[max(0, at - YEAR - 2) : at - YEAR + 3] if v is not None] if at >= YEAR else []
        if earlier and value > max(limit, 2 * max(earlier)):
            around = [v for v in history[at - 2 : at] + history[at + 1 : at + 3] if v is not None]
            value = median(around) if around else limit
        weeks.append(value)
    return weeks


def scaled_season(history, horizon):
    """Last year's same weeks at this year's level: sales of the past year against the year before."""
    season = year_ago(history, horizon)
    if season is None:
        return None
    # Compare matching weeks over up to a whole year. A season that starts a few weeks early or
    # late then moves the level only a little; two matching months alone would double or halve it.
    # One-off orders are cut down in both years so a single bulk order does not move the level.
    start = max(YEAR, len(history) - YEAR)
    now_limit, then_limit = usual_limit(history[start:]), usual_limit(history[start - YEAR : -YEAR])
    pairs = [
        (min(history[i], now_limit), min(history[i - YEAR], then_limit))
        for i in range(start, len(history))
        if history[i] is not None and history[i - YEAR] is not None
    ]
    before = sum(then for _, then in pairs)
    # Twelve matching weeks, so it can be checked as far back as the lag regression.
    if len(pairs) < 12 or before <= 0:
        return None
    factor = min(2.0, max(0.5, sum(now for now, _ in pairs) / before))
    return [factor * value for value in season]


def predict(history, horizon, method):
    recent = known(history, 8, 6)
    if recent is None:
        return None
    if method == "mean8":
        return [mean(recent)] * horizon
    if method == "season52":
        return year_ago(history, horizon)
    if method == "seasonScaled":
        return scaled_season(history, horizon)
    if method in ("ridge", "ridgeRecent"):
        if history[-1] is None:
            return None
        return lag_regression(history, horizon, 52 if method == "ridge" else 1, nonnegative=True)
    if method == "intermittent":
        # Update sale probability every observed week and order size only on sales.
        # Only observed weeks update either state. A censored week is not a zero.
        observed = [v for v in history if v is not None]
        if history[-1] is None or len(observed) < 12 or sum(v > 0 for v in observed) < 3:
            return None
        probability = float(observed[0] > 0)
        size = next(v for v in observed if v > 0)
        for value in observed[1:]:
            probability += 0.1 * (int(value > 0) - probability)
            if value:
                size += 0.1 * (value - size)
        return [probability * size] * horizon
    tail = known(history, 4, 3)
    return [mean(tail)] * horizon if tail else None


def fit(values, horizon):
    result = {
        "model": None,
        "wape": None,
        "bias": None,
        "baselineWape": None,
        "folds": 0,
        "seasonFolds": 0,
        "staleWeeks": 0,
        "history": values[-13:],
        "weeks": [],
        "reason": None,
    }
    if sum(x is not None and x > 0 for x in values[-52:]) < 5:
        return dict(result, reason="Замало тижнів із продажами")
    count = len(values)

    def complete(i):
        return 7 < i <= count - horizon and None not in values[i : i + horizon]

    # Non-overlapping origins. The newest complete fold is reserved for evaluation.
    origins = [i for i in range(count - horizon, 7, -horizon) if complete(i)][:7]
    if len(origins) < 3:
        return dict(result, reason="Недостатньо повних періодів для перевірки прогнозу")
    candidates = [m for m in METHODS if predict(values, horizon, m) is not None]
    if not candidates:
        return dict(result, reason="Бракує свіжих продажів: останні тижні без залишку або без даних")

    def fold(i):
        predictions = {m: predict(values[:i], horizon, m) for m in candidates}
        return (i, values[i : i + horizon], predictions) if predictions.get("mean8") is not None else None

    folds = [f for f in map(fold, origins) if f]
    if len(folds) < 3:
        return dict(result, reason="Історія містить пропуски перед контрольними періодами")
    # Compare mature models on the same recent origins. Early dates before a
    # model had training data should not disqualify it for the entire series.
    # Keep at least three selection folds plus the independent last block.
    available = {m for m in candidates if len(folds) >= 4 and all(p[m] is not None for _, _, p in folds[:4])}
    if available:
        for index, (_, _, forecasts) in enumerate(folds[4:], 4):
            if any(forecasts[m] is None for m in available):
                folds = folds[:index]
                break
    compared = [m for m in candidates if all(p[m] is not None for _, _, p in folds)]
    if not compared:
        return dict(result, reason="Немає порівнюваних моделей")
    # The recent folds only show what worked in the last half-year. Before a season that is
    # the quiet period, so a flat average wins and the forecast misses the start of the season.
    # Also check the same weeks of earlier years, wherever every compared model could be trained.
    same_weeks = {count - YEAR * years + shift * horizon for years in (1, 2) for shift in (0, -1, 1)}
    earlier = [fold(i) for i in sorted(same_weeks - set(origins), reverse=True) if complete(i)]
    earlier = [check for check in earlier if check]
    seasonal = [check for check in earlier if all(check[2][m] is not None for m in compared)]
    if not seasonal and not any(i in same_weeks for i, _, _ in folds[1:]):
        # With about two years of history the heavier models cannot be trained a year back.
        # Checking the simpler ones in the same season matters more than keeping every model in the race.
        usable = [check for check in earlier if check[2].get("season52") is not None]
        kept = [m for m in compared if all(check[2][m] is not None for check in usable)]
        if usable and "season52" in kept:
            compared, seasonal = kept, usable
    selection = folds[1:] + seasonal
    scores = {
        m: sum(abs(p - a) for _, actual, pred in selection for p, a in zip(pred[m], actual)) for m in compared
    }
    model = min(scores, key=scores.get)
    _, actual, preds = folds[0]
    error = [p - a for p, a in zip(preds[model], actual)]
    # Empirical 80th percentile absolute weekly error, in native series units. A model that follows
    # the season is judged by its errors in the same weeks of earlier years: the quiet half-year
    # before a season says little about how far it misses inside one.
    in_season = [check for check in selection if check[0] in same_weeks]
    checks = in_season if in_season and model in SEASONAL else folds[1:]
    residuals = sorted(abs(p - a) for _, observed, pred in checks for p, a in zip(pred[model], observed))
    radius = residuals[ceil(0.8 * len(residuals)) - 1]
    projected = predict(values, horizon, model)
    base = min((m for m in scores if m in ("mean8", "mean4", "season52")), key=scores.get)
    scale = sum(abs(a) for a in actual)
    return dict(
        result,
        model=model,
        folds=len(folds),
        # Extra control periods in the same weeks of earlier years, not counted in `folds`.
        seasonFolds=len(seasonal),
        # Weeks since the last observed demand: the forecast then rests on sales before the gap.
        staleWeeks=next((age for age, value in enumerate(reversed(values)) if value is not None), 0),
        wape=round(sum(map(abs, error)) / scale, 4) if scale else None,
        bias=round(sum(error) / scale, 4) if scale else None,
        baselineWape=round(sum(abs(p-a) for p, a in zip(preds[base], actual)) / scale, 4) if scale else None,
        weeks=[
            {"value": round(p, 3), "low": round(max(0, p - radius), 3), "high": round(p + radius, 3)}
            for p in projected
        ],
    )


def weekly_series(snapshot):
    """Weekly sales of every SKU and category, oldest week first. A week without stock or documents is None."""
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
        org, store, cat, prod = (row[k] for k in ("org", "store", "category", "product"))
        unit = unit_label(row["unit"])
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
    for key, weekly in totals.items():
        _, org, store, identity, _ = key
        censored = outages[org, store, identity] if key[0] == "sku" else set()
        series = [
            weekly.get(i, 0.0) if i in seen[org, store] and i not in censored else None
            for i in range(max(weekly), -1, -1)
        ]
        yield key, meta[key], series, len(censored)


def build_models(snapshot, previous=None):
    series = list(weekly_series(snapshot))
    models = []
    previous_models = {
        (m["kind"], m["org"], m["store"], m["product"] or m["category"], m["unit"]): m
        for m in (previous or {}).get("models", [])
        if (previous or {}).get("version") == VERSION
    }
    existing = {key[1:4] for key, _, _, _ in series if key[0] == "sku"}
    for stock in snapshot.get("stocks", []):
        org, store, prod = (stock[k] for k in ("org", "store", "product"))
        if (org, store, prod) not in existing:
            p = snapshot.get("stockMeta", {}).get(prod, {})
            unit = unit_label(p.get("unit") or "")
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
    for key, meta, values, stockouts in series:
        signature = sha256(repr(values).encode()).hexdigest()
        old = previous_models.get(key, {})
        if old.get("signature") == signature:
            model = {k: old[k] for k in ("model", "wape", "baselineWape", "bias", "folds", "seasonFolds", "staleWeeks",
                                         "history", "weeks", "reason")}
        else:
            model = fit(values, 4 if key[0] == "sku" else 13)
        models.append(dict(meta, **model, signature=signature, stockoutWeeks=stockouts))
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
