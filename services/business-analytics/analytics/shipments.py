"""Read-only shipment coverage for the annual sales map."""
from datetime import date
import logging
import re
from collections import defaultdict
from typing import NamedTuple

from .source import production
from .settlements import address_fields


WEB_SHIPPED = """
SELECT o.id::text AS id, o.number,
       s.area AS region, coalesce(nullif(s.name,''),o.settlement_name) AS city
FROM ordering.orders o LEFT JOIN delivery.np_settlements s ON s.ref=o.settlement_ref
WHERE o.delivery_method IN ('NovaPoshta','NovaPoshtaCourier','nova_poshta','nova_poshta_courier')
  AND (o.navkolo_shipped_at IS NOT NULL OR o.status IN ('Shipped','Completed')
       OR EXISTS (SELECT 1 FROM accounting.order_shipments sh WHERE sh.order_id=o.id)
       OR EXISTS (SELECT 1 FROM ordering.order_status_changes h WHERE h.order_id=o.id AND h."to"='Shipped'))
"""

# Orders can be placed before the invoice year, or dispatched after year end.
# The invoice fixes the reporting period. Only matching order headers are returned.
_city, _region = address_fields("address")
ARCHIVE_ORDERS = """
WITH records AS (
 SELECT source_account AS account,source_id AS id,payload::jsonb->'raw' AS raw
 FROM integration.dntrade_archive_records WHERE entity_type='order'
), keys AS (
 SELECT account,id,trim(raw->>'number') AS number,trim(raw->>'private_id') AS private_number,
        lower(trim(raw->>'external_id')) AS external,lower(trim(raw->>'client_external_id')) AS client,
        raw->'delivery' AS delivery,lower(raw->>'status') AS order_status,
        upper(regexp_replace(coalesce(nullif(raw#>>'{delivery,delivery_ttn}',''),raw->>'delivery_ttn',raw->>'ttn'),
                             '[[:space:]-]+','','g')) AS ttn
 FROM records
), wanted AS (
 SELECT k.*, delivery->>'delivery_address' AS address FROM keys k
 WHERE number=ANY(%s::text[]) OR private_number=ANY(%s::text[]) OR ttn=ANY(%s::text[])
    OR lower(id)=ANY(%s::text[]) OR external=ANY(%s::text[]) OR client=ANY(%s::text[])
)
SELECT account,id,number,private_number,external,client,ttn,order_status,delivery->>'delivery_type' AS method,
       delivery->>'start_delivery' AS started,delivery->>'start_delivery_date' AS sent_at,
       delivery->>'delivery_status' AS state,
       coalesce(nullif(delivery#>>'{region,title}',''),nullif(delivery->>'region',''),""" + _region + """) AS region,
       coalesce(nullif(delivery->>'katottg',''),nullif(delivery#>>'{city,title}',''),nullif(delivery#>>'{city,name}',''),
                nullif(delivery->>'recipient_city',''),nullif(delivery->>'city',''),nullif(delivery#>>'{settlement,name}',''),
                """ + _city + """) AS city
FROM wanted
"""


def waybill(value):
    compact = re.sub(r"[\s-]+", "", (value or "").upper())
    if re.fullmatch(r"[A-Z0-9]{8,35}", compact) and any(c.isdigit() for c in compact) and len(set(compact)) > 1:
        return compact
    return ""


def keys(row):
    return (("number", (row.get("order_number") or "").strip()),
            ("ttn", waybill(row.get("waybill"))),
            ("ref", (row.get("order_ref") or "").strip().lower()))


def dispatched(row):
    def value(key):
        return (row.get(key) or "").strip().casefold()
    if (value("method") in {"pickup", "самовивіз", "самовывоз"} or
        value("order_status") in {"draft", "cancelled", "canceled", "deleted", "скасовано", "видалено"} or
        value("state") in {"cancelled", "canceled", "deleted", "скасовано", "відмінено", "анульовано"}):
        return False
    if (value("started") in {"1", "true"} or re.match(r"^[1-9]\d{3}-\d\d-\d\d", value("sent_at")) or
        value("state") in {"shipped", "delivered", "відправлено", "відправлено одержувачу", "доставлено", "отримано"}):
        return True
    return bool(waybill(row.get("ttn"))) and value("started") not in {"0", "false"}


class Match(NamedTuple):
    status: str = "unmatched"
    region: str | None = None
    city: str | None = None


class ShipmentIndex:
    def __init__(self, archive=(), web=()):
        self.aliases = defaultdict(set)
        self.known_keys = defaultdict(set)
        self.destinations = {}
        web_by_id = {w["id"].lower(): w for w in web}
        for w in web_by_id.values():
            identity = ("web", w["id"])
            self.destinations[identity] = (w["region"], w["city"])
            self._alias(None, "number", w["number"], identity)
        for r in archive:
            # The storefront exports its UUID and verifies the provider echoes it.
            web_ids = {value for value in (r["id"].lower(),r.get("external"),r.get("client")) if value in web_by_id}
            identity = ("web",web_ids.pop()) if len(web_ids) == 1 else ("archive", r["account"], r["id"])
            if dispatched(r) and (identity not in self.destinations or not any(self.destinations[identity])):
                self.destinations[identity] = (r["region"], r["city"])
            for kind, value in (("number",r["number"]), ("number",r.get("private_number")), ("ttn",waybill(r["ttn"])),
                                ("ref",r["id"].lower()), ("ref",r.get("external"))):
                self._alias(r["account"], kind, value, identity)

    def _alias(self, account, kind, value, identity):
        if value:
            self.aliases[(account, kind, value)].add(identity)
            self.known_keys[(identity, kind)].add(value)

    @classmethod
    def read(cls, conn, headers):
        wanted = defaultdict(set)
        for row in headers:
            for kind, value in keys(row):
                if value:
                    wanted[kind].add(value)
        if not wanted:
            return cls()
        web = list(conn.execute(WEB_SHIPPED))
        numbers = sorted(wanted["number"])
        web_ids = {r["id"] for r in web}
        refs = sorted(wanted["ref"] | web_ids)
        params = (numbers, numbers, sorted(wanted["ttn"]), refs, refs, sorted(web_ids))
        return cls(conn.execute(ARCHIVE_ORDERS, params), web)

    def match(self, row):
        matches = []
        supplied = keys(row)
        for kind, value in supplied:
            if not value:
                continue
            found = self.aliases.get((row["account"],kind,value), set())
            if kind == "number" and re.fullmatch(r"PV-\d+", value):
                found = found | self.aliases.get((None, kind, value), set())
            if found:
                matches.append((kind,found))
        if not matches:
            return Match()
        common = set.intersection(*(ids for _,ids in matches))
        if len(common) != 1:
            return Match("ambiguous")
        identity = next(iter(common))
        for kind, value in supplied:
            known = self.known_keys.get((identity,kind))
            if value and known and value not in known:
                return Match("ambiguous")
        destination = self.destinations.get(identity)
        if destination is None:
            return Match()
        kind = next(k for k in ("ttn","number","ref") if any(m[0] == k for m in matches))
        return Match(kind,*destination)


def check_shipment_sources(year):
    start, end = date(year, 1, 1), date(year + 1, 1, 1)
    with production() as conn:
        relations = conn.execute("""
            SELECT DISTINCT table_schema, table_name FROM information_schema.columns
            WHERE table_schema NOT IN ('pg_catalog','information_schema')
              AND (table_name ~* '(shipment|waybill|consignment|parcel|tracking|dispatch|carrier|ttn)'
                OR column_name ~* '(delivery_ttn|tracking_number|waybill_number|consignment_number|recipient_city)')
            ORDER BY 1,2
        """)
        names = [r["table_schema"]+"."+r["table_name"] for r in relations]
        archive = conn.execute("""
            WITH orders AS (
              SELECT payload::jsonb#>'{raw,delivery}' AS delivery, source_day >= %s AND source_day < %s AS in_year
              FROM integration.dntrade_archive_records WHERE entity_type='order'
            )
            SELECT count(*) FILTER (WHERE in_year) AS orders,
                   count(*) FILTER (WHERE in_year AND jsonb_typeof(delivery)='object') AS delivery,
                   count(*) FILTER (WHERE in_year AND nullif(trim(delivery->>'delivery_ttn'),'') IS NOT NULL) AS waybills,
                   count(*) AS all_orders,
                   count(*) FILTER (WHERE nullif(trim(delivery->>'delivery_ttn'),'') IS NOT NULL) AS all_waybills
            FROM orders
        """, (start, end)).fetchone()
        stock = conn.execute("""
            SELECT count(DISTINCT order_id) AS orders FROM accounting.order_shipments
            WHERE posted_at >= (%s::date::timestamp AT TIME ZONE 'Europe/Kyiv')
              AND posted_at < (%s::date::timestamp AT TIME ZONE 'Europe/Kyiv')
        """, (start, end)).fetchone()
        manifests = conn.execute("""
            SELECT count(*) AS reports FROM integration.dntrade_archive_records
            WHERE entity_type='sourceReport' AND document_type ~*
              '(waybill|shipment|consignment|реєстр ттн|відправлен|експрес.наклад)'
        """).fetchone()
    logging.getLogger("gunicorn.error").info(
        "Shipment sources checked (year=%s, archiveOrders=%s, withDelivery=%s, withWaybill=%s, "
        "warehouseOrdersShipped=%s, archiveOrdersAllYears=%s, waybillsAllYears=%s, carrierReports=%s, relations=%s)",
        year, archive["orders"], archive["delivery"], archive["waybills"], stock["orders"],
        archive["all_orders"], archive["all_waybills"], manifests["reports"], ",".join(names))
