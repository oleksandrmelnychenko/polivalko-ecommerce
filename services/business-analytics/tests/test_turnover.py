import unittest
from datetime import date
from decimal import Decimal
from unittest.mock import patch

from analytics.forecast import fit, predict
from analytics.reports import forecasts
from analytics.server import dispatch
from analytics.turnover import forecast_months, month, predict as predict_turnover, read_history


TODAY = date(2026, 11, 20)


def series(count=72):
    return {month(TODAY, -i): Decimal(100 + month(TODAY, -i).month**2) for i in range(count, 0, -1)}


class TurnoverTests(unittest.TestCase):
    def test_same_month_last_year_beats_recent_mean_on_seasonal_data(self):
        for horizon in (3, 6, 12):
            report = forecast_months(series(), TODAY, TODAY, horizon)
            self.assertEqual(report["model"], "season")
            self.assertEqual(report["wape"], 0)
            self.assertEqual(len(report["projection"]), horizon)
            self.assertEqual(report["projection"][0]["month"], "2026-11-01")
            self.assertEqual(report["trainingMonths"], 72)
            self.assertEqual({m["model"] for m in report["comparisons"]}, {"recent", "season", "scaledSeason", "ridge"})

    def test_scaled_season_learns_change_in_level_without_future_values(self):
        year = [8., 16., 24., 32.] * 3
        history = year + [v * 1.5 for v in year]
        self.assertEqual(predict_turnover(history, 6, "scaledSeason"), [v * 2.25 for v in year[:6]])

    def test_no_holdout_leakage_or_partial_month(self):
        totals = series()
        before = forecast_months(totals, TODAY, TODAY, 6)
        for i in range(1, 7):
            totals[month(TODAY, -i)] += 10000
        totals[month(TODAY)] = Decimal("99999")
        after = forecast_months(totals, TODAY, TODAY, 6)
        self.assertEqual(before["model"], after["model"])
        self.assertEqual([p["value"] for p in before["validation"]], [p["value"] for p in after["validation"]])
        self.assertEqual([m["mae"] for m in before["comparisons"]], [m["mae"] for m in after["comparisons"]])
        self.assertNotEqual(before["wape"], after["wape"])
        self.assertEqual(after["history"][-1]["month"], "2026-10-01")

    def test_missing_month_and_partial_archive_end(self):
        totals = series()
        totals[month(TODAY, -4)] = None
        report = forecast_months(totals, TODAY, TODAY, 6)
        self.assertEqual(report["trainingMonths"], 3)
        self.assertEqual(report["projection"], [])
        archived = forecast_months(series(), date(2026, 8, 8), TODAY, 3)
        self.assertEqual(archived["projection"][0]["month"], "2026-08-01")
        self.assertEqual(archived["staleMonths"], 3)

    def test_short_series_zero_validation_and_insufficient_intervals(self):
        totals = dict.fromkeys(series(8), Decimal(0))
        report = forecast_months(totals, TODAY, TODAY, 12)
        self.assertIsNone(report["wape"])
        self.assertIsNone(report["projection"][-1]["low"])
        self.assertEqual(report["mae"], 0)
        self.assertEqual(report["projection"][-1]["value"], 0)

    def test_header_and_cash_aggregation_matches_document_signs(self):
        key = date(2025, 1, 1)
        base = dict(month=key, last_day=key, account="source", kind="out", status="active", currency="UAH", invalid=0)
        with patch("analytics.turnover.production") as production:
            production.return_value.__enter__.return_value.execute.side_effect = [
                [dict(base, amount=110), dict(base, kind="back", amount=22), dict(base, status="draft", amount=1000)],
                [dict(base, amount=9)],
            ]
            history, latest = read_history(TODAY)
        self.assertEqual(history[key], 97)
        self.assertEqual(latest, key)

    def test_authenticated_proxy_target_routes_without_full_snapshot(self):
        env = dict(REQUEST_METHOD="GET", PATH_INFO="/forecast", QUERY_STRING="kind=turnover&horizon=3")
        with patch("analytics.server.history_for", return_value=(series(), TODAY)), patch("analytics.server.now") as now:
            now.return_value.date.return_value = TODAY
            status, result = dispatch(env)
        self.assertEqual(status, 200)
        self.assertEqual(len(result["projection"]), 3)
        with self.assertRaises(ValueError):
            dispatch(dict(env, QUERY_STRING="kind=turnover&horizon=9"))

    def test_weekly_zero_sales_are_tested_and_outages_are_unknown(self):
        result = fit([8.] * 100 + [0.] * 4, 4)
        self.assertIsNone(result["wape"])
        self.assertEqual(result["folds"], 7)
        self.assertIsNone(predict([4.] * 70 + [None], 4, "ridge"))
        self.assertIsNone(predict([4.] * 70 + [None], 4, "intermittent"))
        self.assertEqual(predict([4.] * 80, 4, "ridge"), [4.] * 4)
        self.assertEqual(predict([4.] * 20, 4, "ridgeRecent"), [4.] * 4)
        self.assertEqual(predict([4.] * 18 + [None, 4.], 4, "intermittent"), [4.] * 4)

    def test_recent_regression_can_win_before_a_second_year_of_sales(self):
        model = fit([3., 9.] * 26, 4)
        self.assertEqual(model["model"], "ridgeRecent")
        self.assertLess(model["wape"], model["baselineWape"])

    def test_weekly_coverage_counts_matched_series_before_pagination(self):
        base = dict(kind="sku", org="o", store="s", unit="шт", category="c", weeks=[], model=None)
        models = [dict(base, product=str(i), name="A" + str(i)) for i in range(47)]
        models.append(dict(base, name="Z", product="z", model="ridge", weeks=[{"value": 5}]))
        snapshot = dict(asOf=str(TODAY), stocks=[], models=models, version="test", categories={}, locations={})
        result = forecasts(snapshot, {}, {}, TODAY)
        self.assertEqual(result["total"], 48)
        self.assertEqual(result["coverage"], {"ready": 1, "regression": 1, "intermittent": 0})
        self.assertEqual(result["rows"][0]["product"], "z")
        self.assertEqual(result["options"]["store"], [{"value": "s", "label": "s"}])
