from calendar import monthrange
from collections import defaultdict
from collections.abc import Mapping, Sequence
from datetime import date, timedelta
from decimal import Decimal, ROUND_CEILING, ROUND_HALF_EVEN

ZERO = Decimal(0)
FORECAST_WEEKS = 14
FORECAST_HISTORY_DAYS = FORECAST_WEEKS * 7
ANNUAL_FORECAST_HISTORY_DAYS = (FORECAST_WEEKS + 52) * 7
SELECTION_START = 6
VALIDATION_START = 10
HORIZON_WEEKS = 4


def round_one(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.1"), rounding=ROUND_HALF_EVEN)


def covers(first: date | None, through: date | None, start: date, end: date) -> bool:
    return first is not None and through is not None and first <= start and through >= end


def weekly(demand: Mapping[date, Decimal], through: date, count: int) -> list[Decimal]:
    start = through - timedelta(days=count * 7 - 1)
    return [
        sum((demand.get(start + timedelta(days=week * 7 + day), ZERO) for day in range(7)), ZERO)
        for week in range(count)
    ]


def mean_four(weeks: Sequence[Decimal], week: int) -> Decimal:
    return sum(weeks[week - 4:week], ZERO) / 4


def weighted_four(weeks: Sequence[Decimal], week: int) -> Decimal:
    return sum((weight * sales for weight, sales in enumerate(weeks[week - 4:week], 1)), ZERO) / 10


def weekly_naive(weeks: Sequence[Decimal], week: int) -> Decimal:
    return weeks[week - 1]


def year_ago(weeks: Sequence[Decimal], week: int) -> Decimal:
    return weeks[week - 52]


MODELS = (
    ("mean-4", mean_four),
    ("weighted-4", weighted_four),
    ("weekly-naive", weekly_naive),
    ("year-ago", year_ago),
)


def forecast(demand: Mapping[date, Decimal], through: date, annual_history: bool = False) -> dict | None:
    offset = 52 if annual_history else 0
    weeks = weekly(demand, through, FORECAST_WEEKS + offset)
    selection_start = offset + SELECTION_START
    validation_start = offset + VALIDATION_START
    validation = weeks[validation_start:]
    if (
        sum(week > 0 for week in weeks[offset:]) < 6
        or sum(weeks[selection_start:validation_start], ZERO) == 0
        or sum(week > 0 for week in validation) < 2
    ):
        return None

    # Select using the first control window, then measure errors on later, held-out weeks.
    candidates = MODELS if annual_history else MODELS[:-1]
    selection = range(selection_start, validation_start)
    method, predict = min(
        candidates,
        key=lambda model: sum((abs(weeks[index] - model[1](weeks, index)) for index in selection), ZERO),
    )
    residuals = sorted(abs(weeks[index] - predict(weeks, index)) for index in range(validation_start, len(weeks)))
    wape = round_one(100 * sum(residuals, ZERO) / sum(validation, ZERO))
    error_rank = int((len(residuals) * Decimal("0.8")).to_integral_value(rounding=ROUND_CEILING))
    error = residuals[error_rank - 1]

    points = []
    for week in range(HORIZON_WEEKS):
        prediction = predict(weeks, len(weeks))
        weeks.append(prediction)
        points.append({
            "from": (through + timedelta(days=1 + week * 7)).isoformat(),
            "to": (through + timedelta(days=(week + 1) * 7)).isoformat(),
            "soldUnits": round_one(prediction),
            "low": round_one(max(ZERO, prediction - error)),
            "high": round_one(prediction + error),
        })
    return {"method": method, "validationWape": wape, "points": points}


def shift_month(month_start: date, months: int) -> date:
    year, month = divmod(month_start.year * 12 + month_start.month - 1 + months, 12)
    return date(year, month + 1, 1)


def seasonality(demand: Mapping[date, Decimal], first: date, through: date) -> list[dict] | None:
    last_month = through.replace(day=1)
    end = shift_month(last_month, 1) if through.day == monthrange(through.year, through.month)[1] else last_month
    start = shift_month(end, -24)
    if first > start:
        return None

    totals: dict[date, Decimal] = defaultdict(Decimal)
    active_days: dict[date, int] = defaultdict(int)
    for day, units in demand.items():
        if start <= day < end and units > 0:
            month = day.replace(day=1)
            totals[month] += units
            active_days[month] += 1

    indices = [ZERO] * 12
    for cycle in range(2):
        cycle_start = shift_month(start, cycle * 12)
        months = [shift_month(cycle_start, month) for month in range(12)]
        if sum(active_days[month] for month in months) < 6:
            return None

        cycle_days = (shift_month(cycle_start, 12) - cycle_start).days
        cycle_rate = sum((totals[month] for month in months), ZERO) / cycle_days
        for month in months:
            daily_rate = totals[month] / monthrange(month.year, month.month)[1]
            indices[month.month - 1] += 50 * (daily_rate / cycle_rate)

    return [{"month": month, "index": round_one(index)} for month, index in enumerate(indices, 1)]
