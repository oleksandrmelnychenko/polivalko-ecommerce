using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261124180000_PartnerDistinctPairs")]
public sealed class PartnerDistinctPairs : Migration
{
    // Cards with the same name that a person confirmed to be different partners (namesakes), so the
    // directory stops calling them likely duplicates and they cannot be merged by mistake.
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE accounting.partner_distinct (
            first_id uuid NOT NULL REFERENCES accounting.partners(id),
            second_id uuid NOT NULL REFERENCES accounting.partners(id),
            PRIMARY KEY(first_id,second_id), CHECK (first_id < second_id)
        );
        CREATE INDEX partner_distinct_second ON accounting.partner_distinct(second_id);
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        DROP TABLE accounting.partner_distinct;
        """);
}
