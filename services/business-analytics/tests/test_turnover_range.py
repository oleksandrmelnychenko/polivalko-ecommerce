"""A month's net turnover falls below zero only when returns exceed sales, so the forecast respects that."""
from datetime import date
from decimal import Decimal
from unittest import TestCase

from analytics.turnover import forecast_months, month

TODAY = date(2026, 11, 20)


def projection(value):
    totals = {month(TODAY, -i): Decimal(value(i)) for i in range(40, 0, -1)}
    return forecast_months(totals, TODAY, TODAY, 6)["projection"]


def bursts(i):
    return 2000 if (i * 5) % 7 < 3 else 10


class TurnoverRangeTests(TestCase):
    def test_forecast_and_range_stop_at_zero_when_no_month_in_the_history_was_negative(self):
        for name, value in (("mean of three months", lambda i: (i * i * 37 + i * 911) % 2000), ("regression", bursts)):
            with self.subTest(name):
                points = projection(value)
                self.assertEqual(min(p["low"] for p in points), 0)
                self.assertGreaterEqual(min(p["value"] for p in points), 0)
                self.assertTrue(all(p["low"] <= p["value"] <= p["high"] for p in points))

    def test_range_reaches_the_lowest_month_when_the_history_had_a_negative_one(self):
        points = projection(lambda i: -300 if i == 9 else bursts(i))
        self.assertEqual(min(p["low"] for p in points), -300)
        self.assertLess(min(p["value"] for p in points), 0)
