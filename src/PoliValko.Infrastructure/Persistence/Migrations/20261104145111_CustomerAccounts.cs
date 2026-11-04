using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PoliValko.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CustomerAccounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "customers");

            migrationBuilder.AddColumn<Guid>(
                name: "customer_id",
                schema: "ordering",
                table: "orders",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "customers",
                schema: "customers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    email = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    normalized_email = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    password_hash = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    email_confirmed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    security_stamp = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    failed_login_count = table.Column<int>(type: "integer", nullable: false),
                    lockout_end = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_customers", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "favorites",
                schema: "catalog",
                columns: table => new
                {
                    customer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    product_id = table.Column<Guid>(type: "uuid", nullable: false),
                    added_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_favorites", x => new { x.customer_id, x.product_id });
                    table.ForeignKey(
                        name: "fk_favorites_products_product_id",
                        column: x => x.product_id,
                        principalSchema: "catalog",
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "customer_addresses",
                schema: "customers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    customer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    label = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    delivery_method = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    settlement_ref = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    settlement_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    warehouse_ref = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    warehouse_name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    street = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    house = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    apartment = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    is_default = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_customer_addresses", x => x.id);
                    table.ForeignKey(
                        name: "fk_customer_addresses_customers_customer_id",
                        column: x => x.customer_id,
                        principalSchema: "customers",
                        principalTable: "customers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "customer_tokens",
                schema: "customers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    customer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    purpose = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    token_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    used_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_customer_tokens", x => x.id);
                    table.ForeignKey(
                        name: "fk_customer_tokens_customers_customer_id",
                        column: x => x.customer_id,
                        principalSchema: "customers",
                        principalTable: "customers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_orders_customer_id_created_at",
                schema: "ordering",
                table: "orders",
                columns: new[] { "customer_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_customer_addresses_customer_id",
                schema: "customers",
                table: "customer_addresses",
                column: "customer_id");

            migrationBuilder.CreateIndex(
                name: "ix_customer_tokens_customer_id_purpose",
                schema: "customers",
                table: "customer_tokens",
                columns: new[] { "customer_id", "purpose" });

            migrationBuilder.CreateIndex(
                name: "ix_customer_tokens_token_hash",
                schema: "customers",
                table: "customer_tokens",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_customers_normalized_email",
                schema: "customers",
                table: "customers",
                column: "normalized_email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_favorites_product_id",
                schema: "catalog",
                table: "favorites",
                column: "product_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "customer_addresses",
                schema: "customers");

            migrationBuilder.DropTable(
                name: "customer_tokens",
                schema: "customers");

            migrationBuilder.DropTable(
                name: "favorites",
                schema: "catalog");

            migrationBuilder.DropTable(
                name: "customers",
                schema: "customers");

            migrationBuilder.DropIndex(
                name: "ix_orders_customer_id_created_at",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "customer_id",
                schema: "ordering",
                table: "orders");
        }
    }
}
