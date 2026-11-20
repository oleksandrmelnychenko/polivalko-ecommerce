import io
import json
import unittest
from decimal import Decimal
from unittest.mock import patch

from product_analytics.app import MAX_REQUEST_BYTES, app


def request(path="/v1/product-analytics", method="POST", body=b"", content_type="application/json", content_length=None):
    environ = {
        "REQUEST_METHOD": method,
        "PATH_INFO": path,
        "CONTENT_TYPE": content_type,
        "CONTENT_LENGTH": str(len(body)) if content_length is None else content_length,
        "wsgi.input": io.BytesIO(body),
    }
    response = []

    def start_response(status, headers):
        response.extend((int(status.split()[0]), dict(headers)))

    data = b"".join(app(environ, start_response))
    return (*response, data)


def empty_input():
    return {
        "source": "web",
        "from": "2026-10-21",
        "to": "2026-11-19",
        "previousFrom": "2026-09-21",
        "currentEnd": True,
        "product": None,
        "search": None,
        "page": 1,
        "sales": {
            "rows": [],
            "firstSourceDay": None,
            "lastSourceDay": None,
            "ignoredDocuments": 0,
            "unmatchedLines": 0,
            "returnsAvailable": True,
        },
        "catalog": [],
        "inventory": {
            "healthyProducts": 7,
            "lowStockProducts": 2,
            "outOfStockProducts": 3,
            "lowStockThreshold": 3,
        },
    }


class AnalyticsAppTests(unittest.TestCase):
    def test_health_and_routes(self):
        status, headers, data = request(path="/health/live", method="GET")
        self.assertEqual(200, status)
        self.assertEqual({"status": "ok"}, json.loads(data))
        self.assertEqual("no-store", headers["Cache-Control"])
        self.assertEqual(404, request(path="/missing")[0])
        status, headers, _ = request(method="GET")
        self.assertEqual(405, status)
        self.assertEqual("POST", headers["Allow"])

    def test_normalized_empty_report_still_returns_inventory(self):
        status, headers, data = request(body=json.dumps(empty_input()).encode(), content_type="application/json; charset=UTF-8")
        self.assertEqual(200, status)
        self.assertEqual(len(data), int(headers["Content-Length"]))
        report = json.loads(data)
        self.assertEqual([], report["trend"])
        self.assertEqual(7, report["inventory"]["healthyProducts"])

    def test_decimal_values_remain_exact_json_numbers(self):
        exact = Decimal("12345678901234567.123456789")
        payload = empty_input()
        payload["inventory"]["lowStockThreshold"] = "DECIMAL_PLACEHOLDER"
        body = json.dumps(payload).replace('"DECIMAL_PLACEHOLDER"', str(exact)).encode()
        with patch("product_analytics.app.build_report", side_effect=lambda request: request["inventory"]):
            status, _, data = request(body=body)
        self.assertEqual(200, status)
        self.assertEqual(exact, json.loads(data, parse_float=Decimal)["lowStockThreshold"])

    def test_rejects_bad_payload_without_echoing_data(self):
        for body in (b"not-json", b"[]", b"\xff", b'{"number":NaN}', b'{"source":"web"}'):
            with self.subTest(body=body):
                status, _, data = request(body=body)
                self.assertEqual(400, status)
                self.assertEqual({"code": "InvalidAnalyticsPayload"}, json.loads(data))

    def test_request_size_and_media_type_are_validated_before_the_report(self):
        with patch("product_analytics.app.build_report") as report:
            self.assertEqual(415, request(content_type="text/plain")[0])
            self.assertEqual(411, request(content_length="")[0])
            self.assertEqual(413, request(content_length=str(MAX_REQUEST_BYTES + 1))[0])
            self.assertEqual(400, request(body=b"{}", content_length="3")[0])
            report.assert_not_called()

    def test_requires_equal_supported_reporting_windows(self):
        with patch("product_analytics.app.build_report") as report:
            for changes in ({"to": "2026-11-18"}, {"previousFrom": "2026-09-22"}):
                payload = empty_input() | changes
                status, _, _ = request(body=json.dumps(payload).encode())
                self.assertEqual(400, status)
            report.assert_not_called()


if __name__ == "__main__":
    unittest.main()
