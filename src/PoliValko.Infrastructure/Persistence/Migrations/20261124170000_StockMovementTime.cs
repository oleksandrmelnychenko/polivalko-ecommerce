using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261124170000_StockMovementTime")]
public sealed class StockMovementTime : Migration
{
    // Several documents can move one product on the same day; the history lists them in the order they were posted,
    // which is the order their resulting quantities follow.
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        ALTER TABLE accounting.stock_movements ADD COLUMN recorded_at timestamptz NOT NULL DEFAULT clock_timestamp();
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        ALTER TABLE accounting.stock_movements DROP COLUMN recorded_at;
        """);
}
