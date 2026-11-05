using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PoliValko.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class BannerKicker : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "kicker",
                schema: "content",
                table: "banners",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE content.banners SET kicker = 'Магазин у Бучі' WHERE kicker IS NULL AND title = 'Усе для саду, городу й дому';
                UPDATE content.banners SET kicker = 'Зараз дешевше' WHERE kicker IS NULL AND title = 'Знижки для саду';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "kicker",
                schema: "content",
                table: "banners");
        }
    }
}
