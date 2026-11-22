"""Monthly forecasts of net UAH turnover from the production document register."""
from datetime import date, timedelta
from decimal import Decimal
from math import ceil
from statistics import fmean
from threading import Lock
from time import monotonic

from .invoices import INDEPENDENT_RECEIPTS, currency_valid
from .learning import lag_regression
from .register import kind_of
from .source import production


def month(day, offset=0):
    year, index = divmod(day.year * 12 + day.month - 1 + offset, 12)
    return date(year, index + 1, 1)


# Aggregate headers by the exact inputs used by the annual reconciliation.
# This keeps invoice identifiers, product lines and customer data inside PostgreSQL.
HEADER_MONTHS = """
SELECT date_trunc('month',day)::date AS month, source_account AS account, kind, status, currency,
       details->>'type' AS raw_kind, details->>'status' AS raw_status, details->>'currency_iso' AS raw_currency,
       max(day) AS last_day, sum(abs(total)) AS amount,
       count(*) FILTER (WHERE total IS NULL OR abs(total)>1e15) AS invalid
FROM accounting.documents WHERE entity_type IN ('invoice','customerReturn') AND day >= %s AND day < %s
GROUP BY 1,2,3,4,5,6,7,8
"""
RECEIPT_MONTHS = """
SELECT date_trunc('month',d.day)::date AS month, max(d.day) AS last_day, sum(abs(d.total)) AS amount,
       count(*) FILTER (WHERE d.total IS NULL) AS invalid FROM accounting.documents d
""" + INDEPENDENT_RECEIPTS + " GROUP BY 1"


def read_history(today):
    bounds = (month(today, -120), today + timedelta(days=1))
    totals, incomplete = {}, set()
    latest = None
    with production() as conn:
        for query in (HEADER_MONTHS, RECEIPT_MONTHS):
            for row in conn.execute(query, bounds):
                kind = kind_of(row) if query == HEADER_MONTHS else "receipt"
                if kind not in ("sale", "return", "receipt", "invalid"):
                    continue
                if query == HEADER_MONTHS and kind == "receipt":
                    continue
                key = row["month"]
                latest = max(latest or row["last_day"], row["last_day"])
                if (kind == "invalid" or row["invalid"] or row["amount"] is None or
                        (query == HEADER_MONTHS and not currency_valid(row))):
                    incomplete.add(key)
                    continue
                amount = row["amount"]
                totals[key] = totals.get(key, Decimal(0)) + (-amount if kind == "return" else amount)
    totals.update(dict.fromkeys(incomplete))
    return totals, latest


_history_lock = Lock()
_cached = None


def history_for(today):
    global _cached
    with _history_lock:
        if _cached is None or _cached[0] != today or monotonic() >= _cached[1]:
            _cached = today, monotonic() + 900, read_history(today)
        return _cached[2]


METHODS = {"recent": 3, "season": 12, "scaledSeason": 18, "ridge": 24}


def predict(values, horizon, method):
    if method == "recent":
        return [fmean(values[-3:])] * horizon
    if method == "season":
        return [values[-12 + i] for i in range(horizon)]
    if method == "scaledSeason":
        # Learn the year-over-year level change from at most 12 matched
        # months preceding this forecast origin. Preserve the seasonal shape.
        previous = values[-24:-12]
        latest = values[-len(previous):]
        energy = sum(p*p for p in previous)
        factor = sum(p*v for p, v in zip(previous, latest)) / energy if energy else 1
        return [factor * values[-12 + i] for i in range(horizon)]
    return lag_regression(values, horizon, 12)


def forecast_months(totals, latest, today, horizon):
    result = dict(horizon=horizon, lastDocument=str(latest) if latest else None, history=[], projection=[],
                  validation=[], comparisons=[], model=None, wape=None, baselineWape=None, mae=None,
                  trainingMonths=0, staleMonths=0, reason=None)
    if not latest:
        return dict(result, reason="У реєстрі немає проведених документів продажу.")
    # A trailing archive month can end mid-import. A later document or a document
    # on the final calendar day is evidence that the source reached month-end.
    end = min(month(today, -1), month(latest) if latest == month(latest, 1) - timedelta(days=1)
              else month(latest, -1))
    result["staleMonths"] = (today.year - end.year)*12 + today.month - end.month - 1
    dates = []
    day = end
    while totals.get(day) is not None:
        dates.append(day)
        day = month(day, -1)
    dates.reverse()
    values = [float(totals[m]) for m in dates]
    result["history"] = [dict(month=str(m), value=totals[m]) for m in dates[-24:]]
    result["trainingMonths"] = len(values)
    if len(values) < 8:
        return dict(result, reason="Для перевірки потрібно 8 послідовних завершених місяців із відомим оборотом.")

    # The latest block is never used to select models or calibrate intervals.
    test = min(horizon, max(1, (len(values) - 5) // 3))
    cutoff = len(values) - test
    last_origin = cutoff - test
    methods = [m for m, minimum in METHODS.items() if minimum <= last_origin - 2]
    start = max(max(METHODS[m] for m in methods), last_origin - 23)
    origins = range(start, last_origin + 1)
    scores = {}
    radii = {}
    for method in methods:
        errors = [[] for _ in range(horizon)]
        for origin in origins:
            steps = min(horizon, cutoff - origin)
            predictions = predict(values[:origin], steps, method)
            for step, estimate in enumerate(predictions):
                errors[step].append(abs(estimate - values[origin + step]))
        scores[method] = fmean(e for group in errors[:test] for e in group)
        radii[method] = [sorted(group)[min(len(group), ceil(0.8*(len(group)+1))) - 1]
                         if len(group) >= 5 else None for group in errors]
    winner = min(scores, key=scores.get)
    baseline = min((m for m in methods if m in ("season", "recent")), key=scores.get)
    validation = predict(values[:cutoff], test, winner)
    actual = values[cutoff:]
    scale = sum(abs(v) for v in actual)
    def holdout_wape(method):
        predictions = predict(values[:cutoff], test, method)
        return round(sum(abs(p-a) for p, a in zip(predictions, actual)) / scale, 4) if scale else None

    errors = [abs(p-a) for p, a in zip(validation, actual)]
    result.update(model=winner, mae=round(fmean(errors), 2),
                  wape=round(sum(errors)/scale, 4) if scale else None,
                  baselineWape=holdout_wape(baseline),
                  validation=[dict(month=str(m), value=round(p, 2), actual=a)
                              for m,p,a in zip(dates[cutoff:], validation, actual)],
                  comparisons=[dict(model=m, mae=round(scores[m], 2), origins=len(origins),
                                    holdoutWape=holdout_wape(m)) for m in methods])
    # Net turnover of a month falls below zero only when returns exceed sales. Unless the history has
    # such a month, neither the forecast nor its range goes below zero.
    floor = min(0.0, min(values))
    for i, (value, radius) in enumerate(zip(predict(values, horizon, winner), radii[winner]), 1):
        shown = max(value, floor)
        result["projection"].append(dict(month=str(month(end, i)), value=round(shown, 2),
                                         low=round(max(value-radius, floor), 2) if radius is not None else None,
                                         high=round(max(value+radius, shown), 2) if radius is not None else None))
    return result
