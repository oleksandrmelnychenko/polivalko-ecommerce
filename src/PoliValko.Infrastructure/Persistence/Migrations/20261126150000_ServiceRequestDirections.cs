using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261126150000_ServiceRequestDirections")]
public sealed class ServiceRequestDirections : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.AddColumn<string[]>(
        name: "additional_direction_codes", schema: "content", table: "service_requests",
        type: "text[]", nullable: false, defaultValueSql: "'{}'::text[]");

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropColumn(
        name: "additional_direction_codes", schema: "content", table: "service_requests");
}
