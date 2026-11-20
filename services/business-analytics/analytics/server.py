import gzip
import logging
import os
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from threading import Event, Lock, Thread
from time import monotonic
from urllib.parse import parse_qs

import simplejson as json

from .forecast import VERSION, build_models
from .register import KYIV
from .reports import documents, forecasts, policy_key, report
from .source import hosted, read_register
from .invoices import read_year
from .turnover import forecast_months, history_for
from .markets import markets

logger = logging.getLogger(__name__)


def now():
    return datetime.now(KYIV)


def save(path, value):
    temporary = path.with_suffix(".tmp")
    with temporary.open("wb") as stream:
        with gzip.open(stream, "wt", encoding="utf-8") as zipped:
            json.dump(value, zipped, ensure_ascii=False, separators=(",", ":"))
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, path)


def load(path, default):
    if not path.exists():
        return default
    with gzip.open(path, "rt", encoding="utf-8") as stream:
        return json.load(stream, use_decimal=True)


class PolicyConflict(Exception):
    pass


class Service:
    def __init__(self):
        self.lock = Lock()
        self.compute_lock = Lock()
        self.retry_after = 0
        self.wake = Event()
        self.snapshot = None
        self.policies = {}
        self.status = {"state": "waiting", "updated": None, "error": None, "version": VERSION}

    def start(self):
        if hosted():
            return
        from hashlib import sha256

        # Never serve a snapshot from another configured production database.
        identity = json.dumps(
            [
                os.environ["PRODUCTION_ANALYTICS_HOST"],
                os.environ["PRODUCTION_ANALYTICS_DATABASE"],
                os.environ.get("PRODUCTION_ANALYTICS_CLUSTER_ID", "").strip(),
            ]
        )
        self.directory = Path("/var/lib/business-analytics") / sha256(identity.encode()).hexdigest()[:24]
        self.directory.mkdir(mode=0o700, exist_ok=True)
        self.policies = load(self.directory / "policies.gz", {})
        self.status = load(self.directory / "run.gz", self.status)
        snapshot = load(self.directory / "snapshot.gz", None)
        if snapshot and snapshot.get("version") == VERSION:
            self.snapshot = snapshot
            self.status["updated"] = snapshot["updated"]
        Thread(target=self.worker, daemon=True, name="business-report-publisher").start()

    def current(self, models=False, force=False):
        if not hosted():
            return self.snapshot
        day = now().date() - timedelta(days=1)
        with self.compute_lock:
            try:
                snapshot = self.snapshot
                if (force or not snapshot or snapshot["asOf"] != str(day)) and monotonic() >= self.retry_after:
                    self.status = dict(self.status, state="running", error=None)
                    snapshot = read_register(day)
                    snapshot.update(models=[], modelsReady=False, version=VERSION, updated=now().isoformat())
                    self.snapshot = snapshot
                if snapshot and models and not snapshot["modelsReady"]:
                    snapshot = dict(snapshot, models=build_models(snapshot), modelsReady=True)
                    self.snapshot = snapshot
                if snapshot and snapshot["asOf"] == str(day) and monotonic() >= self.retry_after:
                    self.status = dict(self.status, state="ready", updated=snapshot["updated"], error=None)
            except Exception as exc:
                logger.error("Production report unavailable (%s)", type(exc).__name__)
                self.retry_after = monotonic() + 30
                self.status = dict(self.status, state="error", error="Не вдалося оновити виробничий звіт")
            return self.snapshot

    def refresh(self):
        with self.lock:
            if self.status["state"] not in {"queued", "running"}:
                self.status = dict(self.status, state="queued")
                self.wake.set()
            return dict(self.status)

    def worker(self):
        while True:
            with self.lock:
                self.wake.clear()
                self.status = dict(self.status, state="running", error=None)
            try:
                snapshot = read_register(now().date() - timedelta(days=1))
                snapshot.update(
                    models=build_models(snapshot, self.snapshot),
                    version=VERSION,
                    updated=now().isoformat(timespec="seconds"),
                )
                save(self.directory / "snapshot.gz", snapshot)
                with self.lock:
                    self.snapshot = snapshot
                    self.status = dict(self.status, state="ready", updated=snapshot["updated"])
                current = now()
                next_run = current.replace(hour=2, minute=15, second=0, microsecond=0)
                if next_run <= current:
                    next_run += timedelta(days=1)
                delay = next_run.timestamp() - current.timestamp()
            except Exception as exc:  # noqa: BLE001 -- preserve the last snapshot and retry failed background jobs.
                # Driver messages can include connection details. Expose only the class.
                logger.error("Production analytics refresh failed (%s)", type(exc).__name__)
                with self.lock:
                    self.status = dict(
                        self.status, state="error", error="Не вдалося прочитати й обробити виробничий регістр"
                    )
                delay = 300
            try:
                save(self.directory / "run.gz", self.status)
            except OSError:
                logger.error("Could not persist refresh status")
            self.wake.wait(delay)

    def set_policy(self, data):
        if not isinstance(data, dict):
            raise TypeError("Очікується об’єкт налаштувань")
        if not all(
            isinstance(data.get(k), str) and len(data[k]) <= 512 for k in ("org", "store", "product", "unit")
        ):
            raise ValueError("Вкажіть товар і склад")
        for field in ("lead", "review", "safety"):
            if type(data.get(field)) is not int or not (int(field == "review") <= data[field] <= 365):
                raise ValueError("Перевірте дні поставки, перегляду й резерву")
        today = now().date()
        items = data.get("deliveries")
        if data.get("confirmed") != str(today) or not isinstance(items, list) or len(items) > 100:
            raise ValueError("Підтвердьте список надходжень на сьогодні")
        deliveries = []
        for item in items:
            if not isinstance(item, dict) or not isinstance(item.get("day"), str):
                raise TypeError("Перевірте дату надходження")
            day = date.fromisoformat(item["day"])
            qty = item.get("qty")
            if day < today or type(qty) not in (int, Decimal) or not 0 < qty <= 10**12:
                raise ValueError("Перевірте дату й кількість надходження")
            deliveries.append({"day": str(day), "qty": qty})
        policy = {k: data[k] for k in ("lead", "review", "safety", "confirmed")}
        policy["deliveries"] = deliveries
        with self.lock:
            key = policy_key(data)
            if not self.snapshot or not any(
                m["kind"] == "sku" and policy_key(m) == key for m in self.snapshot["models"]
            ):
                raise ValueError("Рядок прогнозу не знайдено")
            version = self.policies.get(key, {}).get("revision", 0)
            if data.get("revision", 0) != version:
                raise PolicyConflict()
            policy["revision"] = version + 1
            new = dict(self.policies)
            new[key] = policy
            save(self.directory / "policies.gz", new)
            self.policies = new
        return policy


service = Service()


def dispatch(env):
    route = (env["REQUEST_METHOD"], env["PATH_INFO"])
    if route == ("GET", "/health/live"):
        return 200, {"status": "ok"}
    if route == ("GET", "/checks/last-closed-year"):
        year = now().year - 1
        try:
            annual = read_year(year)
            totals = annual["total"]
        except Exception as exc:
            details = exc.args[0] if exc.args and isinstance(exc.args[0], dict) else {}
            logger.error("Annual invoice check failed (%s, SQLSTATE %s)", type(exc).__name__,
                         getattr(exc, "sqlstate", None) or details.get("C"))
            return 503, {"status": "unavailable"}
        result = "empty"
        if totals["discrepancies"] or totals["cashDiscrepancies"]:
            result = "differences"
        elif totals["documents"] or totals["cashDocuments"]:
            result = "matched"
        logging.getLogger("gunicorn.error").info("Annual invoice check completed (year=%s, result=%s)", year, result)
        # Verify the forecast's independent monthly input against the annual check
        # on rollout. A forecast failure must not change the annual check result.
        try:
            today = now().date()
            history, latest = history_for(today)
            matched = all(history.get(date(year, i, 1)) == period["documentNet"]
                          for i, period in enumerate(annual["months"], 1))
            forecast = forecast_months(history, latest, today, 6)
            logging.getLogger("gunicorn.error").info(
                "Turnover forecast checked (year=%d, ledger=%s, months=%d, last=%s, model=%s, points=%d, "
                "test=%d, wape=%s, baseline=%s, ridge=%s)",
                year, "matched" if matched else "differences", forecast["trainingMonths"], latest,
                forecast["model"], len(forecast["projection"]), len(forecast["validation"]), forecast["wape"],
                forecast["baselineWape"], next((m["holdoutWape"] for m in forecast["comparisons"]
                                                if m["model"] == "ridge"), None))
        except Exception as exc:
            logger.error("Turnover forecast check unavailable (%s)", type(exc).__name__)
        return 200, {"year": year, "status": result}
    if route == ("GET", "/status"):
        return 200, dict(service.status, policiesWritable=not hosted())
    if route == ("POST", "/refresh"):
        if hosted():
            service.current(force=True)
            return (503 if service.status["state"] == "error" else 200), service.status
        return 202, service.refresh()
    if route == ("PUT", "/policy"):
        if hosted():
            return 503, {"title": "Збереження умов закупівлі потребує постійного приватного сховища"}
        size = int(env.get("CONTENT_LENGTH") or 0)
        if not 0 < size <= 16384:
            return 400, {"title": "Перевірте розмір налаштувань"}
        return 200, service.set_policy(json.loads(env["wsgi.input"].read(size), use_decimal=True))
    handlers = {"/report": report, "/documents": documents}
    if route[0] != "GET" or route[1] not in (*handlers, "/forecast"):
        return 404, {"title": "Операцію не знайдено"}
    q = {k: v[-1] for k, v in parse_qs(env.get("QUERY_STRING", ""), max_num_fields=20).items()}
    if route[1] == "/documents" and q.get("analysis") == "markets":
        today = now().date()
        year, page = int(q.get("year", today.year)), int(q.get("page", 1))
        if (set(q) - {"analysis", "year", "page", "search"} or not 1900 <= year <= today.year
                or not 1 <= page <= 1000000 or len(q.get("search", "")) > 120):
            raise ValueError("Перевірте рік, номер сторінки та пошук")
        try:
            return 200, markets(year, today, page, q.get("search", ""))
        except Exception as exc:
            logger.error("Buyer geography unavailable (%s)", type(exc).__name__)
            return 503, {"title": "Не вдалося прочитати продажі за контрагентами та регіонами"}
    if route[1] == "/forecast" and q.get("kind") == "turnover":
        horizon = int(q.get("horizon", 6))
        if set(q) - {"kind", "horizon"} or horizon not in (3, 6, 12):
            raise ValueError("Виберіть горизонт у 3, 6 або 12 місяців")
        today = now().date()
        try:
            history, latest = history_for(today)
            return 200, forecast_months(history, latest, today, horizon)
        except Exception as exc:
            logger.error("Turnover forecast unavailable (%s)", type(exc).__name__)
            return 503, {"title": "Не вдалося розрахувати прогноз за виробничими документами"}
    if route[1] == "/documents" and "year" in q:
        year = int(q["year"])
        if set(q) != {"year"} or not 1900 <= year < now().year:
            raise ValueError("Виберіть закритий рік")
        try:
            return 200, read_year(year)
        except Exception as exc:
            logger.error("Production invoice reconciliation failed (%s)", type(exc).__name__)
            return 503, {"title": "Не вдалося прочитати виробничі накладні за вибраний рік"}
    snapshot = service.current(models=route[1] == "/forecast")
    if not snapshot or (route[1] == "/forecast" and hosted() and not snapshot.get("modelsReady")):
        return 503, {"title": service.status.get("error") or "Очікуємо першу звірку з виробничою БД"}
    if route[1] == "/forecast":
        return 200, forecasts(snapshot, q, service.policies, now().date())
    return 200, handlers[route[1]](snapshot, q)


def app(env, start_response):
    from http import HTTPStatus

    try:
        status, body = dispatch(env)
    except PolicyConflict:
        status, body = 409, {"title": "Умови закупівлі вже змінено. Оновіть сторінку перед збереженням."}
    except (ValueError, TypeError, OverflowError, UnicodeError):
        status, body = 400, {"title": "Перевірте параметри запиту, дати та кількість"}
    payload = json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode()
    start_response(
        f"{status} {HTTPStatus(status).phrase}",
        [
            ("Content-Type", "application/json"),
            ("Cache-Control", "private, no-store"),
            ("Content-Length", str(len(payload))),
        ],
    )
    return [payload]
