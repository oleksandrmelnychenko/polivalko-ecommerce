using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261127160000_AddWarehouseTransfersAndReferences")]
public sealed class AddWarehouseTransfersAndReferences : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE SEQUENCE IF NOT EXISTS accounting.stock_transfer_numbers;

        ALTER TABLE accounting.documents
            ADD COLUMN IF NOT EXISTS native_target_store_id uuid REFERENCES accounting.references(id);

        ALTER TABLE accounting.stock_movements
            ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES accounting.references(id);

        ALTER TABLE accounting.stock_movements
            ADD COLUMN IF NOT EXISTS is_reversal boolean NOT NULL DEFAULT false;

        UPDATE accounting.stock_movements m
        SET store_id = d.native_store_id
        FROM accounting.documents d
        WHERE d.id = m.document_id AND m.store_id IS NULL;

        ALTER TABLE accounting.stock_movements
            ALTER COLUMN store_id SET NOT NULL;

        DO $$
        DECLARE
            pk_cols text[];
        BEGIN
            SELECT array_agg(a.attname::text ORDER BY u.ord)
            INTO pk_cols
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS u(attnum, ord)
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = u.attnum
            WHERE n.nspname = 'accounting' AND t.relname = 'stock_movements' AND c.contype = 'p';

            IF pk_cols IS DISTINCT FROM ARRAY['document_id','store_id','product_id','is_reversal'] THEN
                ALTER TABLE accounting.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_pkey;
                ALTER TABLE accounting.stock_movements
                    ADD PRIMARY KEY (document_id, store_id, product_id, is_reversal);
            END IF;
        END $$;

        CREATE INDEX IF NOT EXISTS ix_stock_movements_store_product
            ON accounting.stock_movements (store_id, product_id);

        CREATE OR REPLACE VIEW accounting.invoice_operations AS
        SELECT d.id,d.status,d.kind,d.day,d.total,d.currency,d.native_partner_id AS partner_id,
            d.native_org_id AS org_id,d.native_store_id AS store_id,
            coalesce(p.paid,0) AS paid,CASE WHEN d.status='posted' THEN d.total-coalesce(p.paid,0) END AS due
        FROM accounting.documents d
        LEFT JOIN LATERAL (SELECT sum(amount) AS paid FROM accounting.invoice_payments WHERE document_id=d.id) p ON true
        WHERE d.native_partner_id IS NOT NULL
          AND ((d.entity_type='invoice' AND d.kind IN ('in','out'))
               OR (d.entity_type='customerReturn' AND d.kind='customerReturn'));
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        DROP INDEX IF EXISTS accounting.ix_stock_movements_store_product;

        CREATE OR REPLACE VIEW accounting.invoice_operations AS
        SELECT d.id,d.status,d.kind,d.day,d.total,d.currency,d.native_partner_id AS partner_id,
            d.native_org_id AS org_id,d.native_store_id AS store_id,
            coalesce(p.paid,0) AS paid,CASE WHEN d.status='posted' THEN d.total-coalesce(p.paid,0) END AS due
        FROM accounting.documents d
        LEFT JOIN LATERAL (SELECT sum(amount) AS paid FROM accounting.invoice_payments WHERE document_id=d.id) p ON true
        WHERE d.native_partner_id IS NOT NULL AND d.entity_type='invoice' AND d.kind IN ('in','out');

        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM accounting.stock_movements WHERE is_reversal)
               OR EXISTS (SELECT 1 FROM accounting.stock_movements GROUP BY document_id, product_id HAVING count(*) > 1) THEN
                RAISE EXCEPTION 'Cannot downgrade stock_movements while transfers or reversals exist.';
            END IF;
        END $$;

        ALTER TABLE accounting.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_pkey;
        ALTER TABLE accounting.stock_movements ADD PRIMARY KEY (document_id, product_id);
        ALTER TABLE accounting.stock_movements DROP COLUMN IF EXISTS is_reversal;
        ALTER TABLE accounting.stock_movements DROP COLUMN IF EXISTS store_id;
        ALTER TABLE accounting.documents DROP COLUMN IF EXISTS native_target_store_id;
        DROP SEQUENCE IF EXISTS accounting.stock_transfer_numbers;
        """);
}
