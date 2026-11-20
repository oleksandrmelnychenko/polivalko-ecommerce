import os
import tempfile
import unittest
from datetime import date, timedelta
from decimal import Decimal as D
from io import BytesIO
from pathlib import Path
from unittest.mock import MagicMock, patch

from analytics.forecast import build_models, fit, replenishment
from analytics.invoices import add_cash, compare
from analytics.neon import FrameStream
from analytics.register import apply_inventory_cost, reconcile
from analytics.reports import documents, forecasts, report
from analytics.server import PolicyConflict, Service, app, load, now, save, service
from analytics.source import ARCHIVE, archived_rows, production, target

DAY = date(2026, 11, 19)
PRODUCT = {
    "id": "p",
    "navkolo_id": "dntrade-code:9",
    "sku": "A",
    "name": "Насос",
    "category": "cat",
    "category_name": "Насоси",
    "unit": "шт",
}
REFS = [{"id": "s", "account": "valko-dntrade", "kind": "store", "ref": "store", "title": "Склад"}]


def doc(ref="i", kind="3", day=DAY, qty="2", amount="100", **changes):
    row = {
        "id": ref,
        "ref": ref,
        "account": "valko-dntrade",
        "entity": "invoice",
        "code": kind,
        "day": day,
        "kind": None,
        "status": "active",
        "currency": "UAH",
        "total": abs(D(amount)),
        "store_ids": ["store"],
        "org": None,
        "number": ref,
        "products": [{"product": {"code": "9"}, "quantity": qty, "total": amount}],
    }
    return dict(row, **changes)


def snapshot(rows, web=()):
    s = reconcile(rows, web, [PRODUCT], REFS, DAY)
    s.update(stocks=[], outages=[], version="test")
    s["models"] = build_models(s)
    return s


class RegisterTests(unittest.TestCase):
    def test_archive_pages_continue_after_the_last_document_on_the_same_day(self):
        conn = MagicMock()
        payload = '{"providerTypeCode":3,"raw":{"number":42,"products":[{"total":10.123456789123456789}]}}'
        ids = [f"00000000-0000-0000-0000-{i:012d}" for i in range(129)]
        rows = [dict(id=key, day=DAY, entity="invoice", payload=payload) for key in ids]
        rows[-1]["entity"] = "order"
        conn.execute.return_value.fetchall.side_effect = [rows[:128], rows[128:]]
        result = list(archived_rows(conn, ARCHIVE, (DAY,)))
        self.assertEqual([row["id"] for row in result], ids)
        self.assertEqual(result[0]["products"][0]["total"], D("10.123456789123456789"))
        self.assertEqual(result[0]["number"], "42")
        self.assertIsNone(result[-1]["products"])
        second_query, second_params = conn.execute.call_args.args
        self.assertIn("(r.source_day, r.id) >", second_query)
        self.assertEqual(second_params, (DAY, DAY, ids[127], 128))

    def test_cash_turnover_combines_receipts_invoices_and_returns_with_empty_months(self):
        sale, returned = doc(), doc("r", kind="7", amount="-25")
        annual = compare(DAY.year, [sale, returned], [sale, returned])
        add_cash(annual, [{"month": 1, "amount": D("10.50"), "lines": D("10.50"), "documents": 2,
                           "discrepancies": 0}])
        self.assertEqual(annual["months"][0]["documentNet"], D("10.50"))
        self.assertIsNone(annual["months"][1]["documentNet"])
        self.assertEqual(annual["total"]["documentNet"], D("85.50"))
        self.assertEqual(annual["total"]["documentLineNet"], D("85.50"))

    def test_register_uses_dntrade_native_invoice_and_return_codes_without_envelope(self):
        sale, refund = doc("a"), doc("b", kind="7", amount="-25")
        headers = [dict(sale, kind="out", code=None), dict(refund, kind="back", code=None)]
        result = compare(DAY.year, headers, [sale, refund])["total"]
        self.assertEqual((result["documents"], result["net"], result["discrepancies"]), (2, 75, 0))
        shifted = compare(DAY.year, [headers[0]], [dict(sale, day=DAY + timedelta(days=1))])
        self.assertIn("дата джерела за Києвом", shifted["issues"][0]["reason"])
        self.assertEqual(shifted["total"]["difference"], 0)

    def test_annual_invoice_control_detects_offsetting_errors_and_missing_source(self):
        first, returned = doc("1"), doc("2", kind="7", amount="-25")
        headers = [dict(first, total=D(110)), dict(returned, total=D(35))]
        annual = compare(DAY.year, headers, [first, returned, doc("receipt", kind="6")])
        self.assertEqual(annual["total"]["net"], 75)
        self.assertEqual(annual["total"]["lineNet"], 75)
        self.assertEqual(annual["total"]["discrepancies"], 2)
        self.assertEqual(annual["months"][DAY.month - 1]["documents"], 2)
        self.assertIsNone(annual["months"][0]["net"])
        self.assertEqual(compare(DAY.year, [first], [])["total"]["discrepancies"], 1)
        self.assertIsNone(compare(DAY.year, [dict(first, total=None)], [])["total"]["net"])
        self.assertEqual(compare(DAY.year, [first], [first])["total"]["discrepancies"], 0)

    def test_reconciles_alias_receipt_partial_order_and_return(self):
        invoice = doc(parent="web")
        invoice["products"][0]["cogs_total"] = "60"
        web = {
            "order_id": "web",
            "number": "N",
            "upstream": None,
            "day": DAY,
            "product": "p",
            "name": "Насос",
            "sku": "A",
            "quantity": 3,
            "total": D(150),
            "org": None,
            "store": "s",
            "id": "web",
            "refund": False,
        }
        s = snapshot(
            [
                invoice,
                doc("dup", external="i", kind="6"),
                doc("receipt", "6", parent="i"),
                doc("return", "7", qty="-1", amount="-50", parent="receipt"),
            ],
            [web],
        )
        result = report(s, {})["summary"]
        self.assertEqual(
            (result["gross"], result["returns"], result["net"], result["profit"]), (150, 50, 100, 20)
        )
        self.assertEqual(result["coverage"], D(".75"))
        self.assertEqual(s["diagnostics"]["linkedReceipts"], 1)
        self.assertEqual(documents(s, {"product": "p"})["total"], 3)

    def test_draft_other_currency_purchases_and_empty_excluded(self):
        s = snapshot(
            [
                doc(status="draft"),
                doc("other", "4"),
                doc("foreign", currency="EUR"),
                doc("missing", products=[]),
                doc("unverified", status=None),
            ]
        )
        self.assertEqual(len(s["facts"]), 0)
        self.assertEqual(s["diagnostics"]["unverifiedDocuments"], 2)

    def test_unknown_store_not_distributed(self):
        s = snapshot([doc(store_ids=["a", "b"])])
        self.assertEqual(s["facts"][0]["store"], "unknown")
        self.assertIsNone(report(s, {})["summary"]["profit"])

    def test_corrected_and_deleted_sources_replace_facts(self):
        self.assertEqual(report(snapshot([doc(amount="225")]), {})["summary"]["net"], 225)
        self.assertEqual(snapshot([])["facts"], [])
        self.assertEqual(snapshot([doc(), doc()])["audits"], snapshot([doc()])["audits"])

    def test_kyiv_day_and_partial_yoy(self):
        rows = [
            doc("a", day=date(2025, 11, 19)),
            doc("b", day=date(2025, 11, 20)),
            doc("late", day=DAY, source_date="2026-11-19T23:30:00Z"),
            doc("c", day=DAY),
        ]
        r = report(snapshot(rows), {"from": "2026-11-01", "to": "2026-11-19"})
        self.assertEqual(r["previous"]["net"], 100)
        self.assertEqual(r["summary"]["net"], 100)

    def test_month_without_documents_is_unknown(self):
        r = report(snapshot([doc()]), {"from": "2026-10-01"})
        self.assertIsNone(r["months"][0]["current"])
        self.assertIsNone(r["heatmap"][0]["months"][9])

    def test_moving_average_and_unvalued_opening(self):
        def event(day, doc, delta, balance, purchase=None):
            return {
                "day": day,
                "org": "o",
                "store": "s",
                "product": "p",
                "doc": doc,
                "delta": D(delta),
                "balance": D(balance),
                "purchase": None if purchase is None else D(purchase),
            }

        def line(key):
            return {
                "doc": key,
                "org": "o",
                "store": "s",
                "product": "p",
                "unit": "шт",
                "refund": False,
                "cost": None,
                "qty": D(2),
            }

        facts = [line("unknown"), line("sale"), dict(line("ret"), refund=True, original="sale", qty=D(1))]
        events = [
            event(1, "unknown", -2, 0),
            event(2, "in", 10, 10, 50),
            event(3, "in2", 10, 20, 150),
            event(4, "sale", -2, 18),
        ]
        apply_inventory_cost(facts, events)
        self.assertEqual([r["cost"] for r in facts], [None, 20, 10])

    def test_seasonality_normalizes_growth_and_excludes_partial_year(self):
        rows = [
            doc(f"{y}-{m}", day=date(y, m, 1), amount=str((2 if m == 6 else 1) * scale))
            for y, scale in ((2024, 100), (2025, 1000))
            for m in range(1, 13)
        ]
        rows.append(doc("partial", day=DAY, amount="50000"))
        heat = report(snapshot(rows), {})["heatmap"][0]
        self.assertEqual(heat["years"], 2)
        self.assertAlmostEqual(float(heat["indices"][5]), 2 * float(heat["indices"][0]))


class ModelTests(unittest.TestCase):
    def test_four_and_thirteen_week_backtests(self):
        for horizon in [4, 13]:
            model = fit([14.0] * 100, horizon)
            self.assertEqual(len(model["weeks"]), horizon)
            self.assertEqual(model["bias"], 0)
            self.assertEqual(model["wape"], 0)
            self.assertTrue(all(p["low"] <= p["value"] <= p["high"] for p in model["weeks"]))

    def test_holdout_is_never_used_to_fit_its_own_prediction(self):
        model = fit([10.0] * 90 + [20.0] * 4, 4)
        self.assertEqual(model["wape"], 0.5)
        self.assertEqual(model["bias"], -0.5)

    def test_sparse_missing_and_stockout(self):
        self.assertFalse(fit([None, 0, 0, 1] * 4, 4)["weeks"])
        s = snapshot([doc(str(i), day=DAY - timedelta(weeks=i)) for i in range(80)])
        s["outages"] = [{"org": "unknown", "store": "s", "product": "p", "day": str(DAY)}]
        models = build_models(s)
        sku = next(m for m in models if m["kind"] == "sku")
        self.assertIsNone(sku["history"][-1])
        self.assertEqual(sku["stockoutWeeks"], 1)
        self.assertEqual({m["unit"] for m in models if m["kind"] == "category"}, {"грн", "шт"})

    def test_dated_deliveries_and_horizon(self):
        start = DAY + timedelta(days=1)
        policy = {
            "lead": 2,
            "review": 5,
            "safety": 0,
            "confirmed": str(start),
            "deliveries": [{"day": str(start + timedelta(days=6)), "qty": 20}],
        }
        stock = {"quantity": D(5), "reserved": D(2)}
        model = fit([14.0] * 80, 4)
        r = replenishment(model, stock, policy, start, start)
        self.assertEqual(r["available"], 3)
        self.assertEqual(r["stockout"], str(start + timedelta(days=1)))
        self.assertEqual(r["order"], 9)
        for invalid in [None, dict(policy, lead=30), dict(policy, confirmed=str(DAY))]:
            self.assertIsNone(replenishment(model, stock, invalid, start, start)["order"])
        self.assertIsNone(replenishment(model, None, policy, start, start)["order"])

    def test_published_snapshot_roundtrip(self):
        s = snapshot([doc(str(i), day=DAY - timedelta(weeks=i)) for i in range(80)])
        s["stocks"] = [
            {"org": "unknown", "store": "s", "product": "p", "quantity": D("3.3"), "reserved": D("1.1")}
        ]
        with tempfile.TemporaryDirectory() as directory:
            p = Path(directory) / "snap.gz"
            save(p, s)
            loaded = load(p, None)
            self.assertEqual(report(loaded, {})["summary"], report(s, {})["summary"])
            self.assertEqual(
                forecasts(loaded, {}, {}, DAY + timedelta(days=1))["rows"][0]["purchase"]["available"], 2.2
            )


class ConnectionTests(unittest.TestCase):
    def test_hosted_connection_requires_exact_project_production_neon_and_read_only(self):
        env = dict(ANALYTICS_PRODUCTION_PROJECT="project", VERCEL_PROJECT_ID="project",
                   VERCEL_ENV="production", PGHOST_UNPOOLED="ep-example.neon.tech", PGDATABASE="app",
                   PGUSER="analytics", PGPASSWORD="fixture")
        with patch.dict(os.environ, env, clear=True), patch("analytics.source.socket.getaddrinfo",
                return_value=[(0, 0, 0, "", ("192.0.2.10", 5432))]):
            args = target()
            self.assertEqual(args["sslmode"], "verify-full")
            self.assertNotIn("options", args)
            with patch("analytics.neon.connect") as connect:
                connection = connect.return_value.__enter__.return_value
                connection.execute.return_value.fetchone.return_value = {"db": "app", "ro": "on"}
                with production():
                    self.assertEqual(connection.execute.call_args_list[0].args,
                                     ("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY",))
            for override in ({"VERCEL_ENV": "preview"}, {"VERCEL_PROJECT_ID": "other"},
                             {"PGSERVICE": "local"}, {"PGHOST_UNPOOLED": "localhost"}):
                with patch.dict(os.environ, override), self.assertRaises(ValueError):
                    target()

    def test_websocket_binary_frames_preserve_postgres_stream_boundaries(self):
        ws = MagicMock()
        ws.recv.side_effect = [b"ab", b"cdef", b""]
        stream = FrameStream(ws).makefile("rwb")
        self.assertEqual(stream.read(3), b"abc")
        self.assertEqual(stream.read(), b"def")
        stream.write(b"query")
        stream.flush()
        ws.send_binary.assert_called_once_with(b"query")
        stream.close()
    def test_other_cluster_rejected_before_reading_registers(self):
        environment = {"PRODUCTION_ANALYTICS_CLUSTER_ID": "123", "PRODUCTION_ANALYTICS_DATABASE": "sales"}
        connection = MagicMock()
        connection.execute.return_value.fetchone.side_effect = [{"db": "sales", "ro": "on"}, {"id": "999"}]
        with (
            patch.dict(os.environ, environment, clear=True),
            patch("analytics.source.target", return_value={}),
            patch("analytics.source.set_json_loads"),
            patch("analytics.source.psycopg.connect") as connect,
        ):
            connect.return_value.__enter__.return_value = connection
            with self.assertRaises(RuntimeError), production():
                self.fail("Read a register on the wrong cluster")
            self.assertEqual(connection.execute.call_count, 3)

    def test_policy_publication_is_atomic_and_conflicting_edit_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            instance = Service()
            instance.directory = Path(directory)
            instance.snapshot = snapshot([doc()])
            row = next(r for r in instance.snapshot["models"] if r["kind"] == "sku")
            data = dict(row, lead=2, review=7, safety=1, confirmed=str(now().date()), deliveries=[])
            self.assertEqual(instance.set_policy(data)["revision"], 1)
            with self.assertRaises(PolicyConflict):
                instance.set_policy(data)
            with self.assertRaises(ValueError):
                instance.set_policy(
                    dict(data, revision=1, deliveries=[{"day": str(now().date()), "qty": -10}])
                )
            self.assertEqual(load(instance.directory / "policies.gz", None), instance.policies)

    def test_refresh_failure_keeps_published_projection(self):
        instance = Service()
        with tempfile.TemporaryDirectory() as directory:
            instance.directory = Path(directory)
            with patch.object(instance.wake, "wait", side_effect=StopIteration):
                with (
                    patch("analytics.server.read_register", return_value=snapshot([doc()])),
                    self.assertRaises(StopIteration),
                ):
                    instance.worker()
                first = instance.snapshot
                with (
                    patch("analytics.server.read_register", side_effect=RuntimeError("unavailable")),
                    self.assertLogs(level="ERROR"),
                    self.assertRaises(StopIteration),
                ):
                    instance.worker()
                self.assertIs(first, instance.snapshot)
                self.assertEqual(load(instance.directory / "run.gz", {})["state"], "error")
                self.assertEqual(
                    report(load(instance.directory / "snapshot.gz", {}), {})["summary"]["net"], 100
                )

    def test_target_fails_closed_without_config(self):
        with (
            patch.dict(os.environ, {"DATABASE_URL": "postgres://localhost/dev"}, clear=True),
            self.assertRaises(KeyError),
        ):
            target()

    def test_rejects_wrong_host_name_socket_loopback_tls_and_libpq_overrides(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "dsn"
            env = {
                "PRODUCTION_ANALYTICS_DSN_FILE": str(path),
                "PRODUCTION_ANALYTICS_HOST": "prod.example",
                "PRODUCTION_ANALYTICS_DATABASE": "sales",
            }
            with patch.dict(os.environ, env, clear=True):
                for dsn in [
                    "host=localhost dbname=sales user=ro",
                    "host=prod.example dbname=dev user=ro",
                    "dbname=sales user=ro",
                    "host=prod.example hostaddr=127.0.0.1 dbname=sales user=ro",
                    "host=prod.example dbname=sales user=ro sslmode=disable",
                ]:
                    path.write_text(dsn)
                    with self.assertRaises(ValueError):
                        target()
                path.write_text("host=prod.example dbname=sales user=ro")
                with (
                    patch(
                        "analytics.source.socket.getaddrinfo",
                        return_value=[(0, 0, 0, "", ("127.0.0.1", 5432))],
                    ),
                    self.assertRaises(ValueError),
                ):
                    target()
                with patch(
                    "analytics.source.socket.getaddrinfo", return_value=[(0, 0, 0, "", ("192.0.2.10", 5432))]
                ):
                    args = target()
                    self.assertIn("default_transaction_read_only=on", args["options"])
                    self.assertEqual(args["sslmode"], "verify-full")

    def test_wsgi_no_snapshot_and_forbidden_operation(self):
        def call(path):
            status = []
            body = app(
                {"REQUEST_METHOD": "GET", "PATH_INFO": path, "wsgi.input": BytesIO()},
                lambda s, h: status.append(s),
            )
            self.assertTrue(body)
            return status[0]

        with patch.object(service, "snapshot", None):
            self.assertTrue(call("/health/live").startswith("200"))
            self.assertTrue(call("/report").startswith("503"))
            self.assertTrue(call("/sql").startswith("404"))
