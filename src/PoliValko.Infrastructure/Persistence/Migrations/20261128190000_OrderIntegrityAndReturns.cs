using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261128190000_OrderIntegrityAndReturns")]
public sealed class OrderIntegrityAndReturns : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        ALTER TABLE ordering.order_refunds
            ADD COLUMN IF NOT EXISTS return_to_stock boolean NOT NULL DEFAULT true;

        CREATE TABLE IF NOT EXISTS accounting.order_returns (
            id uuid PRIMARY KEY,
            order_id uuid NOT NULL,
            product_id uuid NOT NULL,
            org_id uuid NOT NULL,
            store_id uuid NOT NULL,
            quantity integer NOT NULL CHECK (quantity > 0),
            balance numeric NOT NULL CHECK (balance >= 0),
            posted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
            FOREIGN KEY (org_id, store_id, product_id)
                REFERENCES accounting.warehouse_stock (org_id, store_id, product_id)
        );

        CREATE INDEX IF NOT EXISTS ix_order_returns_stock
            ON accounting.order_returns (org_id, store_id, product_id);
        CREATE INDEX IF NOT EXISTS ix_order_returns_order_product
            ON accounting.order_returns (order_id, product_id);
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        DROP INDEX IF EXISTS accounting.ix_order_returns_order_product;
        DROP INDEX IF EXISTS accounting.ix_order_returns_stock;
        DROP TABLE IF EXISTS accounting.order_returns;
        ALTER TABLE ordering.order_refunds DROP COLUMN IF EXISTS return_to_stock;
        """);
}
