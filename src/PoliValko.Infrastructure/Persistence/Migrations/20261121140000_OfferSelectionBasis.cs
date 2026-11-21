using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261121140000_OfferSelectionBasis")]
public sealed class OfferSelectionBasis : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        ALTER TABLE accounting.sales_offers ADD COLUMN selection_basis text
            CHECK (selection_basis IN ('statistics','catalog','manual'));
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        ALTER TABLE accounting.sales_offers DROP COLUMN selection_basis;
        """);
}
