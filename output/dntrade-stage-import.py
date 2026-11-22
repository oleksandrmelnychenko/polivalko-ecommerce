import csv
import hashlib
import http.client
import json
import subprocess
import sys
import unicodedata
from collections import Counter
from decimal import Decimal
from http.cookies import SimpleCookie
from pathlib import Path
from uuid import uuid4


root = Path(__file__).parent
api = "/api/v1/console"
categories_route = api + "/catalog/categories"
stock_container = "polivalko-staging-9967665-api-1"
products_file = root / "polivalko-dntrade-bucha-import.json"
uncategorized = "-- БЕЗ КАТЕГОРІЇ --"
hidden_parent = ("Господарчі товари",)
managed_hidden = {
    uncategorized: ("Без категорії DNTrade", "dntrade-uncategorized"),
    "Хлам": ("Хлам DNTrade", "dntrade-archive"),
    "#weighted": ("Вагові товари DNTrade", "dntrade-weighted"),
}


def normalized(label):
    return " ".join(unicodedata.normalize("NFKC", label).casefold().split())


def source_rows():
    with (root / "dntrade-2026-11-19-catalog.csv").open(encoding="utf-8-sig", newline="") as file:
        dialect = csv.Sniffer().sniff(file.readline(), delimiters=";,\t")
        file.seek(0)
        yield from csv.DictReader(file, dialect=dialect)


def local_client():
    cookies = {}

    def request(method, route, payload=None, raw=None, headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", 8081, timeout=240)
        request_headers = {"Host": "console.localhost:8081", "Accept": "application/json", **(headers or {})}
        if cookies:
            request_headers["Cookie"] = "; ".join(f"{key}={value}" for key, value in cookies.items())
        if payload is not None:
            request_headers["Content-Type"] = "application/json"
            raw = json.dumps(payload, ensure_ascii=False).encode()
        try:
            connection.request(method, route, body=raw, headers=request_headers)
            response = connection.getresponse()
            result_bytes = response.read()
            if not 200 <= response.status < 300:
                try:
                    detail = json.loads(result_bytes)
                except ValueError:
                    detail = {}
                code = detail.get("code") or detail.get("title") or ""
                fields = list(detail.get("errors", {}))
                raise RuntimeError(f"{method} {route}: HTTP {response.status} {code} {fields}")
            for key, value in response.getheaders():
                if key.lower() != "set-cookie":
                    continue
                parsed = SimpleCookie()
                parsed.load(value)
                cookies.update({name: item.value for name, item in parsed.items()})
            return json.loads(result_bytes) if result_bytes else None
        finally:
            connection.close()

    credentials = subprocess.run(
        ["docker", "exec", stock_container, "printenv", "Seed__Users__0__Email", "Seed__Users__0__Password"],
        capture_output=True, text=True, check=False,
    )
    values = credentials.stdout.splitlines()
    if credentials.returncode or len(values) != 2 or not all(values):
        raise RuntimeError("Local staging lacks seed admin credentials")
    request("POST", api + "/auth/login", dict(zip(("email", "password"), values, strict=True)))
    if "pv_console" not in cookies:
        raise RuntimeError("Local staging did not establish a console session")
    return request


def resolve_categories(request, nodes, used, apply=False):
    current = request("GET", categories_route)
    by_id = {row["id"]: row for row in current}

    def current_path(item):
        parent = item["parentId"]
        parent_path = current_path(by_id[parent]) if parent else ()
        return (*parent_path, normalized(item["name"]))

    by_path = {current_path(row): row for row in current}
    by_ref = {normalized(row["navkoloRef"]): row for row in current if row.get("navkoloRef")}
    planned = []
    csrf = {"X-CSRF-TOKEN": request("GET", api + "/auth/csrf")["token"]} if apply else {}
    names = {}
    for source_path in sorted(nodes, key=len):
        original = source_path[-1]
        if original not in used and not any(other[:len(source_path)] == source_path and other[-1] in used for other in nodes):
            continue
        hide = original in managed_hidden
        if hide:
            name, slug = managed_hidden[original]
            path = (*hidden_parent, name)
        else:
            name = original
            path = source_path
            slug = "dntrade-" + hashlib.sha256("\x1f".join(path).encode()).hexdigest()[:14]
        key = tuple(map(normalized, path))
        existing = by_path.get(key)
        if existing and existing.get("navkoloRef"):
            if hide and existing["isVisible"]:
                raise ValueError("A DNTrade holding category is visible")
            names[original] = existing["navkoloRef"]
            continue
        reference = "Хлам" if original == "Хлам" else slug
        if existing or normalized(reference) in by_ref or key[:-1] not in by_path:
            raise ValueError(f"Category conflict: {path}")
        new = {
            "parentId": by_path[key[:-1]]["id"],
            "name": name,
            "slug": slug,
            "sortOrder": 1000 + len(planned),
            "isVisible": not hide,
            "navkoloRef": reference,
            "filterAttributes": [],
        }
        planned.append(new)
        result = request("POST", categories_route, new, headers=csrf) if apply else {**new, "id": slug}
        by_path[key] = result
        by_ref[normalized(reference)] = result
        names[original] = reference
    return names, planned


def build_records(rows, groups):
    stats = Counter()
    records = []
    for row in rows:
        source_group = row["Категорія"].strip()
        weighted = row["Ваговий товар"] == "Так"
        group = "#weighted" if weighted else source_group
        code = row["Код"].strip()
        price = Decimal(row["Роздрібна"].replace(" ", "").replace(",", "."))
        quantity = Decimal(row["Залишок"].replace(" ", "").replace(",", "."))
        booked = Decimal(row["Зарезервовано"].replace(" ", "").replace(",", "."))
        assert row["Статус"] == "Активний" and price >= 0 and code and row["Назва"].strip()
        stats["weighted"] += weighted
        stats["uncategorized"] += not weighted and group == uncategorized
        stats["archive"] += not weighted and group == "Хлам"
        stats["zero_price"] += price == 0
        stats["negative_stock"] += quantity - booked < 0
        attrs = [
            {"name": "Штрихкод", "value": row["Штрихкод"].strip()},
            {"name": "Артикул DNTrade", "value": row["Артикул"].strip()},
            {"name": "Одиниця виміру", "value": row["Од. вим."].strip()},
        ]
        if weighted:
            attrs.append({"name": "Категорія DNTrade", "value": source_group})
        records.append({
            "navkoloId": "dntrade-code:" + code,
            "sku": code,
            "name": row["Назва"].strip(),
            "groupRef": groups[group],
            "price": float(price),
            "oldPrice": None,
            "stock": float(max(0, quantity - booked)),
            "attributes": [attr for attr in attrs if attr["value"]],
        })
    assert len({r["sku"] for r in records}) == len(rows)
    return records, stats


def main():
    mode = sys.argv[1]
    if mode not in ("plan", "categories", "sample", "import"):
        raise ValueError("Unknown import mode")
    rows = list(source_rows())
    assert len(rows) == 4974
    nodes = [tuple(item["path"]) for item in json.loads((root / "dntrade-category-tree.json").read_text(encoding="utf-8"))]
    nodes.append(("#weighted",))
    used = {"#weighted" if r["Ваговий товар"] == "Так" else r["Категорія"].strip() for r in rows}
    assert used <= {path[-1] for path in nodes}
    request = local_client()
    groups, planned = resolve_categories(request, nodes, used, apply=mode == "categories")
    records, stats = build_records(rows, groups)
    products_file.write_text(json.dumps(records, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({"records": len(records), "categories_to_create": len(planned), **stats}))
    if mode in ("sample", "import"):
        if planned:
            raise RuntimeError("Catalog categories need to be created first")
        if mode == "sample":
            records = [next(row for row in records if row["groupRef"] == groups[group]) for group in ("Капельний полив", uncategorized, "#weighted")]
        boundary = "polivalko-" + uuid4().hex
        body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"dntrade-bucha.json\"\r\n"
                "Content-Type: application/json\r\n\r\n").encode()
        body += json.dumps(records, ensure_ascii=False).encode() + f"\r\n--{boundary}--\r\n".encode()
        csrf = request("GET", api + "/auth/csrf")["token"]
        result = request("POST", api + "/integration/navkolo/import", raw=body, headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "X-CSRF-TOKEN": csrf,
        })
        print(json.dumps(result, ensure_ascii=True)[:3500])


if __name__ == "__main__":
    main()
