using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PoliValko.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class NavkoloCancellation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "navkolo_cancellation_requested_at",
                schema: "ordering",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "navkolo_cancellation_synchronized_at",
                schema: "ordering",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "navkolo_export_attempted_at",
                schema: "ordering",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "navkolo_cancellation_requested_at",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "navkolo_cancellation_synchronized_at",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "navkolo_export_attempted_at",
                schema: "ordering",
                table: "orders");
        }
    }
}
