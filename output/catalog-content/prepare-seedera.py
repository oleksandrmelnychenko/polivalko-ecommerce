import json
import re
import subprocess
import unicodedata
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
from pathlib import Path
from urllib.parse import unquote, urlsplit

from lxml import html
from lxml.etree import ParserError


FOLDER = Path(__file__).resolve().parent
ROOT = FOLDER.parent.parent
CACHE = ROOT / ".local" / "supplier-catalogs" / "seedera"
DOMAIN = "s-sad.com.ua"
INDEX = f"https://{DOMAIN}/ovoshi/"
FIELDS = {
    "строки достигання": "Строк достигання",
    "строки дозрівання": "Строк достигання",
    "терміни дозрівання": "Строк достигання",
    "маса плоду": "Маса плоду",
    "тип плоду": "Тип плоду",
    "колір плоду": "Колір плоду",
    "форма плоду": "Форма плоду",
    "довжина плоду": "Довжина плоду",
    "форма головки": "Форма головки",
    "щільність": "Щільність головки",
    "форма коренеплоду": "Форма коренеплоду",
    "маса коренеплоду": "Маса коренеплоду",
    "колір коренеплоду": "Колір коренеплоду",
    "тип росту": "Тип росту",
    "висота рослини": "Висота рослини",
    "спосіб вирощування": "Спосіб вирощування",
}
MATURITY = {
    "ранній": "раннього", "ранньостиглий": "раннього",
    "середньоранній": "середньораннього", "середньорання": "середньораннього",
    "середній": "середнього", "середньостиглий": "середнього",
    "середньопізній": "середньопізнього", "пізній": "пізнього", "пізньостиглий": "пізнього",
}
ALIASES = {"10002": "Кабачок Цукеша"}


def tidy(value):
    return " ".join(value.split())


def key(value):
    normalized = unicodedata.normalize("NFKC", value).casefold()
    normalized = re.sub(r"[’ʼ'`\u2018]", "", normalized)
    return tidy(re.sub(r"[^\w]+", " ", normalized))


def official(url, prefix="/"):
    parsed = urlsplit(url)
    return parsed.scheme == "https" and parsed.netloc == DOMAIN and parsed.path.startswith(prefix)


def read_page(url):
    if not official(url):
        raise ValueError(f"Unexpected SeedEra URL: {url}")
    cache = CACHE / (sha256(url.encode()).hexdigest() + ".html")
    if cache.exists():
        content = cache.read_bytes()
    else:
        response = subprocess.run(
            ["curl.exe", "--fail", "--silent", "--show-error", "--max-time", "15", "--retry", "1", url],
            capture_output=True,
        )
        if response.returncode:
            print(f"Unavailable SeedEra page: {url}", flush=True)
            return None
        content = response.stdout
    try:
        page = html.fromstring(content.decode("utf-8"))
    except (ParserError, UnicodeError):
        print(f"Invalid SeedEra page: {url}", flush=True)
        return None
    if not cache.exists():
        cache.write_bytes(content)
    return page


def links(page, prefix):
    for anchor in page.xpath(".//div[contains(concat(' ', normalize-space(@class), ' '), ' prod-list-cont ')]//a[contains(concat(' ', normalize-space(@class), ' '), ' box ')]"):
        url = anchor.get("href", "")
        if official(url, prefix):
            yield url, tidy(anchor.text_content())


def category(url):
    products = []
    visited = set()
    while url and url not in visited and len(visited) < 30:
        page = read_page(url)
        if page is None:
            break
        products.extend(links(page, "/ovoshy/"))
        visited.add(url)
        next_url = page.xpath("string(//head/link[@rel='next']/@href)")
        url = next_url if official(next_url, "/ovoshi/") else None
    return products


def packaging(value):
    return value.replace(",", ".").replace("-", ".").replace("_", ".")


def photo_for_package(images, amount, unit):
    unit_options = ("g", "gr", "grm", "г") if unit == "г" else ("sht", "шт", "sem")
    pattern = r"(?:^|[^\d])(\d+(?:[.,_-]\d{1,2})?)[ _-]*(?:" + "|".join(unit_options) + r")(?=[^a-zа-яієї]|$)"
    precise = []
    for url in dict.fromkeys(images):
        if not official(url, "/wp-content/uploads/"):
            continue
        name = unquote(Path(urlsplit(url).path).stem).casefold()
        variants = re.findall(pattern, name)
        if len(variants) == 1 and packaging(variants[0]) == packaging(amount):
            precise.append(url)
    return precise[0] if len(precise) == 1 else None


def facts_for_page(page):
    facts = {}
    for block in page.xpath(".//section[@class='single-card']//div[@class='right-info']//p"):
        for br in block.xpath(".//br"):
            br.tail = "\n" + (br.tail or "")
        for line in block.text_content().splitlines():
            label, sep, value = tidy(line).partition(":")
            field = FIELDS.get(label.casefold())
            value = tidy(value).rstrip(".")
            if sep and field and 1 <= len(value) <= 65 and value.casefold() not in {"невідомо", "не відомо", "-"}:
                facts.setdefault(field, value)
    return facts


def prepare(record):
    item, expected_title, amount, unit, url = record
    page = read_page(url)
    if page is None:
        return None
    headings = page.xpath(".//h1[@class='page-title']")
    if len(headings) != 1 or key(headings[0].text_content()) != key(expected_title):
        return None
    facts = facts_for_page(page)
    if len(facts) < 2:
        return None

    display = f"{expected_title} SeedEra, {amount} {unit}"
    maturity = MATURITY.get(facts.get("Строк достигання", "").casefold())
    introduction = f"{expected_title} від SeedEra."
    if maturity:
        plant = "Гібрид" if re.search(r"\bF1\b", expected_title, re.I) else "Сорт"
        introduction += f" {plant} {maturity} строку достигання."
    detail_labels = ("Маса плоду", "Маса коренеплоду", "Довжина плоду", "Форма плоду", "Форма головки",
                     "Форма коренеплоду", "Висота рослини", "Спосіб вирощування", "Тип плоду")
    details = [f"{name} — {facts[name]}." for name in detail_labels if name in facts][:2]
    description = " ".join([introduction, *details, f"Фасування — {amount} {unit}."])
    images = page.xpath(".//section[@class='single-card']//div[contains(concat(' ', normalize-space(@class), ' '), ' slider-main ')]//a[@class='fan-gall']/@href")
    photo = photo_for_package(images, amount, unit)
    fields = {"Фасування": f"{amount} {unit}", **facts}
    result = {
        "sku": item["sku"], "catalogName": item["name"], "brand": "SeedEra", "displayName": display,
        "description": description, "sourceUrl": url,
        "attributes": [{"name": name, "value": value} for name, value in fields.items()],
    }
    if photo:
        result["photos"] = [{"url": photo, "alt": f"Пакування насіння {display}"}]
    return result


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    audit = json.loads((FOLDER / "catalog-audit.json").read_text(encoding="utf-8"))
    candidates = []
    for item in audit["pending"]:
        if not (item["matched"] and item["needsDescription"] and item["inStock"]):
            continue
        package = re.fullmatch(r"(.+?)\s+Seedera,?\s*(\d+(?:[,.]\d+)?)\s*(г|шт)\.?", item["name"], re.I)
        if package:
            name, amount, unit = package.groups()
            candidates.append((item, ALIASES.get(item["sku"], name), amount.replace(".", ","), unit.casefold()))

    index = read_page(INDEX)
    if index is None:
        raise SystemExit("SeedEra index is unavailable.")
    categories = dict(links(index, "/ovoshi/"))
    by_name = defaultdict(dict)
    with ThreadPoolExecutor(max_workers=5) as workers:
        for products in workers.map(category, categories):
            for url, title in products:
                by_name[key(title)][url] = title
        selected = []
        for item, name, amount, unit in candidates:
            sources = by_name[key(name)]
            if len(sources) == 1:
                url, title = next(iter(sources.items()))
                selected.append((item, title, amount, unit, url))
        results = [row for row in workers.map(prepare, selected) if row]

    target = CACHE / "seedera-candidates.json"
    target.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"catalogCandidates": len(candidates), "uniqueCultivars": len(selected), "descriptionCandidates": len(results),
                      "packagePhotoCandidates": sum("photos" in row for row in results)}))


if __name__ == "__main__":
    main()
