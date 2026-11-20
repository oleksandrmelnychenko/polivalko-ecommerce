"""Annual buyer and delivery geography reports. No address or contact leaves the database."""
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
import logging
from threading import Lock
from time import monotonic

from .invoices import INDEPENDENT_RECEIPTS, currency_valid
from .register import kind_of
from .settlements import resolve
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
    value = (raw or "").strip().casefold().replace("’", "'")
    if value.startswith("ua-") and value[3:] in REGIONS:
        code = value[3:]
    else:
        code = NAMES.get(value.removesuffix(" область").removesuffix(" обл.").removesuffix(" обл").strip())
    return resolve(code, city, not value)[0] if city else code


# Extract locality fragments in PostgreSQL. House numbers, street addresses
# and delivery contact fields are never returned to the report.
def address_fields(column):
    name = r"[а-яА-ЯіІїЇєЄґҐ’''ʼ -]{2,60}"
    # Street separators and a leading postal code occur in legacy text addresses.
    # Only the locality capture group is projected out of PostgreSQL.
    street = r"(?:[Вв]ул\.|[Вв]улиця|[Пп]ров\.|[Пп]ровулок|[Пп]росп\.|[Пп]роспект|[Бб]ул\.)"
    end = rf"(?:[,;]|[[:space:]]+{street}|$)"
    city = rf"""coalesce(
      substring({column} COLLATE "C" from '(?:^|[,;[:space:]])((?:[Мм]\.|[Сс]\.|[Мм]істо |[Сс]ело |[Сс]елище |смт\.? )[[:space:]]*{name}){end}'),
      substring({column} COLLATE "C" from '(?:^|[,;])[[:space:]]*([А-ЯІЇЄҐ]{name})[,;][[:space:]]*{street}'),
      substring({column} COLLATE "C" from '^[[:space:]]*(?:[0-9]{{5}}[,;[:space:]]+)?([А-ЯІЇЄҐ][а-яА-ЯіІїЇєЄґҐ’''ʼ -]{{1,48}}){end}'))"""
    region = rf"""substring({column} COLLATE "C" from '([а-яА-ЯіІїЇєЄґҐ-]+)[[:space:]]+[Оо]бл(?:асть|\.)?(?:[,;[:space:]]|$)')"""
    return city, region


DELIVERY_CITY, DELIVERY_REGION = address_fields("shipping_address")
BUYER_CITY, BUYER_REGION = address_fields("buyer_address")


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
                 nullif(p.details#>>'{region,title}',''),nullif(p.details->>'region',''),p.details->>'oblast') AS partner_region,
        coalesce(nullif(p.details#>>'{address,katottg}',''),nullif(p.details#>>'{address,city,title}',''),
                 nullif(p.details#>>'{address,city,name}',''),nullif(p.details#>>'{address,city}',''),
                 nullif(p.details#>>'{city,title}',''),nullif(p.details#>>'{city,name}',''),p.details->>'city') AS partner_city,
        CASE WHEN jsonb_typeof(p.details->'address')='string' THEN p.details->>'address' END AS buyer_address,
        nullif(d.details->>'delivery_region','') AS delivery_region, nullif(d.details->>'shipping_region','') AS shipping_region,
        nullif(d.details->>'delivery_city','') AS delivery_city, nullif(d.details->>'shipping_city','') AS shipping_city,
        d.details->>'delivery_address' AS direct_address,
        coalesce(nullif(nullif(d.details->'delivery','{}'::jsonb),'null'::jsonb),o.details->'delivery') AS delivery
 FROM sales d LEFT JOIN identities i ON i.source_account=d.source_account AND i.ref=lower(d.partner_ref)
 LEFT JOIN accounting.partners p ON p.id=coalesce(d.native_partner_id,i.id)
 LEFT JOIN accounting.documents o ON o.entity_type='order' AND o.source_account=d.source_account
     AND o.source_id=coalesce(nullif(d.parent_ref,''), CASE WHEN jsonb_typeof(d.details->'parent_document')='string'
          THEN nullif(d.details->>'parent_document','') END)
     AND (lower(d.parent_kind) IN ('order','customerorder','замовлення клієнта')
          OR (nullif(d.parent_kind,'') IS NULL AND NOT EXISTS (
              SELECT 1 FROM accounting.documents other WHERE other.source_account=o.source_account
              AND other.source_id=o.source_id AND other.entity_type<>'order')))
), addresses AS (
 SELECT s.*, coalesce(nullif(delivery->>'delivery_address',''), direct_address) AS shipping_address
 FROM selected s
), located AS (
 SELECT a.*,
   CASE WHEN lower(coalesce(delivery->>'delivery_type','')) NOT IN ('самовивіз','самовывоз','pickup') THEN
     coalesce(nullif(delivery#>>'{region,title}',''),nullif(delivery->>'region',''), delivery_region,shipping_region,
              """ + DELIVERY_REGION + """) END AS region,
   CASE WHEN lower(coalesce(delivery->>'delivery_type','')) NOT IN ('самовивіз','самовывоз','pickup') THEN
     coalesce(nullif(delivery->>'katottg',''),nullif(delivery#>>'{city,title}',''),nullif(delivery#>>'{city,name}',''),
              nullif(delivery->>'city',''),nullif(delivery#>>'{settlement,name}',''),nullif(delivery->>'settlement',''),
              delivery_city,shipping_city,""" + DELIVERY_CITY + """) END AS city,
   coalesce(partner_region,""" + BUYER_REGION + """) AS buyer_region,
   coalesce(nullif(partner_city,''),""" + BUYER_CITY + """) AS buyer_city
 FROM addresses a
)
SELECT account,entity_type,kind,status,currency,raw_kind,raw_status,raw_currency,partner,name,region,buyer_region,city,buyer_city,
       nullif(trim(shipping_address),'') IS NOT NULL AS has_delivery_address,
       nullif(trim(buyer_address),'') IS NOT NULL AS has_buyer_address,
       count(*) AS count,sum(abs(total)) FILTER (WHERE abs(total)<=1e15) AS amount,
       max(day) FILTER (WHERE abs(total)<=1e15) AS last_day,
       count(*) FILTER (WHERE total IS NULL OR abs(total)>1e15) AS invalid
FROM located GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16
"""
WEB = """
SELECT s.area AS region,s.name AS city,
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


class Geography:
    def __init__(self):
        self.regions = defaultdict(bucket)
        self.places = defaultdict(dict)
        self.with_address = 0

    def record(self, region, city, count, amount, refund=False, last=None, has_address=False):
        if not refund and (has_address or region or city):
            self.with_address += count
        code, place = resolve(region_code(region), city, not (region or "").strip())
        add(self.regions[code], count, amount, refund, last)
        if place:
            places = self.places[code]
            if place.code not in places:
                prefix = {"M": "м.", "C": "с.", "X": "с-ще"}.get(place.kind, "")
                places[place.code] = dict(code=place.code, name=f"{prefix} {place.name}".strip(),
                                          x=place.x, y=place.y, **bucket())
            add(places[place.code], count, amount, refund, last)

    def report(self):
        return dict(withAddress=self.with_address, unknown=self.regions.get(None, bucket()), regions=[
            dict(code="UA"+code, name=name, settlements=list(self.places[code].values()),
                 **self.regions.get(code, bucket())) for code, name in REGIONS.items()])


def summarize(headers, web):
    buyers = defaultdict(bucket)
    regions, registered, online = Geography(), Geography(), Geography()
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
        values = count, row["amount"], kind == "return", row["last_day"]
        add(buyers[key], *values)
        regions.record(row["region"], row.get("city"), *values, has_address=row.get("has_delivery_address"))
        registered.record(row["buyer_region"], row.get("buyer_city"), *values, has_address=row.get("has_buyer_address"))
    for row in web:
        online.record(row["region"], row["city"], row["count"], row["amount"])

    ordered = sorted((dict(id=k, name=names[k], **v) for k,v in buyers.items() if k),
                     key=lambda r: (-r["amount"], -r["count"], r["id"]))
    return dict(partners=ordered, unlinked=buyers.get(None, bucket()), excluded=invalid,
                documents=regions.report(), registered=registered.report(), online=online.report())


_lock = Lock()
_cache = {}


def log_coverage(year, data):
    for source in ("documents", "registered", "online"):
        geography = data[source]
        regions = geography["regions"]
        kyiv = next(r for r in regions if r["code"] == "UA32")
        unknown = geography["unknown"]["count"]
        logging.getLogger("gunicorn.error").info(
            "Buyer geography checked (year=%s, source=%s, partners=%s, sales=%s, unknown=%s, "
            "withAddress=%s, places=%s, kyivRegionSales=%s, kyivPlaces=%s, kyivMappedSales=%s)",
            year, source, len(data["partners"]), unknown + sum(r["count"] for r in regions), unknown,
            geography["withAddress"], sum(len(r["settlements"]) for r in regions),
            kyiv["count"], len(kyiv["settlements"]), sum(p["count"] for p in kyiv["settlements"]))


def markets(year, today, page=1, search=""):
    with _lock:
        item = _cache.get(year)
        if not item or item[0] <= monotonic() or item[1] != today:
            bounds = date(year, 1, 1), min(date(year+1, 1, 1), today + timedelta(days=1))
            with production() as conn:
                data = summarize(conn.execute(DOCUMENTS, bounds*2), conn.execute(WEB, bounds))
            log_coverage(year, data)
            if len(_cache) >= 8:
                _cache.pop(next(iter(_cache)))
            _cache[year] = monotonic() + 600, today, data
        else:
            data = item[2]
    buyers = [r for r in data["partners"] if search.casefold() in r["name"].casefold()]
    return dict(data, year=year, partnerCount=len(data["partners"]), matches=len(buyers),
                partners=buyers[(page-1)*25:page*25])
