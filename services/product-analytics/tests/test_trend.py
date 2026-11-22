import unittest
from datetime import date, timedelta
from decimal import Decimal

from product_analytics.report import Sale, trend

END = date(2026, 11, 21)


def daily(days):
    start = END - timedelta(days=days - 1)
    rows = [Sale(start + timedelta(days=offset), "p", None, "Товар", "SKU", Decimal(1), Decimal(0), Decimal(10), Decimal(0))
            for offset in range(days)]
    return trend(rows, start, END, start, END)


class TrendBucketTests(unittest.TestCase):
    def test_last_bar_is_a_whole_step_and_the_remainder_is_the_first_bar(self):
        for days, step, first in ((90, 7, 6), (180, 7, 5), (365, 14, 1)):
            units = [bar["soldUnits"] for bar in daily(days)]
            self.assertEqual((units[0], set(units[1:]), sum(units)), (first, {step}, days))

    def test_bars_cover_the_period_without_gaps_or_overlaps(self):
        bars = daily(90)
        self.assertEqual((bars[0]["from"], bars[-1]["to"]), ((END - timedelta(days=89)).isoformat(), END.isoformat()))
        for earlier, later in zip(bars, bars[1:]):
            self.assertEqual(date.fromisoformat(later["from"]) - date.fromisoformat(earlier["to"]), timedelta(days=1))

    def test_daily_bars_are_unchanged(self):
        bars = daily(30)
        self.assertEqual([bar["from"] for bar in bars], [bar["to"] for bar in bars])
        self.assertEqual((len(bars), bars[0]["from"], bars[-1]["to"]), (30, (END - timedelta(days=29)).isoformat(), END.isoformat()))


if __name__ == "__main__":
    unittest.main()
