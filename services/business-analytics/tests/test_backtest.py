import gzip
import io
import tempfile
from contextlib import redirect_stdout
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path
from unittest import TestCase

import simplejson as json

from analytics.backtest import backtest, main

END = date(2026, 11, 19)


def sale(product, week, quantity):
    return dict(day=str(END - timedelta(weeks=week)), org="o", store="s", category="c", product=product, unit="шт",
                name=product, refund=False, qty=Decimal(quantity), amount=Decimal(quantity) * 100)


def snapshot(facts, outages=()):
    return dict(asOf=str(END), facts=facts, outages=list(outages), stocks=[], categories={"c": "Насоси"})


class BacktestTests(TestCase):
    def test_every_fourth_week_of_the_last_year_is_forecast_from_earlier_sales_only(self):
        rows = backtest(snapshot([sale("steady", week, 5) for week in range(120)]))
        self.assertEqual(sum(row["windows"] for row in rows), 13)
        # The newest window starts 27 days before the report day, the oldest 363 days before it.
        self.assertEqual((rows[0]["month"], rows[-1]["month"]), ("2025-11", "2026-10"))
        for row in rows:
            self.assertEqual((row["forecast"], row["flat"]), (dict(bias=0, wape=0), dict(bias=0, wape=0)))
            self.assertEqual(row["missing"], 0)

    def test_a_season_start_shows_the_gain_over_a_flat_average(self):
        # Twelve busy weeks every year. The window that starts with the season is the interesting one.
        def busy(week):
            return (END - timedelta(weeks=week)).isocalendar().week in range(14, 26)

        rows = backtest(snapshot([sale("seasonal", week, 20 if busy(week) else 2) for week in range(156)]))
        april = next(row for row in rows if row["month"] == "2026-04")
        self.assertLess(abs(april["forecast"]["bias"]), 0.15)
        self.assertLess(april["flat"]["bias"], -0.5)

    def test_unknown_weeks_are_not_scored_and_only_the_busiest_products_are_used(self):
        facts = [sale("busy", week, 9) for week in range(120)] + [sale("quiet", week, 1) for week in range(120)]
        day = END - timedelta(weeks=5)
        gap = dict(org="o", store="s", product="busy", day=str(day), through=str(day))
        rows = backtest(snapshot(facts, [gap]), limit=1)
        # One of the thirteen windows of the busy product contains the week without stock.
        self.assertEqual(sum(row["windows"] for row in rows), 12)
        self.assertEqual(sum(row["windows"] for row in backtest(snapshot(facts), limit=2)), 26)

    def test_a_product_without_a_forecast_is_counted_as_missing(self):
        rows = backtest(snapshot([sale("new", week, 5) for week in range(16)]), weeks=8)
        self.assertEqual((sum(row["windows"] for row in rows), sum(row["missing"] for row in rows)), (2, 2))
        self.assertTrue(all(row["forecast"] is None for row in rows))

    def test_command_reads_a_published_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "snapshot.gz"
            with gzip.open(path, "wt", encoding="utf-8") as stream:
                json.dump(snapshot([sale("steady", week, 5) for week in range(120)]), stream)
            output = io.StringIO()
            with redirect_stdout(output):
                main([str(path), "--weeks", "26"])
        text = output.getvalue()
        self.assertIn("2026-10", text)
        self.assertIn(str(END), text)
