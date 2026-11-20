using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PoliValko.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class DnTradeWorkForms : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "dntrade_work_forms",
                schema: "integration",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    version = table.Column<int>(type: "integer", nullable: false),
                    section = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    type = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    status = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    document_date = table.Column<DateOnly>(type: "date", nullable: true),
                    source_record_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    data = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_dntrade_work_forms", x => x.id);
                    table.ForeignKey(
                        name: "fk_dntrade_work_forms_dntrade_archive_records_source_record_id",
                        column: x => x.source_record_id,
                        principalSchema: "integration",
                        principalTable: "dntrade_archive_records",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_dntrade_work_forms_section_status_updated_at_id",
                schema: "integration",
                table: "dntrade_work_forms",
                columns: new[] { "section", "status", "updated_at", "id" });

            migrationBuilder.CreateIndex(
                name: "ix_dntrade_work_forms_source_record_id",
                schema: "integration",
                table: "dntrade_work_forms",
                column: "source_record_id");

            migrationBuilder.CreateIndex(
                name: "ix_dntrade_work_forms_updated_at_id",
                schema: "integration",
                table: "dntrade_work_forms",
                columns: new[] { "updated_at", "id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "dntrade_work_forms",
                schema: "integration");
        }
    }
}
