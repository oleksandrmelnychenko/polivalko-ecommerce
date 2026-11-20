"""Annual buyer and delivery geography reports. No address or contact leaves the database."""
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from threading import Lock
from time import monotonic

from .invoices import INDEPENDENT_RECEIPTS, currency_valid
from .register import kind_of
from .source import production


REGIONS = {
    "05": "Вінницька", "07": "Волинська", "09": "Луганська", "12": "Дніпропетровська",
    "14": "Донецька", "18": "Житомирська", "21": "Закарпатська", "23": "Запорізька",
    "26": "Івано-Франківська", "30": "м. Київ", "32": "Київська", "35": "Кіровоградська",
    "40": "м. Севастополь", "43": "АР Крим", "46": "Львівська", "48": "Миколаївська",
    "51": "Одеська", "53": "Полтавська", "56": "Рівненська", "59": "Сумська",
    "61": "Тернопільська", "63": "Харківська", "65": "Херсонська", "68": "Хмельницька",
    "71": "Черкаська", "74": "Чернігівська", "77": "Чернівецька",
}
NAMES = {name.casefold(): code for code, name in REGIONS.items()}
NAMES.update({"київ": "30", "севастополь": "40", "крим": "43", "автономна республіка крим": "43"})


def region_code(raw, city=None):
    city = (city or "").strip().casefold()
    if city in ("київ", "м. київ", "севастополь", "м. севастополь"):
        return NAMES[city]
    value = (raw or "").strip().casefold().replace("’", "'")
    if value.startswith("ua-") and value[3:] in REGIONS:
        return value[3:]
    return NAMES.get(value.removesuffix(" область").removesuffix(" обл.").removesuffix(" обл").strip())


DOCUMENTS = """
WITH sales AS (
 SELECT d.* FROM accounting.documents d WHERE d.entity_type IN ('invoice','customerReturn')
   AND d.day >= %s AND d.day < %s
 UNION ALL SELECT d.* FROM accounting.documents d
""" + INDEPENDENT_RECEIPTS + """
), identities AS (
 SELECT source_account,lower(source_id) AS ref,min(id::text)::uuid AS id FROM accounting.partners
 GROUP BY 1,2 HAVING count(*)=1
), selected AS (
 SELECT d.source_account AS account,d.entity_type,d.kind,d.status,d.currency,d.details->>'type' AS raw_kind,
        d.details->>'status' AS raw_status,d.details->>'currency_iso' AS raw_currency,
        p.id::text AS partner,p.title AS name,d.total,d.day,
        coalesce(nullif(p.details#>>'{address,region,title}',''),nullif(p.details#>>'{address,region}',''),
                 nullif(p.details#>>'{region,title}',''),nullif(p.details->>'region',''),p.details->>'oblast') AS buyer_region,
        coalesce(nullif(d.details#>>'{delivery,region,title}',''),nullif(d.details#>>'{delivery,region}',''),
                 nullif(d.details->>'delivery_region',''),d.details->>'shipping_region') AS region
 FROM sales d LEFT JOIN identities i ON i.source_account=d.source_account AND i.ref=lower(d.partner_ref)
 LEFT JOIN accounting.partners p ON p.id=coalesce(d.native_partner_id,i.id)
)
SELECT account,entity_type,kind,status,currency,raw_kind,raw_status,raw_currency,partner,name,region,buyer_region,
       count(*) AS count,sum(abs(total)) FILTER (WHERE abs(total)<=1e15) AS amount,
       max(day) FILTER (WHERE abs(total)<=1e15) AS last_day,
       count(*) FILTER (WHERE total IS NULL OR abs(total)>1e15) AS invalid
FROM selected GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12
"""
WEB = """
SELECT s.area AS region,CASE WHEN lower(s.name) IN ('київ','севастополь') THEN s.name END AS city,
       count(*) AS count,sum(o.total) AS amount
FROM ordering.orders o LEFT JOIN delivery.np_settlements s
  ON o.delivery_method IN ('nova_poshta','nova_poshta_courier') AND s.ref=o.settlement_ref
WHERE o.created_at >= (%s::date::timestamp AT TIME ZONE 'Europe/Kyiv')
  AND o.created_at < (%s::date::timestamp AT TIME ZONE 'Europe/Kyiv')
  AND o.status IN ('Paid','Shipped','ReadyForPickup','Completed')
GROUP BY 1,2
"""


def bucket():
    return dict(count=0, returns=0, amount=Decimal(0), lastPurchase=None)


def add(bucket_, count, amount, refund=False, last=None):
    bucket_["returns" if refund else "count"] += count
    bucket_["amount"] += -amount if refund else amount
    if last and not refund:
        bucket_["lastPurchase"] = max(bucket_["lastPurchase"] or str(last), str(last))


def summarize(headers, web):
    buyers, regions, registered, online = (defaultdict(bucket) for _ in range(4))
    names, invalid = {}, 0
    for row in headers:
        kind = "receipt" if row["entity_type"] == "receipt" else kind_of(row)
        if kind not in ("sale", "return", "receipt", "invalid") or (kind == "receipt" and row["entity_type"] != "receipt"):
            continue
        if row["entity_type"] != "receipt" and (kind == "invalid" or not currency_valid(row)):
            invalid += row["count"]
            continue
        invalid += row["invalid"]
        count = row["count"] - row["invalid"]
        if not count or row["amount"] is None:
            continue
        key = row["partner"]
        names[key] = row["name"]
        for target in (buyers[key], regions[region_code(row["region"])], registered[region_code(row["buyer_region"])]):
            add(target, count, row["amount"], kind == "return", row["last_day"])
    for row in web:
        add(online[region_code(row["region"], row["city"])], row["count"], row["amount"])

    def geography(data):
        return dict(unknown=data.get(None, bucket()), regions=[
            dict(code="UA"+code, name=name, **data.get(code, bucket())) for code, name in REGIONS.items()])

    ordered = sorted((dict(id=k, name=names[k], **v) for k,v in buyers.items() if k),
                     key=lambda r: (-r["amount"], -r["count"], r["id"]))
    return dict(partners=ordered, unlinked=buyers.get(None, bucket()), excluded=invalid,
                documents=geography(regions), registered=geography(registered), online=geography(online))


_lock = Lock()
_cache = {}


def markets(year, today, page=1, search=""):
    with _lock:
        item = _cache.get(year)
        if not item or item[0] <= monotonic() or item[1] != today:
            bounds = date(year, 1, 1), min(date(year+1, 1, 1), today + timedelta(days=1))
            with production() as conn:
                data = summarize(conn.execute(DOCUMENTS, bounds*2), conn.execute(WEB, bounds))
            if len(_cache) >= 8:
                _cache.pop(next(iter(_cache)))
            _cache[year] = monotonic() + 600, today, data
        else:
            data = item[2]
    buyers = [r for r in data["partners"] if search.casefold() in r["name"].casefold()]
    return dict(data, year=year, partnerCount=len(data["partners"]), matches=len(buyers),
                partners=buyers[(page-1)*25:page*25])
