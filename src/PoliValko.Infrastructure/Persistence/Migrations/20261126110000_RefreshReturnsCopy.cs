using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261126110000_RefreshReturnsCopy")]
public sealed class RefreshReturnsCopy : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        UPDATE content.pages AS page
        SET body_html = revised.body_html, updated_at = now()
        FROM (
            SELECT slug, replace(replace(replace(replace(replace(body_html,
                '<p><strong>Чернетка.</strong> Остаточні умови продавець погодить за законом «Про захист прав споживачів».</p>', ''),
                '<h2>Строк</h2><p>Товар належної якості можна повернути протягом 14 днів, якщо він не був у використанні й збережено товарний вигляд.</p>', '<h2>14 днів на повернення</h2><p>Можна повернути товар належної якості, яким не користувалися і який зберіг товарний вигляд.</p>'),
                '<h2>Як повернути</h2><p>Зателефонуйте менеджеру й назвіть номер замовлення. Можна повернути все замовлення або окремі товари.</p>', '<h2>Як оформити повернення</h2><p>Зателефонуйте в магазин, назвіть номер замовлення та скажіть, які товари хочете повернути. Можна повернути й усе замовлення.</p>'),
                '<h2>Кошти</h2><p>Оплату карткою повертаємо на ту саму картку. Оплату під час отримання повертаємо способом, який погодите з менеджером. На повернення видаємо чек.</p>', '<h2>Як повертаємо кошти</h2><p><strong>Оплата карткою.</strong> Гроші повернемо на ту саму картку.</p><p><strong>Оплата під час отримання.</strong> Спосіб повернення узгодимо з вами. В обох випадках ви отримаєте чек.</p>'),
                '<p><strong>Чернетка.</strong> Умови погоджує продавець відповідно до закону «Про захист прав споживачів».</p>', '') AS body_html
            FROM content.pages
            WHERE slug = 'returns'
        ) AS revised
        WHERE page.slug = revised.slug AND page.body_html <> revised.body_html;
        """);

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Preserve content subsequently edited in the console.
    }
}
