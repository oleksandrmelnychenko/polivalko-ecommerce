using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PoliValko.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// The brand is spelled «Полі-Валко». Only the misspelled word is replaced, so pages the shop edited in the console keep their text.
    /// </summary>
    public partial class BrandSpelling : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE content.pages
                SET body_html = replace(body_html, 'Полі-Вальк', 'Полі-Валк'),
                    title = replace(title, 'Полі-Вальк', 'Полі-Валк'),
                    lead = replace(lead, 'Полі-Вальк', 'Полі-Валк')
                WHERE body_html LIKE '%Полі-Вальк%' OR title LIKE '%Полі-Вальк%' OR lead LIKE '%Полі-Вальк%';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // The old spelling was a mistake; there is nothing to restore.
        }
    }
}
