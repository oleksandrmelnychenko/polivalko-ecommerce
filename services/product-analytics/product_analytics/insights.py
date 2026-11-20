from collections.abc import Mapping, Sequence
from datetime import date, timedelta
from decimal import Decimal
from statistics import median

from .demand import covers, round_one, weekly


def build_insights(
    metrics: dict,
    products: Sequence[dict],
    demand: Mapping[date, Decimal],
    *,
    to: date,
    first: date | None,
    through: date | None,
    forecast: dict | None,
    stock_coverage: bool,
    reliable_demand: bool,
    website: bool,
    ignored_documents: int,
    returns_available: bool,
) -> list[dict]:
    insights = []
    if ignored_documents > 0:
        count = format_quantity(ignored_documents)
        if website:
            insights.append(insight(
                "coverage", "Є повернення без товарних рядків",
                f"У завантаженій історії {count} повернень без суми, яку можна віднести до конкретного товару.",
            ))
        else:
            insights.append(insight(
                "coverage", "Частину документів не враховано",
                f"Пропущено документів у завантаженій історії: {count}. Перевірте якість імпорту перед рішеннями на основі цих даних.",
            ))

    previous = metrics["previousSoldUnits"]
    if previous is not None and previous >= 5:
        change = 100 * (metrics["soldUnits"] - previous) / previous
        if abs(change) >= 15:
            insights.append(insight(
                "trend", "Попит зріс" if change > 0 else "Попит знизився",
                f"Кількість проданих одиниць змінилася на {format_quantity(abs(change))}% "
                "проти попереднього періоду тієї самої тривалості.",
            ))

    if reliable_demand and covers(first, through, to - timedelta(days=62), to):
        anomaly = detect_anomaly(demand, to)
        if anomaly is not None:
            insights.append(anomaly)

    if stock_coverage:
        replenish = min(
            (row for row in products if row["stockDays"] is not None and row["stockDays"] <= 7),
            key=lambda row: row["stockDays"], default=None,
        )
        if replenish is not None:
            insights.append(insight(
                "replenish", "Перевірте поповнення запасу",
                f"{replenish['name']}. Доступного запасу приблизно на {format_quantity(replenish['stockDays'])} дн. "
                "за темпом продажів останніх 28 днів.",
                replenish["productKey"],
            ))

        if covers(first, through, to - timedelta(days=55), to):
            slow_before = (to - timedelta(days=56)).isoformat()
            slow = max(
                (row for row in products if row["stock"] is not None and row["stock"] > 0
                 and row["lastSaleDay"] is not None and row["lastSaleDay"] <= slow_before),
                key=lambda row: row["stock"], default=None,
            )
            if slow is not None:
                last_sale = date.fromisoformat(slow["lastSaleDay"])
                insights.append(insight(
                    "slow-stock", "Запас без недавніх продажів",
                    f"{slow['name']}. Доступно {format_quantity(slow['stock'])} од. "
                    f"Останній продаж у цьому джерелі був {last_sale:%d.%m.%Y}.",
                    slow["productKey"],
                ))

    sold = metrics["soldUnits"]
    returned = metrics["returnedUnits"]
    if returns_available and sold >= 10 and returned >= 3 and returned / sold >= Decimal("0.15"):
        insights.append(insight(
            "returns", "Перевірте повернення",
            f"За період зафіксовано {format_quantity(returned)} повернених і {format_quantity(sold)} проданих од. "
            "Повернення могли стосуватися раніших продажів.",
        ))

    if forecast is not None and forecast["validationWape"] >= 50:
        insights.append(insight(
            "forecast", "Висока похибка прогнозу",
            f"Похибка на контрольних тижнях становила {format_quantity(forecast['validationWape'])}%. "
            "Врахуйте цей розкид, плануючи закупівлі.",
        ))
    return insights


def detect_anomaly(demand: Mapping[date, Decimal], through: date) -> dict | None:
    weeks = weekly(demand, through, 9)
    history = weeks[:-1]
    baseline = median(history)
    if sum(value > 0 for value in history) < 4 or baseline < 3:
        return None

    deviation = median(abs(value - baseline) for value in history)
    latest = weeks[-1]
    delta = latest - baseline
    if abs(delta) < max(3, 3 * deviation, baseline / 2):
        return None

    return insight(
        "anomaly", "Стрибок попиту за тиждень" if delta > 0 else "Спад попиту за тиждень",
        f"За останні 7 днів продано {format_quantity(latest)} од. "
        f"Медіана попередніх восьми тижнів становила {format_quantity(baseline)} од.",
    )


def insight(kind: str, title: str, detail: str, product_key: str | None = None) -> dict:
    return {"kind": kind, "title": title, "detail": detail, "productKey": product_key}


def format_quantity(value: Decimal | int) -> str:
    return f"{round_one(Decimal(value)):,f}".removesuffix(".0").replace(",", "\u00a0").replace(".", ",")
