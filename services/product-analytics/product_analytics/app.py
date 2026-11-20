"""Private WSGI boundary for the normalized product analytics contract."""

import json
import logging
from datetime import date
from decimal import Decimal, DecimalException

import simplejson

from .report import build_report

MAX_REQUEST_BYTES = 64 * 1024 * 1024
REPORT_PATH = "/v1/product-analytics"
HEALTH_PATH = "/health/live"
REPORT_WINDOWS = (30, 90, 180, 365)
LOGGER = logging.getLogger(__name__)


class RequestError(Exception):
    def __init__(self, status, code):
        self.status = status
        self.code = code


def _reject_constant(_value):
    raise ValueError("Non-finite JSON number")


def _iso_day(value):
    if not isinstance(value, str) or len(value) != 10:
        raise ValueError("Invalid ISO date")
    day = date.fromisoformat(value)
    if day.isoformat() != value:
        raise ValueError("Invalid ISO date")
    return day


def _read_payload(environ):
    media_type = environ.get("CONTENT_TYPE", "").partition(";")[0].strip().lower()
    if media_type != "application/json":
        raise RequestError("415 Unsupported Media Type", "ExpectedJson")

    declared_length = environ.get("CONTENT_LENGTH", "")
    if not declared_length:
        raise RequestError("411 Length Required", "ContentLengthRequired")
    if not declared_length.isascii() or not declared_length.isdecimal():
        raise ValueError("Invalid Content-Length")
    length = int(declared_length)
    if length > MAX_REQUEST_BYTES:
        raise RequestError("413 Content Too Large", "PayloadTooLarge")

    body = environ["wsgi.input"].read(length)
    if len(body) != length:
        raise ValueError("Incomplete request body")
    payload = json.loads(body.decode("utf-8"), parse_float=Decimal, parse_constant=_reject_constant)
    if not isinstance(payload, dict) or payload.get("source") not in ("web", "dntrade"):
        raise ValueError("Invalid report source")
    start = _iso_day(payload["from"])
    end = _iso_day(payload["to"])
    previous_start = _iso_day(payload["previousFrom"])
    days = (end - start).days + 1
    if days not in REPORT_WINDOWS or (start - previous_start).days != days:
        raise ValueError("Invalid report dates")
    if type(payload.get("page")) is not int or payload["page"] < 1 or type(payload.get("currentEnd")) is not bool:
        raise ValueError("Invalid report filters")
    for name, limit in (("product", 512), ("search", 120)):
        value = payload.get(name)
        if value is not None and (not isinstance(value, str) or len(value) > limit):
            raise ValueError("Invalid report filter")
    if not isinstance(payload.get("catalog"), list) or not isinstance(payload.get("inventory"), dict):
        raise ValueError("Invalid catalog snapshot")
    sales = payload.get("sales")
    if not isinstance(sales, dict) or not isinstance(sales.get("rows"), list):
        raise ValueError("Invalid sales history")
    return payload


def _response(start_response, status, payload, *, allow=None):
    body = simplejson.dumps(payload, ensure_ascii=False, use_decimal=True, separators=(",", ":")).encode("utf-8")
    headers = [
        ("Content-Type", "application/json; charset=utf-8"),
        ("Content-Length", str(len(body))),
        ("Cache-Control", "no-store"),
    ]
    if allow is not None:
        headers.append(("Allow", allow))
    start_response(status, headers)
    return [body]


def app(environ, start_response):
    path = environ.get("PATH_INFO")
    method = environ.get("REQUEST_METHOD")
    if path == HEALTH_PATH:
        if method != "GET":
            return _response(start_response, "405 Method Not Allowed", {"code": "MethodNotAllowed"}, allow="GET")
        return _response(start_response, "200 OK", {"status": "ok"})
    if path != REPORT_PATH:
        return _response(start_response, "404 Not Found", {"code": "RouteNotFound"})
    if method != "POST":
        return _response(start_response, "405 Method Not Allowed", {"code": "MethodNotAllowed"}, allow="POST")

    try:
        payload = _read_payload(environ)
        report = build_report(payload)
    except RequestError as error:
        return _response(start_response, error.status, {"code": error.code})
    except (ValueError, KeyError, TypeError, DecimalException, RecursionError):
        return _response(start_response, "400 Bad Request", {"code": "InvalidAnalyticsPayload"})
    except Exception as error:
        LOGGER.error("Product analytics report failed (%s)", type(error).__name__)
        return _response(start_response, "500 Internal Server Error", {"code": "AnalyticsReportFailed"})
    return _response(start_response, "200 OK", report)
