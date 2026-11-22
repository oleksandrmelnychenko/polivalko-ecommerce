from datetime import date, timedelta
from decimal import Decimal
from unittest import TestCase

from analytics.forecast import VERSION, build_models, fit, predict

SEASON = range(14, 26)


def seasonal(weeks, quiet=2.0, busy=20.0, growth=1.0):
    """Weekly sales with the same thirteen busy weeks every year."""
    return [(busy if week % 52 in SEASON else quiet) * growth ** (week // 52) for week in range(weeks)]


class SeasonalSelectionTests(TestCase):
    def test_season_start_is_forecast_from_the_same_weeks_of_earlier_years(self):
        # The last half-year was quiet, so recent checks alone would pick a flat average of 2.
        model = fit(seasonal(3 * 52 + 14)[-156:], 4)
        self.assertIn(model["model"], ("season52", "seasonScaled", "ridge"))
        self.assertTrue(all(abs(week["value"] - 20) <= 2 for week in model["weeks"]), model["weeks"])
        self.assertEqual((model["folds"], model["seasonFolds"]), (7, 3))

    def test_season_end_is_not_forecast_from_the_busy_weeks(self):
        model = fit(seasonal(3 * 52 + 26)[-156:], 4)
        self.assertTrue(all(abs(week["value"] - 2) <= 1 for week in model["weeks"]), model["weeks"])

    def test_last_years_season_is_scaled_to_the_current_level(self):
        # Sales grow 1.5 times a year: 45 in last year's season, so 67.5 is expected now.
        model = fit(seasonal(3 * 52 + 14, growth=1.5)[-156:], 4)
        self.assertEqual(model["model"], "seasonScaled")
        self.assertTrue(all(abs(week["value"] - 67.5) <= 3 for week in model["weeks"]), model["weeks"])

    def test_scaling_is_bounded_and_needs_twelve_matching_weeks(self):
        self.assertEqual(predict([1.0] * 52 + [9.0] * 52, 4, "seasonScaled"), [18.0] * 4)
        self.assertEqual(predict([9.0] * 52 + [1.0] * 52, 4, "seasonScaled"), [0.5] * 4)
        self.assertIsNone(predict([0.0] * 52 + [5.0] * 52, 4, "seasonScaled"))
        self.assertEqual(predict([5.0] * 64, 4, "seasonScaled"), [5.0] * 4)
        self.assertIsNone(predict([5.0] * 63, 4, "seasonScaled"))
        self.assertIsNone(predict([5.0] * 52 + [None] * 42 + [5.0] * 10, 4, "seasonScaled"))

    def test_an_early_season_does_not_inflate_the_level(self):
        # This year the busy weeks started two weeks earlier. Over a whole year sales are almost
        # unchanged, so last year's weeks are carried over without doubling them.
        history = seasonal(3 * 52 + 14)[-156:]
        history[-2:] = [20.0, 20.0]
        scaled = predict(history, 4, "seasonScaled")
        self.assertTrue(all(20 <= value <= 23 for value in scaled), scaled)

    def test_two_years_of_history_are_still_checked_in_the_same_season(self):
        # The lag regression cannot be trained a year back here, so the simpler models are compared instead.
        model = fit(seasonal(3 * 52 + 14)[-110:], 4)
        self.assertEqual((model["model"], model["seasonFolds"]), ("season52", 3))
        self.assertTrue(all(abs(week["value"] - 20) <= 2 for week in model["weeks"]), model["weeks"])

    def test_interval_covers_errors_seen_in_the_same_season(self):
        # Busy weeks alternate between 16 and 24, and the pattern flips every year, so no model can
        # follow it: each misses by at least four units in season. The quiet half-year before the
        # season has no error at all and would give an interval of zero width on its own.
        history = [value + ((4 if (week + week // 52) % 2 else -4) if week % 52 in SEASON else 0)
                   for week, value in enumerate(seasonal(3 * 52 + 14))][-156:]
        model = fit(history, 4)
        self.assertTrue(all(week["high"] - week["value"] >= 4 for week in model["weeks"]), model["weeks"])

    def test_under_two_years_of_history_is_checked_on_recent_weeks_only(self):
        model = fit(seasonal(3 * 52 + 14)[-90:], 4)
        self.assertIsNotNone(model["model"])
        self.assertEqual(model["seasonFolds"], 0)

    def test_thirteen_week_horizon_does_not_repeat_periods(self):
        model = fit([14.0] * 156, 13)
        self.assertEqual((model["folds"], model["seasonFolds"]), (7, 0))


class OneOffOrderTests(TestCase):
    def test_a_single_bulk_order_last_year_is_not_repeated_in_the_forecast(self):
        history = [10.0] * 156
        history[-51] = 160.0
        self.assertEqual(predict(history, 4, "season52"), [10.0] * 4)
        self.assertLessEqual(max(week["value"] for week in fit(history, 4)["weeks"]), 12)

    def test_a_peak_that_repeats_every_year_is_kept(self):
        history = [2.0] * 156
        for year in (1, 2, 3):
            history[-52 * year + 1] = 60.0
        self.assertEqual(predict(history, 4, "season52"), [2.0, 60.0, 2.0, 2.0])

    def test_a_peak_two_weeks_apart_between_years_still_counts_as_a_repeat(self):
        history = [2.0] * 156
        history[-51] = history[-101] = 60.0
        self.assertEqual(predict(history, 4, "season52")[1], 60.0)

    def test_a_peak_seen_in_one_season_only_is_kept(self):
        history = [2.0] * 100
        history[-51] = 60.0
        self.assertEqual(predict(history, 4, "season52")[1], 60.0)

    def test_a_bulk_order_does_not_move_the_yearly_level(self):
        history = [10.0] * 156
        history[-30] = 400.0
        scaled = predict(history, 4, "seasonScaled")
        self.assertTrue(all(10 <= value <= 11 for value in scaled), scaled)


class UnavailableWeeksTests(TestCase):
    def test_recent_weeks_without_stock_fall_back_to_the_last_known_level(self):
        model = fit([10.0] * 100 + [None] * 3, 4)
        self.assertEqual([week["value"] for week in model["weeks"]], [10.0] * 4)
        self.assertEqual(model["staleWeeks"], 3)
        self.assertIsNone(model["reason"])

    def test_known_weeks_report_no_staleness(self):
        self.assertEqual(fit([10.0] * 100, 4)["staleWeeks"], 0)

    def test_a_long_absence_gives_no_forecast(self):
        model = fit([10.0] * 100 + [None] * 16, 4)
        self.assertEqual(model["weeks"], [])
        self.assertIn("свіжих продажів", model["reason"])

    def test_unknown_weeks_are_not_read_as_zero_demand(self):
        self.assertEqual(predict([6.0] * 30 + [None] * 5, 4, "mean8"), [6.0] * 4)
        self.assertEqual(predict([6.0] * 30 + [None] * 5, 4, "mean4"), [6.0] * 4)
        self.assertIsNone(predict([6.0] * 30 + [None] * 15, 4, "mean8"))


class ModelReuseTests(TestCase):
    def test_reused_models_keep_the_new_fields(self):
        end = date(2026, 11, 19)
        facts = [dict(day=str(end - timedelta(weeks=week)), org="o", store="s", category="c", product="p", unit="шт",
                      name="Насос", refund=False, qty=Decimal(2), amount=Decimal(100)) for week in range(80)]
        snapshot = dict(asOf=str(end), facts=facts, outages=[], stocks=[], categories={"c": "Насоси"})
        first = build_models(snapshot)
        again = build_models(snapshot, dict(snapshot, models=first, version=VERSION))
        self.assertEqual(again, first)
        self.assertTrue(all({"seasonFolds", "staleWeeks"} <= set(model) for model in again))
