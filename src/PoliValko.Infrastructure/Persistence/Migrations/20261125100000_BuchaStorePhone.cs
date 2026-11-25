using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261125100000_BuchaStorePhone")]
public sealed class BuchaStorePhone : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        UPDATE content.contacts
        SET store_phone = '+380 63 818 52 22', updated_at = now()
        WHERE id = 1 AND NULLIF(trim(store_phone), '') IS NULL
          AND address LIKE 'м. Буча, вул. Депутатська, 1-В,%';
        """);

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // The store manages this contact in the console after the initial update.
    }
}
