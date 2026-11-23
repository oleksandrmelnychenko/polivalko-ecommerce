"""Look up a shop order in the sender's register using its exact customer reference."""
import calendar
import re
from collections import defaultdict
from datetime import date, timedelta
from hashlib import sha256
from threading import Lock
from time import monotonic

from .nova_poshta import _day, read_register, sender_api_key
from .source import production


ORDER_NUMBER = re.compile(r"PV-[0-9]{1,19}")
_months = {}
_lock = Lock()


class OrderRegister:
    def __init__(self):
        self.months = self.documents = 0
        self.status = "unavailable"
        self.error_code = None
        self.by_order = defaultdict(list)

    def record(self, doc, ttn):
        number = str(doc.get("InfoRegClientBarcodes") or "").strip()
        if (ORDER_NUMBER.fullmatch(number) and str(doc.get("StateId")) not in ("2", "3")
                and str(doc.get("DeletionMark", "")).lower() not in ("true", "1")):
            self.by_order[number].append((_day(doc["DateTime"]), ttn))


def find_waybills(number, placed, today, key, refresh=False):
    if not key:
        return {"status": "not_configured", "waybills": None}
    deadline = monotonic() + 50
    sender = sha256(key.encode()).digest()
    first = placed.replace(day=1)
    matches = {}
    while first <= today:
        last = min(today, date(first.year, first.month, calendar.monthrange(first.year, first.month)[1]))
        cache_key = (sender, first, last)
        if not _lock.acquire(timeout=max(0, deadline - monotonic())):
            return {"status": "unavailable", "waybills": None}
        try:
            now = monotonic()
            for expired in [k for k, (_, until, _) in _months.items() if until <= now]:
                del _months[expired]
            cached = _months.get(cache_key)
            if cached is None or (refresh and last == today and now - cached[0] >= 5):
                register = read_register(key, first, last, OrderRegister(), deadline)
                if register.status != "complete":
                    return {"status": register.status, "waybills": None}
                ttl = 60 if last == today else 3600
                loaded = monotonic()
                cached = _months[cache_key] = (loaded, loaded + ttl, register.by_order)
            for day, ttn in cached[2].get(number, ()):
                if day >= placed:
                    matches[ttn] = day.isoformat()
        finally:
            _lock.release()
        first = last + timedelta(days=1)
    return {"status": "complete", "waybills": [
        {"number": ttn, "date": day} for ttn, day in sorted(matches.items(), key=lambda item: (item[1], item[0]))
    ]}


def order_waybills(number, today, refresh=False):
    if not ORDER_NUMBER.fullmatch(number):
        return 404, {"title": "Замовлення не знайдено"}
    with production() as conn:
        order = conn.execute("""
            SELECT (created_at AT TIME ZONE 'Europe/Kyiv')::date AS placed, delivery_method
            FROM ordering.orders WHERE number = %s
            """, (number,)).fetchone()
    if not order:
        return 404, {"title": "Замовлення не знайдено"}
    if order["delivery_method"] not in ("NovaPoshta", "NovaPoshtaCourier", "nova_poshta", "nova_poshta_courier"):
        return 200, {"status": "not_applicable", "waybills": None}
    return 200, find_waybills(number, order["placed"], today, sender_api_key(), refresh)
