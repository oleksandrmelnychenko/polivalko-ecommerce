using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PoliValko.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class DnTradeSalesArchive : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "dntrade_archive_records",
                schema: "integration",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_account = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    entity_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    source_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    source_date = table.Column<string>(type: "character varying(48)", maxLength: 48, nullable: true),
                    source_day = table.Column<DateOnly>(type: "date", nullable: true),
                    document_type = table.Column<string>(type: "character varying(96)", maxLength: 96, nullable: true),
                    organization_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    store_ids = table.Column<string[]>(type: "text[]", nullable: false),
                    status = table.Column<string>(type: "character varying(96)", maxLength: 96, nullable: true),
                    currency = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    total = table.Column<decimal>(type: "numeric", nullable: true),
                    parent_source_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    imported_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    payload = table.Column<string>(type: "text", nullable: false),
                    fingerprint = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_dntrade_archive_records", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_dntrade_archive_records_source_account_source_id_entity_type",
                schema: "integration",
                table: "dntrade_archive_records",
                columns: new[] { "source_account", "source_id", "entity_type" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_dntrade_archive_records_source_day_id",
                schema: "integration",
                table: "dntrade_archive_records",
                columns: new[] { "source_day", "id" });

            migrationBuilder.CreateIndex(
                name: "ix_dntrade_archive_records_store_ids",
                schema: "integration",
                table: "dntrade_archive_records",
                column: "store_ids")
                .Annotation("Npgsql:IndexMethod", "gin");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "dntrade_archive_records",
                schema: "integration");
        }
    }
}
