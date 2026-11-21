"""Annual buyer and delivery geography reports. No address or contact leaves the database."""
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
import logging
from threading import Lock
from time import monotonic

from .invoices import INDEPENDENT_RECEIPTS, currency_valid
from .nova_poshta import read_history, sender_api_key
from .register import kind_of
from .settlements import address_fields, resolve
from .shipments import ShipmentIndex, keys as shipment_keys
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
        coalesce(nullif(profile#>>'{address,region,title}',''),nullif(profile#>>'{address,region}',''),
                 nullif(profile#>>'{region,title}',''),nullif(profile->>'region',''),profile->>'oblast') AS partner_region,
        coalesce(nullif(profile#>>'{address,katottg}',''),nullif(profile#>>'{address,city,title}',''),
                 nullif(profile#>>'{address,city,name}',''),nullif(profile#>>'{address,city}',''),
                 nullif(profile#>>'{city,title}',''),nullif(profile#>>'{city,name}',''),profile->>'city') AS partner_city,
        CASE WHEN jsonb_typeof(profile->'address')='string' THEN profile->>'address' END AS buyer_address,
        nullif(d.details->>'delivery_region','') AS delivery_region, nullif(d.details->>'shipping_region','') AS shipping_region,
        nullif(d.details->>'delivery_city','') AS delivery_city, nullif(d.details->>'shipping_city','') AS shipping_city,
        coalesce(nullif(d.details->>'order_number',''),nullif(d.details#>>'{order,number}',''),
                 nullif(d.details->>'customer_order_number',''),nullif(d.details#>>'{delivery,order_number}',''),
                 CASE WHEN o.id IS NOT NULL OR lower(d.parent_kind) IN ('order','customerorder','замовлення клієнта')
                      THEN nullif(d.details#>>'{parent_document,number}','') END,
                 substring(d.details->>'parent_document' from '^(PV-[0-9]+)$'),
                 substring(d.details->>'note' from '^(PV-[0-9]+)[.] Оплата:')) AS order_number,
        coalesce(nullif(d.details->>'delivery_ttn',''),nullif(d.details#>>'{delivery,delivery_ttn}',''),
                 nullif(d.details->>'ttn',''),nullif(d.details->>'tracking_number',''),
                 substring(d.details->>'note' from '(?:^|[[:space:]])[Тт][Тт][Нн][[:space:]№:#-]*([0-9]{14})(?:[^0-9]|$)')) AS waybill,
        coalesce(nullif(d.details#>>'{order,external_id}',''), o.source_id,
                 CASE WHEN lower(d.parent_kind) IN ('order','customerorder','замовлення клієнта')
                      THEN d.parent_ref END) AS order_ref,
        d.details->>'delivery_address' AS direct_address,
        coalesce(nullif(nullif(d.details->'delivery','{}'::jsonb),'null'::jsonb),o.details->'delivery') AS delivery
 FROM sales d LEFT JOIN identities i ON i.source_account=d.source_account AND i.ref=lower(d.partner_ref)
 LEFT JOIN accounting.partners p ON p.id=coalesce(d.native_partner_id,i.id)
 CROSS JOIN LATERAL (SELECT CASE
   WHEN (jsonb_typeof(d.details#>'{partner,address}')='string' AND nullif(trim(d.details#>>'{partner,address}'),'') IS NOT NULL)
     OR (d.details#>'{partner,address}') ?| array['katottg','region','city']
   THEN d.details->'partner' ELSE p.details END AS profile) buyer_profile
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
       order_number,waybill,order_ref,
       count(*) AS count,sum(abs(total)) FILTER (WHERE abs(total)<=1e15) AS amount,
       max(day) FILTER (WHERE abs(total)<=1e15) AS last_day,
       count(*) FILTER (WHERE total IS NULL OR abs(total)>1e15) AS invalid
FROM located GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19
"""
WEB = """
SELECT s.area AS region,s.name AS city,
       count(*) AS count,sum(o.total) AS amount
FROM ordering.orders o LEFT JOIN delivery.np_settlements s
  ON o.delivery_method IN ('NovaPoshta','NovaPoshtaCourier','nova_poshta','nova_poshta_courier') AND s.ref=o.settlement_ref
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
        return code, place

    def report(self):
        return dict(withAddress=self.with_address, unknown=self.regions.get(None, bucket()), regions=[
            dict(code="UA"+code, name=name, settlements=list(self.places[code].values()),
                 **self.regions.get(code, bucket())) for code, name in REGIONS.items()])


def location(region, city):
    return resolve(region_code(region), city, not (region or "").strip())


def summarize(headers, web, shipments=None, carrier=None):
    buyers = defaultdict(bucket)
    regions, registered, online, combined = Geography(), Geography(), Geography(), Geography()
    shipments = shipments if shipments is not None else ShipmentIndex()
    linkage = dict(ttn=0, number=0, ref=0, ambiguous=0, mapped=0, mappedByRegion={})
    carrier_links = dict(ttn=0, number=0, ambiguous=0, addedByRegion={})
    purchases_with_key = 0
    breakdown = dict(invoices=0, receipts=0, returns=0)
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
        breakdown[{"sale": "invoices", "receipt": "receipts", "return": "returns"}[kind]] += count
        key = row["partner"]
        names[key] = row["name"]
        values = count, row["amount"], kind == "return", row["last_day"]
        add(buyers[key], *values)
        match = shipments.match(row)
        if kind != "return" and any(value for _, value in shipment_keys(row)):
            purchases_with_key += count
        linked = match.status in ("ttn", "number", "ref")
        if kind != "return" and (linked or match.status == "ambiguous"):
            linkage[match.status] += count
        delivery = (row["region"], row.get("city"))
        if linked:
            code, place = resolve(region_code(match.region), match.city, not (match.region or "").strip())
            if code:
                delivery = (match.region, match.city)
                if place and kind != "return":
                    linkage["mapped"] += count
                    regional = linkage["mappedByRegion"]
                    regional["UA"+code] = regional.get("UA"+code, 0) + count
        buyer = (row["buyer_region"], row.get("buyer_city"))
        if carrier is not None and kind == "sale" and row["entity_type"] == "invoice":
            hit = carrier.match(row)
            if hit.status == "ambiguous":
                carrier_links["ambiguous"] += count
            elif hit.status in ("ttn", "number"):
                old_code, old_place = location(*delivery)
                code, place = location(hit.region, hit.city)
                conflict = (match.status == "ambiguous" or (old_code and code and old_code != code)
                            or (old_place and place and old_place.code != place.code))
                if conflict:
                    carrier_links["ambiguous"] += count
                else:
                    carrier_links[hit.status] += count
                    if place:
                        previous = old_place if old_code else location(*buyer)[1]
                        if not previous or previous.region != code:
                            added = carrier_links["addedByRegion"]
                            added["UA"+code] = added.get("UA"+code, 0) + count
                        delivery = (hit.region, hit.city)
        known, _ = regions.record(*delivery, *values, has_address=row.get("has_delivery_address"))
        registered.record(*buyer, *values, has_address=row.get("has_buyer_address"))
        combined.record(*(delivery if known else buyer), *values,
                        has_address=row.get("has_delivery_address") or row.get("has_buyer_address"))
    for row in web:
        online.record(row["region"], row["city"], row["count"], row["amount"])

    ordered = sorted((dict(id=k, name=names[k], **v) for k,v in buyers.items() if k),
                     key=lambda r: (-r["amount"], -r["count"], r["id"]))
    if carrier is not None:
        status = dict(status=carrier.status, months=carrier.months)
        if carrier.status == "complete":
            status.update(documents=carrier.documents, **carrier_links)
        linkage["novaPoshta"] = status
    return dict(partners=ordered, unlinked=buyers.get(None, bucket()), excluded=invalid,
                documents=regions.report(), registered=registered.report(), online=online.report(),
                combined=combined.report(), documentCounts=breakdown,
                shipmentLinks=dict(linkage, purchasesWithKey=purchases_with_key, senderRegisterConfigured=bool(sender_api_key())))


_lock = Lock()
_cache = {}
_carrier_lock = Lock()
_carrier_cache = {}


def log_coverage(year, data):
    for source in ("documents", "registered", "online", "combined"):
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
    logging.getLogger("gunicorn.error").info(
        "Shipment links checked (year=%s, purchasesWithKey=%s, ttn=%s, orderNumber=%s, orderRef=%s, ambiguous=%s, mapped=%s, kyivMapped=%s)",
        year, *(data["shipmentLinks"][k] for k in ("purchasesWithKey","ttn","number","ref","ambiguous","mapped")),
        data["shipmentLinks"]["mappedByRegion"].get("UA32",0))


def markets(year, today, page=1, search="", include_carrier=False):
    cache = _carrier_cache if include_carrier else _cache
    with (_carrier_lock if include_carrier else _lock):
        item = cache.get(year)
        if not item or item[0] <= monotonic() or item[1] != today:
            bounds = date(year, 1, 1), min(date(year+1, 1, 1), today + timedelta(days=1))
            with production() as conn:
                headers = list(conn.execute(DOCUMENTS, bounds*2))
                shipments = ShipmentIndex.read(conn, headers)
                web = list(conn.execute(WEB, bounds))
            carrier = None
            if include_carrier:
                invoices = (r for r in headers if r["entity_type"] == "invoice" and kind_of(r) == "sale"
                            and currency_valid(r) and r["count"] > r["invalid"])
                carrier = read_history(year, today, invoices)
            data = summarize(headers, web, shipments, carrier)
            log_coverage(year, data)
            if carrier is not None and carrier.status == "complete":
                stats = data["shipmentLinks"]["novaPoshta"]
                logging.getLogger("gunicorn.error").info(
                    "Nova Poshta register (year=%d, status=%s, months=%d, documents=%d, ttn=%d, "
                    "number=%d, ambiguous=%d, kyivAdded=%d, providerCode=%s)", year, carrier.status, carrier.months,
                    carrier.documents, stats["ttn"], stats["number"], stats["ambiguous"],
                    stats["addedByRegion"].get("UA32", 0), carrier.error_code)
            elif carrier is not None:
                logging.getLogger("gunicorn.error").info("Nova Poshta register (year=%d, status=%s, months=%d, providerCode=%s)",
                                                        year, carrier.status, carrier.months, carrier.error_code)
            if year not in cache and len(cache) >= 8:
                cache.pop(next(iter(cache)))
            ttl = 60 if carrier is not None and carrier.status != "complete" else 600
            cache[year] = monotonic() + ttl, today, data
        else:
            data = item[2]
    buyers = [r for r in data["partners"] if search.casefold() in r["name"].casefold()]
    return dict(data, year=year, through=str(min(today, date(year, 12, 31))), partnerCount=len(data["partners"]), matches=len(buyers),
                partners=buyers[(page-1)*25:page*25])
