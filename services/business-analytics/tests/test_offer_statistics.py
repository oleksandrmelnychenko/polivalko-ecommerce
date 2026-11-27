import os
import unittest
from datetime import date
from unittest.mock import patch

from analytics.invoices import BODY_ACTIVE, BODY_IN_HRYVNIA
from analytics.offer_statistics import HISTORY, SALES, rank, season_window
from analytics.offers import generate


DAY = date(2026, 11, 21)
PARTNER = "00000000-0000-4000-8000-000000000001"


def product(ref, category="Полив"):
    return dict(id=ref, navkolo_id="dntrade-code:"+ref, name=ref, category=category)


def history(purchases=0, weight=0, seasonal=0):
    return dict(purchases=purchases, weight=weight, seasonal=seasonal, last_day=DAY if purchases else None)


class OfferStatisticsTests(unittest.TestCase):
    def test_seasonal_evidence_for_new_customer_and_no_unsupported_fillers(self):
        basis, items = rank([product("A"), product("B"), product("C")],
                            {"dntrade-code:C": history(seasonal=8), "A": history(seasonal=2)}, DAY)
        self.assertEqual(basis, "statistics")
        self.assertEqual([i["id"] for i in items], ["C", "A"])
        self.assertFalse(items[0]["related"])
        self.assertEqual(items[0]["purchases"], 0)
        self.assertIn("11.2025", items[0]["reason"])

    def test_recency_and_matching_both_source_references(self):
        _, items = rank([product("A"), product("B")],
                        {"A": history(4, .5), "B": history(1, .7), "dntrade-code:B": history(1, .1)}, DAY)
        self.assertEqual([(i["id"], i["purchases"]) for i in items], [("B", 2), ("A", 4)])

    def test_missing_signals_produce_labeled_catalog_draft(self):
        basis, items = rank([product("B"), product("A")], {"X": history(5, 5, 9)}, DAY)
        self.assertEqual((basis, items[0]["id"]), ("catalog", "A"))
        self.assertIn("бракує", items[0]["reason"])

    def test_season_windows_roll_over_december_and_cover_leap_february(self):
        self.assertEqual(season_window(date(2026,12,1),1), (date(2025,12,1),date(2026,1,1)))
        self.assertEqual(season_window(date(2025,2,28),1), (date(2024,2,1),date(2024,3,1)))

    def test_statistics_is_local_even_with_a_configured_key(self):
        items = [product("A")]
        with (patch("analytics.offers.production") as db,
              patch("analytics.offers.recommendations", return_value=("statistics", items)),
              patch("analytics.offers.compose") as external,
              patch.dict(os.environ, {"OPENAI_API_KEY":"test", "SALES_OFFER_MODEL":"test"})):
            db.return_value.__enter__.return_value.execute.return_value.fetchone.return_value = {"title":"Контрагент"}
            status, draft = generate(PARTNER, "general", "statistics", DAY)
        external.assert_not_called()
        self.assertEqual((status, draft["mode"], draft["items"]), (200, "statistics", items))

    def test_optional_provider_failure_preserves_ranked_items(self):
        items = [product("B")]
        with (patch("analytics.offers.production"),
              patch("analytics.offers.recommendations", return_value=("statistics", items)),
              patch("analytics.offers.compose", side_effect=TimeoutError),
              patch.dict(os.environ, {"OPENAI_API_KEY":"test", "SALES_OFFER_MODEL":"test"})):
            status, draft = generate(PARTNER, "general", "openai", DAY)
        self.assertEqual((status, draft["mode"], draft["basis"], draft["items"]),
                         (200, "provider-unavailable", "statistics", items))

    def test_sql_checks_body_subtracts_returns_and_rank_matches_case_insensitively(self):
        self.assertIn(BODY_ACTIVE, SALES)
        self.assertIn(BODY_IN_HRYVNIA, SALES)
        self.assertIn("customerReturn", SALES)
        self.assertIn("THEN -1 ELSE 1 END AS sign", HISTORY)
        self.assertIn("lower(item#>>'{product,id}')", HISTORY)
        prod_upper = dict(id="P-1", navkolo_id="DNTrade-Code:XYZ", name="Товар 1", category="Полив")
        prod_fallback = dict(id="P-2", navkolo_id="EXT-UUID-2", name="Товар 2", category="Полив")
        prod_returned = dict(id="P-3", navkolo_id="dntrade-code:ret", name="Товар 3", category="Полив")
        basis, items = rank(
            [prod_upper, prod_fallback, prod_returned],
            {
                "dntrade-code:xyz": history(purchases=2, weight=1.0),
                "ext-uuid-2": history(purchases=1, weight=0.4),
                "dntrade-code:ret": history(purchases=0, weight=0.9),
            },
            DAY,
        )
        self.assertEqual(basis, "statistics")
        self.assertEqual([i["id"] for i in items], ["P-1", "P-2"])
        self.assertEqual(items[0]["purchases"], 2)
