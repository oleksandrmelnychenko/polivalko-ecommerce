"""The annual reconciliation lists the till receipts it counts as discrepancies, with the reason for each."""
from datetime import date
from decimal import Decimal
from unittest import TestCase
from unittest.mock import MagicMock, patch

from analytics import invoices
from analytics.invoices import cash_issue, read_year

DAY = date(2026, 3, 5)
ROW = dict(id="r1", number="ЧК-7", day=DAY, header=Decimal(100), lines=Decimal(100), archived=True,
           status_differs=False, source_day=DAY, kyiv_day=None, invalid=0)


def reason(**changes):
    return cash_issue(dict(ROW, **changes))["reason"]


class CashIssueTests(TestCase):
    def test_a_listed_receipt_carries_the_same_fields_as_a_listed_invoice(self):
        issue = cash_issue(dict(ROW, lines=Decimal(90)))
        self.assertEqual(issue, dict(id="r1", number="ЧК-7", day="2026-03-05", header=100, lines=90,
                                     inRegister=True, receipt=True, reason="Суми відрізняються"))

    def test_each_reason_the_count_uses_has_its_own_wording(self):
        self.assertEqual(reason(archived=False, lines=None, source_day=None), "Відсутній запис джерела в архіві")
        self.assertEqual(reason(lines=None), "Відсутні товарні рядки джерела")
        self.assertEqual(reason(header=None), "Недостатньо даних для звірки суми")
        self.assertEqual(reason(status_differs=True), "Статус у реєстрі відрізняється від статусу в архіві")
        self.assertEqual(reason(source_day=date(2026, 3, 4)), "Дата в реєстрі 2026-03-05, дата в архіві 2026-03-04")
        self.assertEqual(reason(kyiv_day=date(2026, 3, 6)), "Дата в реєстрі 2026-03-05, дата джерела за Києвом 2026-03-06")
        self.assertEqual(reason(invalid=2, lines=Decimal(90)), "Суми відрізняються. Є некоректні товарні рядки")

    def test_receipts_are_listed_only_when_the_monthly_count_found_some(self):
        for found in (0, 2):
            with self.subTest(found), patch("analytics.invoices.production") as production, \
                    patch("analytics.invoices.archived_rows", return_value=[]):
                asked = []

                def execute(sql, bounds):
                    asked.append(sql)
                    if sql is invoices.CASH_MONTHS:
                        return [dict(month=3, documents=5, amount=Decimal(500), lines=Decimal(490), discrepancies=found)]
                    if sql is invoices.CASH_ISSUES:
                        return [dict(ROW, lines=Decimal(90)), dict(ROW, id="r2", invalid=1)]
                    return MagicMock(fetchall=lambda: [])

                production.return_value.__enter__.return_value.execute.side_effect = execute
                report = read_year(2026, date(2026, 11, 22))
                self.assertEqual(invoices.CASH_ISSUES in asked, bool(found))
                self.assertEqual([issue["id"] for issue in report["cashIssues"]], ["r1", "r2"][:found])
