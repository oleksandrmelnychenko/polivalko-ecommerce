import json
import os
import socket
from contextlib import contextmanager
from decimal import Decimal
from functools import partial
from ipaddress import ip_address
from pathlib import Path

import psycopg
from psycopg.conninfo import conninfo_to_dict
from psycopg.rows import dict_row
from psycopg.types.json import set_json_loads


def hosted():
    return bool(os.environ.get("ANALYTICS_PRODUCTION_PROJECT"))


def target():
    if hosted():
        if (os.environ.get("VERCEL_ENV") != "production"
                or os.environ.get("VERCEL_PROJECT_ID") != os.environ["ANALYTICS_PRODUCTION_PROJECT"]):
            raise ValueError("Підключення дозволено лише у виробничому проєкті")
        host = os.environ["PGHOST_UNPOOLED"].strip().lower()
        database = os.environ["PGDATABASE"].strip()
        if not host.endswith(".neon.tech"):
            raise ValueError("Невідомий сервер виробничої інтеграції")
        config = dict(host=host, dbname=database, user=os.environ["PGUSER"],
                      password=os.environ["PGPASSWORD"], port="5432", sslmode="verify-full",
                      sslrootcert="/etc/ssl/certs/ca-certificates.crt")
        platform_vars = {"PGHOST_UNPOOLED", "PGHOST", "PGDATABASE", "PGUSER", "PGPASSWORD", "PGPORT", "PGSSLMODE"}
    else:
        host = os.environ["PRODUCTION_ANALYTICS_HOST"].strip().lower()
        database = os.environ["PRODUCTION_ANALYTICS_DATABASE"].strip()
        dsn = Path(os.environ["PRODUCTION_ANALYTICS_DSN_FILE"]).read_text().strip()
        config = conninfo_to_dict(dsn)
        platform_vars = set()
    # Pin both identities separately from the secret. Never inherit a service,
    # socket, alternate endpoint, or libpq environment override.
    allowed = {"host", "port", "dbname", "user", "password", "sslmode", "sslrootcert", "sslcert", "sslkey"}
    if (
        not host
        or not database
        or not config.get("user")
        or set(config) - allowed
        or config.get("host", "").lower() != host
        or config.get("dbname") != database
        or any(c in host for c in ",/\\")
        or host == "localhost"
        or host.endswith(".localhost")
        or host in {"host.docker.internal", "gateway.docker.internal"}
        or any(key.startswith("PG") and key not in platform_vars for key in os.environ)
    ):
        raise ValueError("Некоректне виробниче підключення")
    config.setdefault("sslmode", "verify-full")
    cluster = os.environ.get("PRODUCTION_ANALYTICS_CLUSTER_ID", "").strip()
    internal = host == "production-analytics-postgres"
    if internal and not (cluster.isascii() and cluster.isdigit() and len(cluster) <= 20):
        raise ValueError("Вкажіть ідентифікатор виробничого кластера PostgreSQL")
    if config["sslmode"] not in {"verify-full", "verify-ca", "require"} and not (
        internal and config["sslmode"] == "disable"
    ):
        raise ValueError("Виробниче підключення потребує TLS")
    if config["sslmode"] == "verify-full":
        config.setdefault("sslrootcert", "system")
    addresses = list(
        dict.fromkeys(
            a[4][0] for a in socket.getaddrinfo(host, config.get("port", 5432), type=socket.SOCK_STREAM)
        )
    )
    for value in addresses:
        ip = ip_address(value)
        ip = getattr(ip, "ipv4_mapped", None) or ip
        if ip.is_loopback or ip.is_unspecified or ip.is_link_local or ip.is_multicast:
            raise ValueError("Локальне підключення заборонено")
    connection = dict(
        config,
        host=",".join([host] * len(addresses)),
        hostaddr=",".join(addresses),
        connect_timeout=12,
        application_name="polivalko-business-analytics",
    )
    if not hosted():
        connection["options"] = "-c default_transaction_read_only=on -c statement_timeout=120000 -c lock_timeout=3000"
    return connection


@contextmanager
def production():
    settings = target()
    if hosted():
        from .neon import connect
        connection = connect(settings)
    else:
        connection = psycopg.connect(**settings, row_factory=dict_row)
    with connection as conn:
        if not hosted():
            set_json_loads(partial(json.loads, parse_float=Decimal), conn)
        conn.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
        if hosted():
            conn.execute("SET LOCAL statement_timeout = '120s'")
            conn.execute("SET LOCAL lock_timeout = '3s'")
        check = conn.execute(
            "SELECT current_database() AS db, current_setting('transaction_read_only') AS ro"
        ).fetchone()
        database = os.environ["PGDATABASE" if hosted() else "PRODUCTION_ANALYTICS_DATABASE"]
        if check["db"] != database or check["ro"] != "on":
            raise RuntimeError("Не вдалося підтвердити виробниче підключення")
        cluster = os.environ.get("PRODUCTION_ANALYTICS_CLUSTER_ID", "").strip()
        if cluster:
            identity = conn.execute(
                "SELECT system_identifier::text AS id FROM pg_catalog.pg_control_system()"
            ).fetchone()
            if identity["id"] != cluster:
                raise RuntimeError("Ідентифікатор виробничого кластера не збігається")
        yield conn


def archived_rows(conn, query, params):
    # Page on the (source_day, id) index inside the caller's repeatable-read
    # transaction. Each statement releases its execution memory before the next.
    after = ()
    limit = 128
    while True:
        seek = " AND (r.source_day, r.id) > (%s::date, %s::uuid)" if after else ""
        batch = conn.execute(query + seek + " ORDER BY r.source_day, r.id LIMIT %s",
                             (*params, *after, limit)).fetchall()
        for row in batch:
            envelope = json.loads(row.pop("payload"), parse_float=Decimal)
            envelope = envelope if isinstance(envelope, dict) else {}
            raw = envelope.get("raw")
            raw = raw if isinstance(raw, dict) else {}
            yield dict(row, code=envelope.get("providerTypeCode"), requested=envelope.get("requestedStatus"),
                       raw_status=raw.get("status"), raw_kind=raw.get("type"), external=raw.get("external_id"),
                       client=raw.get("client_external_id"), raw_currency=raw.get("currency_iso"),
                       number=str(raw["number"]) if raw.get("number") is not None else None,
                       parent_document=raw.get("parent_document"),
                       products=None if row["entity"] == "order" else raw.get("products"))
        if len(batch) < limit:
            return
        after = (batch[-1]["day"], batch[-1]["id"])


INVENTORY_UNITS = """
LEFT JOIN (
    SELECT 'dntrade-code:' || l.code AS navkolo_id, min(lower(trim(l.unit))) AS unit
    FROM accounting.inventory_lines l JOIN accounting.inventory_reports r ON r.id=l.report_id
    WHERE r.source_account='valko-dntrade' AND nullif(trim(l.unit),'') IS NOT NULL
    GROUP BY l.code HAVING count(DISTINCT lower(trim(l.unit)))=1
) u ON u.navkolo_id=p.navkolo_id
"""
CATALOG = """
SELECT p.id::text AS id, p.navkolo_id, p.sku, coalesce(nullif(p.display_name,''),p.name) AS name,
       p.category_id::text AS category, c.name AS category_name, u.unit
FROM catalog.products p LEFT JOIN catalog.categories c ON c.id=p.category_id
""" + INVENTORY_UNITS
REFERENCES = (
    "SELECT id::text, source_account AS account, kind, source_id AS ref, title FROM accounting.references"
)
# Use the live archive for imports. Its accounting projection is insert-triggered
# and may still contain the old body after a source correction or deletion.
# The day of a document is the date written in it (source_day). DNTrade marks the shop's own clock
# time as UTC: receipts stamped 14:46Z were already in this archive at 13:05 UTC. Reading the stamp
# as an instant would move a document entered after nine in the evening to the next day.
ARCHIVE_SQL = """
SELECT id::text, source_account AS account, source_id AS ref, entity_type AS entity,
       source_day AS day, document_type AS kind, status, currency, total, store_ids, organization_id AS org,
       parent_source_id AS parent, payload
FROM integration.dntrade_archive_records r
WHERE r.entity_type IN ('invoice','receipt','customerReturn','order') AND DAY_FILTER
"""
ARCHIVE = ARCHIVE_SQL.replace("DAY_FILTER", "r.source_day <= %s")
NATIVE = """
SELECT id::text, source_account AS account,source_id AS ref,entity_type AS entity,day,kind,status,currency,total,
       native_org_id::text AS org, ARRAY[native_store_id::text] AS store_ids, number, details->'products' AS products
FROM accounting.documents WHERE native_partner_id IS NOT NULL AND kind IN ('out','customerReturn') AND day <= %s
"""
WEB = """
SELECT o.id::text AS order_id, o.number AS number, o.navkolo_order_ref AS upstream,
       (o.created_at AT TIME ZONE 'Europe/Kyiv')::date AS day, i.product_id::text AS product,
       i.name, i.sku, i.quantity, i.line_total AS total, sh.org_id::text AS org, sh.store_id::text AS store,
       o.id::text AS id, false AS refund
FROM ordering.orders o JOIN ordering.order_items i ON i.order_id=o.id
LEFT JOIN accounting.order_shipments sh ON sh.order_id=o.id AND sh.product_id=i.product_id
WHERE (o.status IN ('Confirmed','Paid','Shipped','ReadyForPickup','Completed')
    OR (o.status='Cancelled' AND EXISTS (SELECT 1 FROM ordering.order_status_changes h WHERE h.order_id=o.id AND h."to"='Paid')
        AND EXISTS (SELECT 1 FROM ordering.order_refunds r JOIN ordering.order_refund_lines l ON r.id=l.refund_id
                    WHERE r.order_id=o.id AND r.status='Succeeded')))
  AND o.created_at < ((%s::date + 1)::timestamp AT TIME ZONE 'Europe/Kyiv')
UNION ALL
SELECT o.id::text, o.number, o.navkolo_order_ref,(r.completed_at AT TIME ZONE 'Europe/Kyiv')::date,
       i.product_id::text,i.name,i.sku,l.quantity,l.amount,sh.org_id::text,sh.store_id::text,r.id::text,true
FROM ordering.order_refunds r JOIN ordering.orders o ON o.id=r.order_id
JOIN ordering.order_refund_lines l ON l.refund_id=r.id JOIN ordering.order_items i ON i.id=l.order_item_id
LEFT JOIN accounting.order_shipments sh ON sh.order_id=o.id AND sh.product_id=i.product_id
WHERE r.status='Succeeded' AND r.completed_at < ((%s::date + 1)::timestamp AT TIME ZONE 'Europe/Kyiv')
"""
COST_EVENTS = """
SELECT d.native_org_id::text AS org,d.native_store_id::text AS store,m.product_id::text AS product,
       d.day,d.id::text AS doc,m.delta,m.resulting_quantity AS balance,
       CASE WHEN d.kind IN ('in','income') AND lower(d.currency) IN ('uah','980') THEN
        (SELECT sum((x->>'total')::numeric) FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(d.details->'products')='array' THEN d.details->'products' ELSE '[]'::jsonb END) x
         WHERE x#>>'{product,id}'=m.product_id::text) END AS purchase
FROM accounting.stock_movements m JOIN accounting.documents d ON d.id=m.document_id
WHERE d.status='posted' AND d.day<=%s
UNION ALL
SELECT org_id::text,store_id::text,product_id::text,(posted_at AT TIME ZONE 'Europe/Kyiv')::date,
       order_id::text,-quantity,balance,NULL::numeric FROM accounting.order_shipments
WHERE (posted_at AT TIME ZONE 'Europe/Kyiv')::date<=%s
ORDER BY org,store,product,day
"""
STOCK = """
SELECT w.org_id::text AS org, w.store_id::text AS store, w.product_id::text AS product,
       w.quantity, coalesce(s.reserved_quantity,0) AS reserved
FROM accounting.warehouse_stock w LEFT JOIN catalog.product_stock s
  ON (s.warehouse_org_id,s.warehouse_store_id,s.product_id)=(w.org_id,w.store_id,w.product_id)
"""
# The balance stored with a movement is the balance at the moment the document was posted, and a
# document can be dated earlier than it was posted. Several documents can also move one product on
# the same day, and their stored balances cannot be put in order. The balance at the end of a day is
# therefore rebuilt from quantities alone: opening stock plus every change dated up to that day.
# The rebuilt ledger is trusted only if it ends at the current stock. Otherwise the stored balances
# decide, as before: a day counts as the start of an outage only if every balance that day was zero.
OUTAGES = """
WITH movements AS (
 SELECT d.native_org_id AS org,d.native_store_id AS store,m.product_id AS product,d.day,
        m.resulting_quantity AS balance,m.delta AS change
 FROM accounting.stock_movements m JOIN accounting.documents d ON d.id=m.document_id
 UNION ALL SELECT org_id,store_id,product_id,(posted_at AT TIME ZONE 'Europe/Kyiv')::date,balance,-quantity
 FROM accounting.order_shipments
 UNION ALL SELECT org_id,store_id,product_id,day,quantity,quantity FROM accounting.stock_openings
), daily AS (
 SELECT org,store,product,day,min(balance) AS minimum,max(balance) AS maximum,sum(change) AS change
 FROM movements GROUP BY org,store,product,day
), ledger AS (
 SELECT l.*,sum(l.change) OVER (PARTITION BY l.org,l.store,l.product ORDER BY l.day) AS closing,
        sum(l.change) OVER (PARTITION BY l.org,l.store,l.product)=w.quantity AS verified
 FROM daily l LEFT JOIN accounting.warehouse_stock w
   ON (w.org_id,w.store_id,w.product_id)=(l.org,l.store,l.product)
), spans AS (
 SELECT *,lead(day,1,%s::date+1) OVER (PARTITION BY org,store,product ORDER BY day) AS next_day,
        CASE WHEN verified THEN closing<=0 ELSE maximum=0 END AS sold_out
 FROM ledger WHERE day<=%s
)
SELECT org::text,store::text,product::text,greatest(day,%s::date-1092) AS day,
       CASE WHEN sold_out THEN next_day-1 ELSE day END AS through
FROM spans WHERE (minimum=0 OR sold_out) AND (CASE WHEN sold_out THEN next_day-1 ELSE day END)>=%s::date-1092
"""


def read_register(as_of):
    from .register import reconcile

    with production() as conn:
        catalog = conn.execute(CATALOG).fetchall()
        refs = conn.execute(REFERENCES).fetchall()
        native = conn.execute(NATIVE, (as_of,)).fetchall()
        from itertools import chain

        source = reconcile(chain(archived_rows(conn, ARCHIVE, (as_of,)), native),
                           conn.execute(WEB, (as_of, as_of)), catalog, refs, as_of)
        source["stocks"] = conn.execute(STOCK).fetchall()
        stocked = {s["product"] for s in source["stocks"]}
        source["stockMeta"] = {p["id"]: p for p in catalog if p["id"] in stocked}
        source["outages"] = [
            dict(row, day=str(row["day"]), through=str(row["through"]))
            for row in conn.execute(OUTAGES, (as_of,) * 4)
        ]
        from .register import apply_inventory_cost

        apply_inventory_cost(source["facts"], conn.execute(COST_EVENTS, (as_of, as_of)))
        return source
