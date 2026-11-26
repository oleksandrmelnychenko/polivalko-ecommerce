using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261126130000_AlignCustomerPageLeads")]
public sealed class AlignCustomerPageLeads : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        UPDATE content.pages AS page
        SET lead = copy.new_lead, updated_at = now()
        FROM (VALUES
            ('offer', 'Договір купівлі-продажу між продавцем і покупцем інтернет-магазину.', 'На яких умовах ви купуєте товари?'),
            ('privacy', 'Які дані ми збираємо під час замовлення і як їх використовуємо.', 'Як ми використовуємо ваші дані?'),
            ('returns', 'Як повернути товар і отримати кошти.', 'Як повернути або обміняти товар?'),
            ('payment-delivery', 'Нова пошта по Україні або самовивіз з магазину.', 'Як отримати й оплатити замовлення?')
        ) AS copy(slug, old_lead, new_lead)
        WHERE page.slug = copy.slug AND page.lead = copy.old_lead;
        """);

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Preserve content subsequently edited in the console.
    }
}
