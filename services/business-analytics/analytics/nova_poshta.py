"""Read the sender's Nova Poshta register without retaining recipient contact details."""
import calendar
import http.client
import json
import os
import re
from collections import Counter, defaultdict
from datetime import date, datetime
from time import monotonic, sleep

from .shipments import Match, keys


def _page(key, first, last, page, timeout):
    connection = http.client.HTTPSConnection("api.novaposhta.ua", timeout=timeout)
    body = dict(apiKey=key, modelName="InternetDocument", calledMethod="getDocumentList",
                methodProperties=dict(DateTimeFrom=first.strftime("%d.%m.%Y"),
                                      DateTimeTo=last.strftime("%d.%m.%Y"), Page=str(page)))
    try:
        connection.request("POST", "/v2.0/json/", json.dumps(body), {"Content-Type": "application/json"})
        response = connection.getresponse()
        if response.status != 200:
            raise ValueError("carrier HTTP " + str(response.status))
        payload = response.read(8 * 1024 * 1024 + 1)
        if len(payload) > 8 * 1024 * 1024:
            raise ValueError("oversize carrier page")
        return json.loads(payload)
    finally:
        connection.close()


def _day(value):
    text = str(value or "")[:10]
    for fmt in ("%d.%m.%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            pass
    return None


def _name(value):
    return value.strip() if isinstance(value, str) else None


class CarrierHistory:
    def __init__(self, invoices):
        self.months = 0
        self.documents = 0
        self.status = "unavailable"
        self.error_code = None
        self.invoice_keys = Counter()
        for row in invoices:
            for kind, value in keys(row):
                if kind in ("ttn", "number") and value:
                    self.invoice_keys[kind, value] += row["count"]
        self.by_number = defaultdict(set)
        self.by_ttn = {}

    def record(self, doc, ttn):
        reference = doc.get("InfoRegClientBarcodes")
        if isinstance(reference, (str, int)):
            reference = str(reference).strip()
        else:
            reference = ""
        if ("number", reference) in self.invoice_keys:
            self.by_number[reference].add(ttn)
        elif ("ttn", ttn) not in self.invoice_keys:
            return
        state = str(doc.get("StateId") or "")
        received = _day(doc.get("RecipientDateTime"))
        dispatched = state not in ("2", "3") and (state in ("4", "5", "6", "7", "8", "9", "10", "11")
                                                  or bool(received and received.year >= 2000))
        region = _name(doc.get("RecipientAreaDescription"))
        city = _name(doc.get("CityRecipientDescription")) or _name(doc.get("RecipientCityName"))
        self.by_ttn[ttn] = (reference, dispatched, region, city)

    def match(self, row):
        if self.status != "complete":
            return Match()
        supplied = dict(keys(row))
        ttn, number = supplied["ttn"], supplied["number"]
        if ttn:
            if ttn not in self.by_ttn:
                return Match("ambiguous") if self.by_number.get(number) else Match()
            if self.invoice_keys["ttn", ttn] != 1:
                return Match("ambiguous")
            kind = "ttn"
        elif number and number in self.by_number:
            possible = self.by_number[number]
            if len(possible) != 1 or self.invoice_keys["number", number] != 1:
                return Match("ambiguous")
            ttn = next(iter(possible))
            if self.invoice_keys["ttn", ttn]:
                return Match("ambiguous")
            kind = "number"
        else:
            return Match()
        reference, sent, region, city = self.by_ttn[ttn]
        if number and reference and number != reference:
            return Match("ambiguous")
        if not number and self.invoice_keys["number", reference]:
            return Match("ambiguous")
        return Match(kind, region, city) if sent else Match()


def read_history(year, today, invoices):
    history = CarrierHistory(invoices)
    key = os.getenv("Delivery__NovaPoshta__ApiKey") or os.getenv("NOVAPOSHTA_API_KEY")
    if not key or not key.strip():
        history.status = "not_configured"
        return history
    seen = set()
    deadline = monotonic() + 55
    try:
        for month in range(1, 13):
            first = date(year, month, 1)
            if first > today:
                break
            last = min(date(year, month, calendar.monthrange(year, month)[1]), today)
            page, month_count = 1, 0
            month_total = None
            while True:
                remaining = deadline - monotonic()
                if remaining < 1:
                    raise TimeoutError()
                result = _page(key, first, last, page, min(10, remaining))
                if not isinstance(result, dict) or result.get("success") is not True or result.get("errors"):
                    codes = result.get("errorCodes") if isinstance(result, dict) else None
                    if isinstance(codes, list) and codes and re.fullmatch(r"[0-9]{3,16}", str(codes[0])):
                        history.error_code = str(codes[0])
                    raise ValueError("carrier rejected request")
                rows = result.get("data")
                if not isinstance(rows, list):
                    raise ValueError("invalid carrier response")
                info = result.get("info")
                total = info.get("totalCount") if isinstance(info, dict) else None
                expected = int(total) if total is not None else None
                if expected is not None:
                    if month_total is not None and month_total != expected:
                        raise ValueError("carrier register changed during pagination")
                    month_total = expected
                for doc in rows:
                    if not isinstance(doc, dict):
                        raise ValueError("invalid carrier document")
                    ttn = str(doc.get("IntDocNumber") or "").strip()
                    day = _day(doc.get("DateTime"))
                    if not re.fullmatch(r"[0-9]{14}", ttn) or not day or not first <= day <= last or ttn in seen:
                        raise ValueError("unexpected date, identifier or repeated carrier page")
                    seen.add(ttn)
                    history.record(doc, ttn)
                month_count += len(rows)
                if len(seen) > 100000 or (month_total is not None and month_count > month_total):
                    raise ValueError("unexpected carrier page count")
                if not rows or month_total == month_count:
                    if month_total is not None and month_total != month_count:
                        raise ValueError("incomplete carrier register")
                    break
                page += 1
                sleep(0.25)
            history.months += 1
            history.documents = len(seen)
            sleep(0.25)
        history.status = "complete"
    except (OSError, http.client.HTTPException, ValueError, TypeError, OverflowError):
        # A partial register cannot establish whether an order number is unique.
        history.status = "unavailable"
    return history
