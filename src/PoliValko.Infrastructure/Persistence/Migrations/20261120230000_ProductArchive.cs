using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261120230000_ProductArchive")]
public sealed class ProductArchive : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        ALTER TABLE catalog.products ADD COLUMN is_archived boolean NOT NULL DEFAULT false,
            ADD CONSTRAINT ck_products_archive_visibility CHECK (NOT (is_archived AND is_visible));
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        ALTER TABLE catalog.products DROP CONSTRAINT ck_products_archive_visibility, DROP COLUMN is_archived;
        """);
}
