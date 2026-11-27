using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261127140000_AddHotQueryIndexes")]
public sealed class AddHotQueryIndexes : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE INDEX IF NOT EXISTS ix_order_items_product_id
            ON ordering.order_items (product_id);

        CREATE INDEX IF NOT EXISTS ix_orders_created_at_desc
            ON ordering.orders (created_at DESC);

        CREATE INDEX IF NOT EXISTS ix_orders_customer_phone_created_at_desc
            ON ordering.orders (customer_phone, created_at DESC, id DESC);

        CREATE INDEX IF NOT EXISTS ix_order_refunds_status_created_at
            ON ordering.order_refunds (status, created_at);

        CREATE INDEX IF NOT EXISTS ix_products_visible_category_id
            ON catalog.products (category_id)
            WHERE is_visible;

        CREATE INDEX IF NOT EXISTS ix_outbox_messages_pending_next_attempt
            ON integration.outbox_messages (next_attempt_at, occurred_at)
            WHERE status = 'Pending';

        DO $$
        BEGIN
            IF to_regclass('accounting.warehouse_stock') IS NOT NULL THEN
                CREATE INDEX IF NOT EXISTS ix_warehouse_stock_product_id
                    ON accounting.warehouse_stock (product_id);
                CREATE INDEX IF NOT EXISTS ix_warehouse_stock_store_id
                    ON accounting.warehouse_stock (store_id);
            END IF;
        END $$;
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        DROP INDEX IF EXISTS ordering.ix_order_items_product_id;
        DROP INDEX IF EXISTS ordering.ix_orders_created_at_desc;
        DROP INDEX IF EXISTS ordering.ix_orders_customer_phone_created_at_desc;
        DROP INDEX IF EXISTS ordering.ix_order_refunds_status_created_at;
        DROP INDEX IF EXISTS catalog.ix_products_visible_category_id;
        DROP INDEX IF EXISTS integration.ix_outbox_messages_pending_next_attempt;
        DROP INDEX IF EXISTS accounting.ix_warehouse_stock_product_id;
        DROP INDEX IF EXISTS accounting.ix_warehouse_stock_store_id;
        """);
}
