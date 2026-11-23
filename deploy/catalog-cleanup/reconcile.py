"""Bring a shop's catalog categories and DNTrade products to a reviewed target state.

    python reconcile.py export --base http://127.0.0.1:8081 --host console.localhost:8081 --out target.json
    python reconcile.py plan   --base https://console.example.ua --target target.json --report plan.tsv
    python reconcile.py apply  --base https://console.example.ua --target target.json
    python reconcile.py audit  --base https://console.example.ua --target target.json --report audit.tsv
    python reconcile.py adopt-plan --base https://console.example.ua --keep dntrade-0d3dac570ca1a1 --replace hazova-produktsiia

Credentials come from CONSOLE_EMAIL and CONSOLE_PASSWORD. Everything goes through the console API,
so the change log, storefront cache invalidation and slug redirects work as for manual edits.
`plan` only reads. `apply` never deletes anything and never changes a category's Navkolo reference.
A category's SEO description, a product's brand and its site name are written only where the environment has
none, or (with --previous-target) still holds what an earlier run wrote, so values set there by hand stay.
"""
import argparse
import csv
import http.client
import json
import os
import sys
import unicodedata
from collections import defaultdict
from http.cookies import SimpleCookie
from urllib.parse import urlsplit

API = "/api/v1/console"
BATCH = 200
DNTRADE = "dntrade-code:"
# Names categories had before the 22.11.2026 cleanup, so an untouched environment can be matched.
PREVIOUS_NAMES = {
    "З'єднувачі й перехідники": ["З'єднувачі/Конектори/Перехідники/Розгалуджувачі"],
    "Труби, крани й фум-стрічка": ["Труби/Фумка/Крани"],
    "Вугілля, брикети й розпалювачі": ["Брикети/Вугілля/Розпал."],
    "Оприскувачі, лійки й відра": ["Оприскувачі/Лійки/Відра"],
    "Септики й компост": ["Септик/Компост"],
    "Секатори, сучкорізи й ножиці": ["Гілкорізи/Сучкорізи/Секатори/Ножиці"],
    "Сокири, пили й ножі": ["Сокири/Пили/Ножі"],
    "Приладдя для приготування їжі": ["Предм. пригот. їжі"],
    "Великий ручний інструмент": ["Великий ручн. інстр."],
    "Дрібний ручний інструмент": ["Дрібний ручн. інстр."],
    "Крапельний полив": ["Капельний полив"],
    "Бордюри й огорожі": ["Бордюрні стрічки"],
}


def norm(text):
    return " ".join(unicodedata.normalize("NFKC", text or "").casefold().split())


class Console:
    def __init__(self, base, host):
        parts = urlsplit(base)
        self.secure = parts.scheme == "https"
        self.netloc = parts.netloc
        self.host = host or parts.netloc
        self.cookies = {}
        self.csrf = {}
        self.conn = None  # one kept-alive connection: thousands of fresh ones exhaust local ports on Windows

    def call(self, method, route, payload=None):
        headers = {"Host": self.host, "Accept": "application/json", **self.csrf}
        if self.cookies:
            headers["Cookie"] = "; ".join(f"{k}={v}" for k, v in self.cookies.items())
        body = None
        if payload is not None:
            headers["Content-Type"] = "application/json"
            body = json.dumps(payload, ensure_ascii=False).encode()
        # Creating a category or a brand is not repeatable; every other call sets values and can be sent again.
        repeatable = not (method == "POST" and route in ("/catalog/categories", "/catalog/brands"))
        for attempt in range(3 if repeatable else 1):
            if self.conn is None:
                self.conn = (http.client.HTTPSConnection if self.secure else http.client.HTTPConnection)(self.netloc, timeout=120)
            try:
                self.conn.request(method, API + route, body=body, headers=headers)
                response = self.conn.getresponse()
                data = response.read()
            except (http.client.HTTPException, OSError):
                self.conn.close()
                self.conn = None
                if attempt == (2 if repeatable else 0):
                    raise
                continue
            if response.getheader("Connection", "").lower() == "close":
                self.conn.close()
                self.conn = None
            for key, value in response.getheaders():
                if key.lower() == "set-cookie":
                    parsed = SimpleCookie()
                    parsed.load(value)
                    self.cookies.update({name: item.value for name, item in parsed.items()})
            if not 200 <= response.status < 300:
                raise RuntimeError(f"{method} {route}: HTTP {response.status} {data[:400].decode(errors='replace')}")
            return json.loads(data) if data else None

    def login(self):
        email, password = os.environ.get("CONSOLE_EMAIL"), os.environ.get("CONSOLE_PASSWORD")
        if not email or not password:
            sys.exit("Set CONSOLE_EMAIL and CONSOLE_PASSWORD")
        self.call("POST", "/auth/login", {"email": email, "password": password})
        self.csrf = {"X-CSRF-TOKEN": self.call("GET", "/auth/csrf")["token"]}

    def products(self):
        page, items = 1, []
        while True:
            result = self.call("GET", f"/catalog/products?page={page}&pageSize=100")
            items += result["items"]
            if page >= result["totalPages"]:
                return items
            page += 1


def category_paths(categories):
    by_id = {c["id"]: c for c in categories}

    def path(c):
        return (path(by_id[c["parentId"]]) if c["parentId"] else ()) + (c["name"],)

    return {c["id"]: path(c) for c in categories}


def export(console, out):
    categories = console.call("GET", "/catalog/categories")
    paths = category_paths(categories)
    slug_of = {c["id"]: c["slug"] for c in categories}
    target = {"categories": [], "products": {}, "hideNavkoloPrefixes": ["demo-", "syn-"], "collections": {}}
    for c in sorted(categories, key=lambda c: len(paths[c["id"]])):
        target["categories"].append({
            "slug": c["slug"], "name": c["name"], "parent": slug_of.get(c["parentId"]), "sortOrder": c["sortOrder"],
            "isVisible": c["isVisible"], "navkoloRef": c["navkoloRef"], "path": list(paths[c["id"]]),
            "previousNames": PREVIOUS_NAMES.get(c["name"], []), "seoDescription": c.get("seoDescription"),
        })
    for item in console.products():
        detail = console.call("GET", f"/catalog/products/{item['id']}")
        navkolo_id = detail["navkolo"]["navkoloId"]
        if not navkolo_id.startswith(DNTRADE):
            continue
        target["products"][navkolo_id[len(DNTRADE):]] = {
            "category": slug_of[detail["categoryId"]], "displayName": detail.get("displayName"),
            "brand": detail.get("brand"), "isVisible": detail["isVisible"],
        }
    for collection in console.call("GET", "/catalog/collections"):
        target["collections"][collection["code"]] = [p["sku"] for p in collection["products"]]
    with open(out, "w", encoding="utf-8") as file:
        json.dump(target, file, ensure_ascii=False, indent=0, sort_keys=True)
    print(f"exported {len(target['categories'])} categories and {len(target['products'])} DNTrade products to {out}")


def reconcile(console, target, apply, report_path=None, keep_visible=frozenset(), previous=None, name_fixes=None):
    previous = previous or {}
    name_fixes = name_fixes or {}
    changes = defaultdict(int)
    say = lambda line: print(("APPLY " if apply else "PLAN  ") + line)
    existing = console.call("GET", "/catalog/categories")
    paths = {cid: tuple(map(norm, p)) for cid, p in category_paths(existing).items()}
    by_slug = {c["slug"]: c for c in existing}
    by_ref = {norm(c["navkoloRef"]): c for c in existing if c.get("navkoloRef")}
    by_path = {paths[c["id"]]: c for c in existing}
    resolved = {}  # target slug -> existing category id
    for t in target["categories"]:
        parent_id = resolved.get(t["parent"]) if t["parent"] else None
        if t["parent"] and parent_id is None:
            say(f"skip category {t['slug']}: parent {t['parent']} is missing")
            continue
        parent_path = paths.get(parent_id, ()) if parent_id else ()
        candidates = [by_slug.get(t["slug"]), by_ref.get(norm(t["navkoloRef"])) if t["navkoloRef"] else None]
        candidates += [by_path.get(parent_path + (norm(name),)) for name in [t["name"], *t["previousNames"]]]
        current = next((c for c in candidates if c), None)
        if current is None:
            say(f"create category {'/'.join(t['path'])} ({t['slug']})")
            changes["categories created"] += 1
            if apply:
                current = console.call("POST", "/catalog/categories", {
                    "parentId": parent_id, "name": t["name"], "slug": t["slug"], "sortOrder": t["sortOrder"],
                    "isVisible": t["isVisible"], "navkoloRef": None, "filterAttributes": [],
                    "seoDescription": t.get("seoDescription")})
                paths[current["id"]] = parent_path + (norm(t["name"]),)
            resolved[t["slug"]] = current["id"] if current else f"new:{t['slug']}"
            continue
        resolved[t["slug"]] = current["id"]
        wanted = {"name": t["name"], "slug": t["slug"], "isVisible": t["isVisible"], "sortOrder": t["sortOrder"]}
        if current["parentId"] is not None:
            wanted["parentId"] = parent_id
        diff = {k: v for k, v in wanted.items() if current.get(k) != v}
        # The SEO description only fills an empty field: text someone wrote in that environment is kept.
        if t.get("seoDescription") and not (current.get("seoDescription") or "").strip():
            diff["seoDescription"] = t["seoDescription"]
        if diff and not (t["slug"] != current["slug"] and t["slug"] in by_slug and by_slug[t["slug"]]["id"] != current["id"]):
            shown = {k: ("(fill the empty field)" if k == "seoDescription" else v) for k, v in diff.items()}
            say(f"update category {current['slug']}: {shown}")
            changes["categories updated"] += 1
            if apply:
                body = {k: current.get(k) for k in ("parentId", "name", "slug", "sortOrder", "isVisible", "navkoloRef",
                                                     "seoTitle", "seoDescription", "imageUrl", "description")}
                body["filterAttributes"] = current.get("filterAttributes") or []
                body.update(diff)
                console.call("PUT", f"/catalog/categories/{current['id']}", body)
        elif diff:
            say(f"skip slug change {current['slug']} -> {t['slug']}: the address belongs to another category")
    known_ids = {c["id"] for c in existing}

    brands = {norm(b["name"]): b["name"] for b in console.call("GET", "/catalog/brands")}
    slug_by_id = {c["id"]: c["slug"] for c in existing}
    report = []  # (change, sku, name on the site now, current value, wanted value)
    moves, visibility, brand_sets, names, hide = defaultdict(list), defaultdict(list), defaultdict(list), [], []
    found = set()
    items = console.products()
    for item in items:
        detail = console.call("GET", f"/catalog/products/{item['id']}")
        navkolo_id = detail["navkolo"]["navkoloId"]
        if any(navkolo_id.startswith(p) for p in target["hideNavkoloPrefixes"]):
            if detail["isVisible"]:
                hide.append(item["id"])
            continue
        if not navkolo_id.startswith(DNTRADE):
            continue
        sku = navkolo_id[len(DNTRADE):]
        want = target["products"].get(sku)
        if want is None:
            continue
        found.add(sku)
        shown_name = detail.get("displayName") or detail["navkolo"]["name"]
        note = lambda field, now, then: report.append((field, sku, shown_name, now, then))
        category = resolved.get(want["category"])
        if category and category != detail["categoryId"]:
            moves[category].append(item["id"])
            note("category", slug_by_id.get(detail["categoryId"], detail["categoryId"]), want["category"])
        if want["isVisible"] != detail["isVisible"]:
            change = "show" if want["isVisible"] else "hide"
            stock = f"stock {detail['navkolo']['stock']:g}"
            if sku in keep_visible and not want["isVisible"]:
                note("keep visible", stock, "left visible (--keep-visible)")
            else:
                visibility[want["isVisible"]].append(item["id"])
                note(change, stock, change)
        # Brand and site name only fill an empty field: a value someone set in that environment stays.
        before = previous.get(sku, {})  # what an earlier run of this script wrote: still ours to update
        current_brand = (detail.get("brand") or "").strip()
        if want["brand"] and norm(want["brand"]) != norm(current_brand):
            if current_brand and norm(current_brand) != norm(before.get("brand")):
                note("keep brand", current_brand, want["brand"])
            else:
                brand_sets[want["brand"]].append(item["id"])
                note("brand", current_brand, want["brand"])
        current_name = (detail.get("displayName") or "").strip()
        fix = name_fixes.get(sku)
        if fix and shown_name.strip() == fix["from"]:  # a reviewed correction of exactly the name seen there
            names.append((item["id"], fix["to"], detail))
            note("fixed site name", shown_name, fix["to"])
        elif fix:
            note("fix skipped", shown_name, f"expected «{fix['from']}», left as it is")
        elif want["displayName"] and want["displayName"] != current_name:
            if current_name and current_name != (before.get("displayName") or "").strip():
                note("keep site name", current_name, want["displayName"])
            else:
                names.append((item["id"], want["displayName"], detail))
                note("site name", current_name, want["displayName"])
    missing = len(target["products"]) - len(found)
    say(f"products: {len(found)} matched, {missing} from the target are not in this environment")
    for category, ids in moves.items():
        say(f"move {len(ids)} products to {category}")
        changes["products moved"] += len(ids)
        if apply and not str(category).startswith("new:"):
            for i in range(0, len(ids), BATCH):
                console.call("POST", "/catalog/products/bulk", {"productIds": ids[i:i + BATCH], "categoryId": category})
    for visible, ids in visibility.items():
        say(f"{'show' if visible else 'hide'} {len(ids)} products")
        changes["visibility changed"] += len(ids)
        if apply:
            for i in range(0, len(ids), BATCH):
                console.call("POST", "/catalog/products/bulk", {"productIds": ids[i:i + BATCH], "isVisible": visible})
    if hide:
        say(f"hide {len(hide)} demo or test products")
        changes["demo/test hidden"] += len(hide)
        if apply:
            for i in range(0, len(hide), BATCH):
                console.call("POST", "/catalog/products/bulk", {"productIds": hide[i:i + BATCH], "isVisible": False})
    for brand, ids in brand_sets.items():
        say(f"set brand {brand} on {len(ids)} products" + ("" if norm(brand) in brands else " (new brand)"))
        changes["brands set"] += len(ids)
        if apply:
            if norm(brand) not in brands:
                brands[norm(brand)] = console.call("POST", "/catalog/brands", {"name": brand, "slug": None, "description": None, "logoUrl": None})["name"]
            for i in range(0, len(ids), BATCH):
                console.call("POST", "/catalog/products/bulk", {"productIds": ids[i:i + BATCH], "brand": brands[norm(brand)]})
    if names:
        say(f"set site name on {len(names)} products")
        changes["site names set"] += len(names)
    if apply:
        for product_id, name, _ in names:
            p = console.call("GET", f"/catalog/products/{product_id}")
            console.call("PUT", f"/catalog/products/{product_id}", {
                "displayName": name, "slug": p["slug"], "categoryId": p["categoryId"], "brand": p.get("brand"),
                "descriptionHtml": p.get("descriptionHtml"), "isVisible": p["isVisible"], "seoTitle": p.get("seoTitle"),
                "seoDescription": p.get("seoDescription"), "attributes": p["attributes"]})
    by_sku = {i["sku"]: i["id"] for i in items}
    for collection in console.call("GET", "/catalog/collections"):
        wanted = target["collections"].get(collection["code"])
        if wanted is None or [p["sku"] for p in collection["products"]] == wanted:
            continue
        if not all(s in by_sku for s in wanted):
            say(f"skip collection {collection['code']}: some products are missing here")
            continue
        say(f"set collection {collection['code']} to {wanted}")
        changes["collections set"] += 1
        if apply:
            console.call("PUT", f"/catalog/collections/{collection['id']}", {
                "code": collection["code"], "title": collection["title"], "sortOrder": collection["sortOrder"],
                "isVisible": collection["isVisible"], "productIds": [by_sku[s] for s in wanted]})
    target_slugs = {t["slug"] for t in target["categories"]}
    extra = [c["slug"] for c in existing if c["id"] in known_ids and c["id"] not in resolved.values() and c["slug"] not in target_slugs]
    if extra:
        by_slug_now = {c["slug"]: c for c in console.call("GET", "/catalog/categories")} if apply else by_slug
        described = [f"{s} ({'visible' if by_slug_now[s]['isVisible'] else 'hidden'}, {by_slug_now[s].get('productCount', '?')} products)"
                     for s in sorted(extra) if s in by_slug_now]
        say(f"categories not in the target (left untouched): {', '.join(described)}")
    print("summary:", dict(changes) or "nothing to change")
    if report_path:
        with open(report_path, "w", encoding="utf-8", newline="") as file:
            writer = csv.writer(file, delimiter="\t")
            writer.writerow(["change", "sku", "name now", "current", "wanted"])
            writer.writerows(sorted(report, key=lambda r: (r[0], r[1])))
        print(f"{len(report)} product changes listed in {report_path}")


# Misspellings and Russian words fixed in the 23.11.2026 pass; a name containing one needs a look.
KNOWN_BAD = ["садовый", "распредел", "канальный", "внутренней", "нарезк", "ловушк", "катушк", "сплошн", "полумахров",
             "резинов", "цвєтн", "черенок", "черенком", "металічн", "польша", "мятлик", "персидск", "л/ч", "сочащ",
             " струй", "шомпур", "вугловий", "віззок", "акамулят", "акумулярор", "сікатор", "секкатор", "пильщик",
             "пильник", "турисичн", "комфорк", "бітобакс", "бітоксицил", "магнкур", "макнікур", "прилиач", "амінокисот",
             "тагранів", "шкідиків", "хризонтем", "драцент", "свагнум", "трациційн", " мерів", "велетнь", "засібвід",
             "відкомарів", "дляцибул", "кімнатих", "руглий", "садоий", "садоого", "самозволожуюий", "глянць",
             "гідррзетк", "керамзіт", "коннектр", "контроллер", "презиційн", "перехдник", "універальн", "універсальнй",
             "щіітка", "янголч", "інсектициж", "емність", "двохсторон", "поліестр "]


def name_problems(name):
    import re
    low = name.casefold()
    found = [w.strip() for w in KNOWN_BAD if re.search(r"(?<![\w'’])" + re.escape(w.strip()), low)]
    if re.search(r"[ыэъёЫЭЪЁ]", name): found.append("Russian letter")
    if "  " in name or name != name.strip(): found.append("extra space")
    if name.count("(") != name.count(")"): found.append("unbalanced bracket")
    if name[:1].islower() and not name.startswith("pH"): found.append("lowercase start")
    if re.search(r"\d(мм|см|л|г|кг)[а-яіїєґ]{2,}", name): found.append("glued unit")
    for token in re.split(r"[\s\-,()*+/.\"«»„“:;№]+", name):
        if re.search("[а-яіїєґ]", token, re.I) and re.search("[a-z]", token, re.I) and not re.fullmatch(r"[A-Za-z]+\d+[а-яіїєґ]+", token):
            found.append(f"mixed alphabets: {token}")
    return found


def audit(console, target, report_path):
    """Read-only look at an environment after a reconcile: what the target did not cover and what still looks wrong."""
    categories = console.call("GET", "/catalog/categories")
    paths = category_paths(categories)
    slug_of = {c["id"]: c["slug"] for c in categories}
    rows = []
    for c in sorted(categories, key=lambda c: paths[c["id"]]):
        rows.append(("category", c["slug"], " / ".join(paths[c["id"]]),
                     f"{'visible' if c['isVisible'] else 'hidden'}, {c.get('productCount', '?')} products",
                     f"navkoloRef={c.get('navkoloRef') or ''}"))
    hidden_ids = set()
    by_id = {c["id"]: c for c in categories}
    for c in categories:  # a category is hidden on the storefront when it or any parent is hidden
        node = c
        while node:
            if not node["isVisible"]:
                hidden_ids.add(c["id"])
                break
            node = by_id.get(node["parentId"])
    children = {c["parentId"] for c in categories if c["parentId"]}
    where = {}
    for c in sorted(categories, key=lambda c: len(paths[c["id"]])):  # the deepest category wins
        page = 1
        while True:
            result = console.call("GET", f"/catalog/products?categoryId={c['id']}&page={page}&pageSize=100")
            for item in result["items"]:
                where[item["id"]] = (c["id"], item)
            if page >= result["totalPages"]:
                break
            page += 1
    shown = defaultdict(int)
    for category_id, item in where.values():
        visible = item["isVisible"] and category_id not in hidden_ids
        name = item.get("displayName") or item["name"]
        place = slug_of[category_id]
        if visible:
            shown[category_id] += 1
            if category_id in children:
                rows.append(("visible on a parent category", item["sku"], name, place, ""))
            for problem in name_problems(name):
                rows.append(("name", item["sku"], name, place, problem))
        if item["sku"] not in target["products"] and not any(item["sku"].lower().startswith(p) for p in target["hideNavkoloPrefixes"]):
            rows.append(("not in the target", item["sku"], name, place,
                         f"{'visible' if visible else 'hidden'}, stock {item['stock']:g}"))
    for c in categories:
        if c["isVisible"] and c["id"] not in hidden_ids and c["id"] not in children and not shown[c["id"]]:
            rows.append(("visible empty category", c["slug"], " / ".join(paths[c["id"]]), "", ""))
    counts = defaultdict(int)
    for row in rows:
        counts[row[0]] += 1
    print("audit:", dict(counts))
    with open(report_path or "audit.tsv", "w", encoding="utf-8", newline="") as file:
        writer = csv.writer(file, delimiter="\t")
        writer.writerow(["kind", "slug or sku", "name", "where / state", "note"])
        writer.writerows(rows)
    print(f"details in {report_path or 'audit.tsv'}")


def adopt(console, keep_slug, replace_slug, apply):
    """Let the category the DNTrade import feeds (keep) take the place and products of a hand-made duplicate (replace).

    The duplicate is hidden under '<slug>-dubl', so its address is free; the redirect that renaming writes is removed
    again when the kept category takes the address over.
    """
    say = lambda line: print(("APPLY " if apply else "PLAN  ") + line)
    by_slug = {c["slug"]: c for c in console.call("GET", "/catalog/categories")}
    keep, dup = by_slug.get(keep_slug), by_slug.get(replace_slug)
    if keep is None or dup is None:
        sys.exit(f"category not found: {keep_slug if keep is None else replace_slug}")
    if not keep.get("navkoloRef"):
        sys.exit(f"{keep_slug} has no Navkolo reference, so the import does not feed it; nothing to gain")
    ids, page = [], 1
    while True:
        result = console.call("GET", f"/catalog/products?categoryId={dup['id']}&page={page}&pageSize=100")
        ids += [i["id"] for i in result["items"]]
        if page >= result["totalPages"]:
            break
        page += 1
    fields = ("parentId", "name", "slug", "sortOrder", "isVisible", "navkoloRef", "seoTitle", "seoDescription", "imageUrl", "description")
    body = lambda c: {**{k: c.get(k) for k in fields}, "filterAttributes": c.get("filterAttributes") or []}
    say(f"hide {replace_slug} as {replace_slug}-dubl")
    say(f"move {len(ids)} products from {replace_slug} to {keep_slug}")
    say(f"{keep_slug} becomes '{dup['name']}' at /catalog/{replace_slug}, "
        f"{'visible' if dup['isVisible'] else 'hidden'}, sort {dup['sortOrder']}, same parent as the duplicate")
    if not apply:
        return
    console.call("PUT", f"/catalog/categories/{dup['id']}", {**body(dup), "slug": f"{replace_slug}-dubl", "isVisible": False})
    for i in range(0, len(ids), BATCH):
        console.call("POST", "/catalog/products/bulk", {"productIds": ids[i:i + BATCH], "categoryId": keep["id"]})
    taken = body(keep)
    taken.update(name=dup["name"], slug=replace_slug, parentId=dup["parentId"], sortOrder=dup["sortOrder"], isVisible=dup["isVisible"])
    for k in ("seoTitle", "seoDescription", "imageUrl", "description"):
        taken[k] = keep.get(k) or dup.get(k)
    taken["filterAttributes"] = keep.get("filterAttributes") or dup.get("filterAttributes") or []
    console.call("PUT", f"/catalog/categories/{keep['id']}", taken)
    print("done")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("mode", choices=["export", "plan", "apply", "audit", "adopt-plan", "adopt-apply"])
    parser.add_argument("--base", required=True, help="console origin, e.g. https://console.example.ua")
    parser.add_argument("--host", help="Host header when it differs from --base, e.g. console.localhost:8081")
    parser.add_argument("--target", default="target.json")
    parser.add_argument("--out", default="target.json")
    parser.add_argument("--report", help="plan/apply: write every product change (current and wanted value) to this TSV file")
    parser.add_argument("--keep", help="adopt: slug of the category the DNTrade import feeds")
    parser.add_argument("--replace", help="adopt: slug of the hand-made duplicate whose place it takes")
    parser.add_argument("--previous-target", help="plan/apply: target file of an earlier run; values it wrote may be updated")
    parser.add_argument("--fix-names", help='plan/apply: JSON {"sku": {"from": name now, "to": new name}}; replaces a site name only if it is exactly "from"')
    parser.add_argument("--keep-visible", default="", help="plan/apply: comma-separated DNTrade codes the target hides but this run leaves visible")
    args = parser.parse_args()
    console = Console(args.base, args.host)
    console.login()
    if args.mode == "export":
        export(console, args.out)
    elif args.mode.startswith("adopt"):
        adopt(console, args.keep, args.replace, args.mode == "adopt-apply")
    elif args.mode == "audit":
        with open(args.target, encoding="utf-8") as file:
            audit(console, json.load(file), args.report)
    else:
        with open(args.target, encoding="utf-8") as file:
            keep = {s.strip() for s in args.keep_visible.split(",") if s.strip()}
            previous = {}
            if args.previous_target:
                with open(args.previous_target, encoding="utf-8") as before:
                    previous = json.load(before)["products"]
            fixes = {}
            if args.fix_names:
                with open(args.fix_names, encoding="utf-8") as fixes_file:
                    fixes = json.load(fixes_file)
            reconcile(console, json.load(file), args.mode == "apply", args.report, keep, previous, fixes)


if __name__ == "__main__":
    main()
