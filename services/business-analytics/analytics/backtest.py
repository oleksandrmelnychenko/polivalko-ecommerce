"""Check the weekly SKU forecast against a published snapshot of real sales.

    python -m analytics.backtest [snapshot.gz] [--weeks 52] [--series 300]

For each of the busiest products the forecast is rebuilt at every fourth week of the last year
from earlier sales only, then compared with what was sold in the following four weeks. The
database is not contacted and nothing is written.
"""
import argparse
import gzip
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

import simplejson as json

from .forecast import fit, predict, weekly_series

HORIZON = 4
SNAPSHOTS = Path("/var/lib/business-analytics")


def backtest(snapshot, weeks=52, limit=300):
    """Forecast error by the month a forecast starts in, next to a flat eight-week average."""
    end = date.fromisoformat(snapshot["asOf"])
    products = sorted(
        (values for key, _, values, _ in weekly_series(snapshot) if key[0] == "sku"),
        key=lambda values: -sum(v for v in values if v),
    )
    months = defaultdict(lambda: dict(windows=0, missing=0, sold=0.0, model=[0.0, 0.0], flat=[0.0, 0.0]))
    for values in products[: limit or None]:
        count = len(values)
        for origin in range(count - HORIZON, max(count - weeks, 8) - 1, -HORIZON):
            actual = values[origin : origin + HORIZON]
            if None in actual:
                continue
            start = end - timedelta(days=7 * (count - origin) - 1)
            month = months[start.strftime("%Y-%m")]
            month["windows"] += 1
            model = fit(values[:origin], HORIZON)
            if not model["weeks"]:
                month["missing"] += 1
                continue
            month["sold"] += sum(actual)
            forecasts = [week["value"] for week in model["weeks"]], predict(values[:origin], HORIZON, "mean8")
            for name, forecast in zip(("model", "flat"), forecasts):
                month[name][0] += sum(forecast) - sum(actual)
                month[name][1] += sum(abs(f - a) for f, a in zip(forecast, actual))

    def error(month, name):
        if not month["sold"]:
            return None
        return dict(bias=round(month[name][0] / month["sold"], 4), wape=round(month[name][1] / month["sold"], 4))

    return [
        dict(month=name, windows=m["windows"], missing=m["missing"], forecast=error(m, "model"), flat=error(m, "flat"))
        for name, m in sorted(months.items())
    ]


def latest_snapshot():
    found = sorted(SNAPSHOTS.glob("*/snapshot.gz"), key=lambda path: path.stat().st_mtime)
    if not found:
        raise SystemExit(f"У {SNAPSHOTS} немає опублікованого знімка. Вкажіть шлях до snapshot.gz.")
    return found[-1]


def main(arguments=None):
    parser = argparse.ArgumentParser(prog="python -m analytics.backtest", description="Перевірка тижневого прогнозу на історії продажів")
    parser.add_argument("snapshot", nargs="?", help="шлях до snapshot.gz; без нього береться останній опублікований")
    parser.add_argument("--weeks", type=int, default=52, help="скільки останніх тижнів перевіряти")
    parser.add_argument("--series", type=int, default=300, help="скільки найпродаваніших товарів брати; 0 — усі")
    options = parser.parse_args(arguments)
    with gzip.open(options.snapshot or latest_snapshot(), "rt", encoding="utf-8") as stream:
        snapshot = json.load(stream, use_decimal=True)
    rows = backtest(snapshot, options.weeks, options.series)
    products = "усі товари" if not options.series else f"{options.series} найпродаваніших товарів"
    print(f"Знімок продажів станом на {snapshot['asOf']}. Прогноз на {HORIZON} тижні з кожної четвертої точки "
          f"за останні {options.weeks} тижнів, {products}.")
    print("Зміщення з мінусом означає, що прогноз нижчий за факт. WAPE — сума помилок до суми продажів.")
    print()
    print(f"{'Місяць':8} {'Вікон':>6} {'Без прогнозу':>13}   {'Прогноз':>8} {'WAPE':>6}   {'Середнє за 8 тижнів':>20} {'WAPE':>6}")

    def cells(error):
        return ("—", "—") if error is None else (f"{error['bias']:+.0%}", f"{error['wape']:.0%}")

    for row in rows:
        model, flat = cells(row["forecast"]), cells(row["flat"])
        print(f"{row['month']:8} {row['windows']:>6} {row['missing']:>13}   {model[0]:>8} {model[1]:>6}   {flat[0]:>20} {flat[1]:>6}")


if __name__ == "__main__":
    main()
