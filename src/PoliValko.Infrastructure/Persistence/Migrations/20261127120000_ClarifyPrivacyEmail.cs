using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261127120000_ClarifyPrivacyEmail")]
public sealed class ClarifyPrivacyEmail : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        UPDATE content.pages
        SET body_html = replace(body_html, '<p>Ім''я, телефон, за бажанням email, населений пункт, відділення або адреса доставки, коментар до замовлення.</p>', '<p>Для оформлення замовлення потрібні ім’я та прізвище, номер телефону й електронна адреса. Електронна адреса також потрібна для реєстрації та входу в акаунт.</p><p>Для доставки зазначте населений пункт і відділення, поштомат або адресу кур’єрської доставки. Коментар до замовлення можна залишити за бажанням.</p>'), updated_at = now()
        WHERE slug = 'privacy' AND strpos(body_html, '<p>Ім''я, телефон, за бажанням email, населений пункт, відділення або адреса доставки, коментар до замовлення.</p>') > 0;
        """);

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Preserve subsequent edits to the published policy.
    }
}
