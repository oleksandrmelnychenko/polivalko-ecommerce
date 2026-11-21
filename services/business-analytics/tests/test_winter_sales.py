import io
import json
import unittest
from datetime import date
from decimal import Decimal
from unittest.mock import patch

from analytics.offers import compose
from analytics.winter import summarize, season_bounds


class WinterSalesTests(unittest.TestCase):
    def test_partial_weeks_and_profit_coverage_are_independent(self):
        day = date(2026,11,1)
        def row(doc, category, amount, total, cost):
            return dict(id=doc, day=day, account="A", code="x", category=category, amount=amount, total=total, cost=cost)
        weeks = summarize([row("a","Грунти та добавки",30,50,10),row("a","Горщики",20,50,6),
                           row("b","Грунти та добавки",40,40,None),row("c","Грунти та добавки",30,42,10)],
                          day,date(2026,11,3),{"x":Decimal(".4")},"A")
        self.assertEqual(len(weeks),2)
        first = weeks[-1]
        self.assertEqual((first["start"],first["end"]),("2026-11-01","2026-11-01"))
        self.assertEqual((first["kit"]["actual"],first["kit"]["count"]),(34,1))
        self.assertEqual((first["soil"]["ticket"],first["soil"]["known"],first["soil"]["estimate"]),(41,0,16))
        self.assertEqual(first["soil"]["estimated"],1)
        self.assertIsNone(weeks[0]["kit"]["ticket"])
        self.assertEqual(season_bounds(2023,date(2026,11,21))[1],date(2024,2,29))

    def test_model_may_select_only_offered_positions(self):
        facts = [dict(name="Субстрат",category="Ґрунти",purchases=2,related=True)]
        for selection,valid in [([0],True),([1],False),([0,0],False)]:
            generated = json.dumps(dict(intro="Пропонуємо поповнити запас.",selection=selection))
            response = dict(status="completed",output=[dict(type="message",content=[dict(type="output_text",text=generated)])])
            with patch("analytics.offers.urlopen",return_value=io.BytesIO(json.dumps(response).encode())):
                if valid:
                    self.assertEqual(compose(facts,"general","model","key")[1],[0])
                else:
                    with self.assertRaises(ValueError):
                        compose(facts,"general","model","key")
