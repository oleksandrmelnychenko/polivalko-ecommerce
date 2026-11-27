using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261127153000_ShopActivityEvents")]
public sealed class ShopActivityEvents : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE IF NOT EXISTS ordering.shop_activity_events (
            id uuid NOT NULL,
            kind character varying(24) NOT NULL,
            visitor_key character varying(100) NOT NULL,
            visitor_tag character varying(16) NOT NULL,
            customer_id uuid NULL,
            product_id uuid NOT NULL,
            quantity integer NOT NULL,
            device character varying(16) NOT NULL,
            occurred_at timestamp with time zone NOT NULL,
            CONSTRAINT pk_shop_activity_events PRIMARY KEY (id)
        );

        CREATE INDEX IF NOT EXISTS ix_shop_activity_events_occurred_at_id
            ON ordering.shop_activity_events (occurred_at, id);

        CREATE INDEX IF NOT EXISTS ix_shop_activity_events_kind_occurred_at
            ON ordering.shop_activity_events (kind, occurred_at);

        CREATE INDEX IF NOT EXISTS ix_shop_activity_events_visitor_key_occurred_at
            ON ordering.shop_activity_events (visitor_key, occurred_at);
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        DROP TABLE IF EXISTS ordering.shop_activity_events;
        """);
}
