using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261120200000_ShopWarehouseStock")]
public sealed class ShopWarehouseStock : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        ALTER TABLE catalog.product_stock ADD COLUMN warehouse_org_id uuid, ADD COLUMN warehouse_store_id uuid,
            ADD CONSTRAINT shop_source_complete CHECK ((warehouse_org_id IS NULL)=(warehouse_store_id IS NULL)),
            ADD FOREIGN KEY (warehouse_org_id,warehouse_store_id,product_id)
                REFERENCES accounting.warehouse_stock(org_id,store_id,product_id);
        CREATE TABLE accounting.order_shipments (
            order_id uuid NOT NULL, product_id uuid NOT NULL, org_id uuid NOT NULL, store_id uuid NOT NULL,
            quantity integer NOT NULL CHECK(quantity>0), balance numeric NOT NULL CHECK(balance>=0),
            posted_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(order_id,product_id),
            FOREIGN KEY(org_id,store_id,product_id) REFERENCES accounting.warehouse_stock(org_id,store_id,product_id)
        );
        ALTER TABLE catalog.stock_reservations ADD COLUMN warehouse_org_id uuid, ADD COLUMN warehouse_store_id uuid,
            ADD CONSTRAINT reservation_source_complete CHECK ((warehouse_org_id IS NULL)=(warehouse_store_id IS NULL)),
            ADD FOREIGN KEY (warehouse_org_id,warehouse_store_id,product_id)
                REFERENCES accounting.warehouse_stock(org_id,store_id,product_id);
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        DROP TABLE accounting.order_shipments;
        ALTER TABLE catalog.stock_reservations DROP COLUMN warehouse_org_id, DROP COLUMN warehouse_store_id;
        ALTER TABLE catalog.product_stock DROP COLUMN warehouse_org_id, DROP COLUMN warehouse_store_id;
        """);
}
