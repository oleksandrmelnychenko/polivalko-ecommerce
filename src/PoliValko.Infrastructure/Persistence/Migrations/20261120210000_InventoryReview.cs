using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261120210000_InventoryReview")]
public sealed class InventoryReview : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        using var stream=typeof(InventoryReview).Assembly.GetManifestResourceStream("InventoryReview.sql")!;
        using var reader=new StreamReader(stream);
        migrationBuilder.Sql(reader.ReadToEnd());
    }
    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        DROP TRIGGER inventory_snapshot_insert ON integration.dntrade_archive_records;
        DROP FUNCTION accounting.receive_inventory(), accounting.project_inventory(integration.dntrade_archive_records);
        DROP FUNCTION accounting.inventory_review(uuid,uuid);
        DROP TABLE accounting.inventory_confirmations,accounting.inventory_lines,accounting.inventory_reports;
        DROP FUNCTION accounting.stock_number(text);
        """);
}
