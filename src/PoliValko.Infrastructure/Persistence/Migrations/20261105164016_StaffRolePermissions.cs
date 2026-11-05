using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PoliValko.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class StaffRolePermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "description",
                schema: "identity",
                table: "roles",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "display_name",
                schema: "identity",
                table: "roles",
                type: "character varying(60)",
                maxLength: 60,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "is_superuser",
                schema: "identity",
                table: "roles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "is_system",
                schema: "identity",
                table: "roles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<long>(
                name: "permissions_version",
                schema: "identity",
                table: "roles",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "updated_at",
                schema: "identity",
                table: "roles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "updated_by",
                schema: "identity",
                table: "roles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "role_permissions",
                schema: "identity",
                columns: table => new
                {
                    role_id = table.Column<string>(type: "text", nullable: false),
                    key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_role_permissions", x => new { x.role_id, x.key });
                    table.ForeignKey(
                        name: "fk_role_permissions_roles_role_id",
                        column: x => x.role_id,
                        principalSchema: "identity",
                        principalTable: "roles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.Sql(
                """
                UPDATE identity.roles SET display_name = 'Адміністратор', is_system = TRUE, is_superuser = TRUE WHERE name = 'Admin';
                UPDATE identity.roles SET display_name = 'Менеджер', is_system = TRUE WHERE name = 'Manager';
                UPDATE identity.roles SET display_name = name WHERE display_name = '';
                """);

            migrationBuilder.CreateIndex(
                name: "ix_roles_display_name",
                schema: "identity",
                table: "roles",
                column: "display_name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "role_permissions",
                schema: "identity");

            migrationBuilder.DropIndex(
                name: "ix_roles_display_name",
                schema: "identity",
                table: "roles");

            migrationBuilder.DropColumn(
                name: "description",
                schema: "identity",
                table: "roles");

            migrationBuilder.DropColumn(
                name: "display_name",
                schema: "identity",
                table: "roles");

            migrationBuilder.DropColumn(
                name: "is_superuser",
                schema: "identity",
                table: "roles");

            migrationBuilder.DropColumn(
                name: "is_system",
                schema: "identity",
                table: "roles");

            migrationBuilder.DropColumn(
                name: "permissions_version",
                schema: "identity",
                table: "roles");

            migrationBuilder.DropColumn(
                name: "updated_at",
                schema: "identity",
                table: "roles");

            migrationBuilder.DropColumn(
                name: "updated_by",
                schema: "identity",
                table: "roles");
        }
    }
}
