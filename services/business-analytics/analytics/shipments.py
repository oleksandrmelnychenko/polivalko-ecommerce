"""Read-only shipment coverage for the annual sales map."""
from datetime import date
import logging

from .source import production


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
              SELECT payload::jsonb#>'{raw,delivery}' AS delivery FROM integration.dntrade_archive_records
              WHERE entity_type='order' AND source_day >= %s AND source_day < %s
            )
            SELECT count(*) AS orders, count(*) FILTER (WHERE jsonb_typeof(delivery)='object') AS delivery,
                   count(*) FILTER (WHERE nullif(trim(delivery->>'delivery_ttn'),'') IS NOT NULL) AS waybills
            FROM orders
        """, (start, end)).fetchone()
        stock = conn.execute("""
            SELECT count(DISTINCT order_id) AS orders FROM accounting.order_shipments
            WHERE posted_at >= (%s::date::timestamp AT TIME ZONE 'Europe/Kyiv')
              AND posted_at < (%s::date::timestamp AT TIME ZONE 'Europe/Kyiv')
        """, (start, end)).fetchone()
    logging.getLogger("gunicorn.error").info(
        "Shipment sources checked (year=%s, archiveOrders=%s, withDelivery=%s, withWaybill=%s, "
        "warehouseOrdersShipped=%s, relations=%s)", year, archive["orders"], archive["delivery"],
        archive["waybills"], stock["orders"], ",".join(names))
