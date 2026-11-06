using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PoliValko.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CatalogSearchIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "ix_products_brand_trgm",
                schema: "catalog",
                table: "products",
                column: "brand")
                .Annotation("Npgsql:IndexMethod", "gin")
                .Annotation("Npgsql:IndexOperators", new[] { "gin_trgm_ops" });

            migrationBuilder.CreateIndex(
                name: "ix_products_slug_trgm",
                schema: "catalog",
                table: "products",
                column: "slug")
                .Annotation("Npgsql:IndexMethod", "gin")
                .Annotation("Npgsql:IndexOperators", new[] { "gin_trgm_ops" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_products_brand_trgm",
                schema: "catalog",
                table: "products");

            migrationBuilder.DropIndex(
                name: "ix_products_slug_trgm",
                schema: "catalog",
                table: "products");
        }
    }
}
