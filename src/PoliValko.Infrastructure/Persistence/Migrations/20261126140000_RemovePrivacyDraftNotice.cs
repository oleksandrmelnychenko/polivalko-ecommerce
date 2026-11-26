using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261126140000_RemovePrivacyDraftNotice")]
public sealed class RemovePrivacyDraftNotice : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        UPDATE content.pages
        SET body_html = replace(body_html, '<p><strong>Чернетка.</strong> Остаточний текст надасть продавець.</p>', ''), updated_at = now()
        WHERE slug = 'privacy' AND strpos(body_html, '<p><strong>Чернетка.</strong> Остаточний текст надасть продавець.</p>') > 0;
        """);

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Keep editorial content when rolling back.
    }
}
