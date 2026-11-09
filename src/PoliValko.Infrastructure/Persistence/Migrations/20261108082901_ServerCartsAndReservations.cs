using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PoliValko.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ServerCartsAndReservations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "reserved_quantity",
                schema: "catalog",
                table: "product_stock",
                type: "numeric(14,3)",
                precision: 14,
                scale: 3,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "carts",
                schema: "ordering",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    owner = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    revision = table.Column<long>(type: "bigint", nullable: false),
                    items_json = table.Column<string>(type: "jsonb", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    checkout_revision = table.Column<long>(type: "bigint", nullable: true),
                    protected_checkout_result = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_carts", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "stock_reservations",
                schema: "catalog",
                columns: table => new
                {
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    product_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    consumed = table.Column<bool>(type: "boolean", nullable: false),
                    released = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stock_reservations", x => new { x.order_id, x.product_id });
                    table.ForeignKey(
                        name: "fk_stock_reservations_product_product_id",
                        column: x => x.product_id,
                        principalSchema: "catalog",
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_carts_owner",
                schema: "ordering",
                table: "carts",
                column: "owner",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_stock_reservations_product_id_released",
                schema: "catalog",
                table: "stock_reservations",
                columns: new[] { "product_id", "released" });

            // Existing open orders must also hold stock after the cutover.
            migrationBuilder.Sql("""
                INSERT INTO catalog.stock_reservations (order_id, product_id, quantity, created_at, consumed, released)
                SELECT o.id, i.product_id, SUM(i.quantity)::integer, o.created_at, o.status = 'Shipped', false
                FROM ordering.orders o
                JOIN ordering.order_items i ON i.order_id = o.id
                JOIN catalog.product_stock s ON s.product_id = i.product_id
                WHERE o.status NOT IN ('Cancelled', 'Completed')
                GROUP BY o.id, i.product_id, o.created_at, o.status;
                UPDATE catalog.product_stock s SET reserved_quantity = r.quantity
                FROM (SELECT product_id, SUM(quantity) AS quantity FROM catalog.stock_reservations GROUP BY product_id) r
                WHERE r.product_id = s.product_id;
                """);

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "carts",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "stock_reservations",
                schema: "catalog");

            migrationBuilder.DropColumn(
                name: "reserved_quantity",
                schema: "catalog",
                table: "product_stock");
        }
    }
}
