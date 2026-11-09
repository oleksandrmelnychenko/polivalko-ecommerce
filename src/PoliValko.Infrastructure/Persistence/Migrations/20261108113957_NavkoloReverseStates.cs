using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PoliValko.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class NavkoloReverseStates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "navkolo_cancelled_at",
                schema: "ordering",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "navkolo_shipped_at",
                schema: "ordering",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "navkolo_cancelled_at",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "navkolo_shipped_at",
                schema: "ordering",
                table: "orders");
        }
    }
}
