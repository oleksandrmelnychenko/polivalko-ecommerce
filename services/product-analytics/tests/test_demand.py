import unittest
from datetime import date, timedelta
from decimal import Decimal

from product_analytics.demand import FORECAST_HISTORY_DAYS, forecast, seasonality


class DemandTests(unittest.TestCase):
    def test_forecast_uses_complete_weekly_history_and_rejects_sparse_demand(self):
        end = date(2026, 10, 31)
        demand = {end - timedelta(days=offset): Decimal(2) for offset in range(FORECAST_HISTORY_DAYS)}
        demand[end + timedelta(days=1)] = Decimal(900)

        report = forecast(demand, end)
        self.assertEqual(report["validationWape"], 0)
        points = report["points"]
        self.assertEqual(len(points), 4)
        self.assertEqual(points[0]["from"], "2026-11-01")
        self.assertEqual(points[-1]["to"], "2026-11-28")
        self.assertTrue(all(point["soldUnits"] == point["low"] == point["high"] == 14 for point in points))
        self.assertIsNone(forecast({end: Decimal(200)}, end))

    def test_forecast_can_select_last_years_pattern(self):
        end = date(2026, 10, 31)
        demand = {end - timedelta(weeks=week): Decimal(30 if week % 4 == 0 else 5) for week in range(66)}

        report = forecast(demand, end, annual_history=True)
        self.assertEqual(report["method"], "year-ago")
        self.assertEqual(report["validationWape"], 0)
        self.assertEqual([point["soldUnits"] for point in report["points"]], [5, 5, 5, 30])

    def test_seasonality_uses_two_full_cycles_and_adjusts_for_month_length(self):
        first = date(2024, 1, 1)
        next_month = date(2026, 1, 1)
        demand = {first + timedelta(days=offset): Decimal(10) for offset in range((next_month - first).days)}
        demand[next_month] = Decimal(900)

        indices = seasonality(demand, first, next_month)
        self.assertEqual(indices, [{"month": month, "index": 100} for month in range(1, 13)])
        self.assertIsNone(seasonality(demand, first + timedelta(days=1), next_month))
