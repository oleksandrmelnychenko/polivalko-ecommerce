using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PoliValko.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ShopCopyNoCity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                schema: "content",
                table: "pages",
                keyColumn: "slug",
                keyValue: "offer",
                column: "body_html",
                value: "<p><strong>Чернетка.</strong> Остаточний текст оферти надасть продавець.</p><h2>1. Загальні положення</h2><p>Оформлюючи замовлення, покупець погоджується з умовами цієї оферти.</p><h2>2. Замовлення</h2><p>Замовлення оформлюється на сайті без реєстрації. Після оформлення покупець отримує номер замовлення.</p><h2>3. Ціна й оплата</h2><p>Ціни вказано в гривнях. Способи оплати: онлайн карткою, післяплата, оплата під час самовивозу.</p><h2>4. Доставка</h2><p>Новою поштою по Україні за тарифами перевізника або самовивіз з магазину.</p><h2>5. Повернення</h2><p>Умови повернення описано на сторінці «Повернення й обмін».</p><h2>6. Продавець</h2><p>Реквізити продавця вказано нижче й на сторінці замовлення.</p>");

            migrationBuilder.UpdateData(
                schema: "content",
                table: "pages",
                keyColumn: "slug",
                keyValue: "payment-delivery",
                column: "lead",
                value: "Нова пошта по Україні або самовивіз з магазину.");

            migrationBuilder.UpdateData(
                schema: "delivery",
                table: "pickup_points",
                keyColumn: "code",
                keyValue: "bucha-store",
                column: "name",
                value: "Магазин Poli Valko");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                schema: "content",
                table: "pages",
                keyColumn: "slug",
                keyValue: "offer",
                column: "body_html",
                value: "<p><strong>Чернетка.</strong> Остаточний текст оферти надасть продавець.</p><h2>1. Загальні положення</h2><p>Оформлюючи замовлення, покупець погоджується з умовами цієї оферти.</p><h2>2. Замовлення</h2><p>Замовлення оформлюється на сайті без реєстрації. Після оформлення покупець отримує номер замовлення.</p><h2>3. Ціна й оплата</h2><p>Ціни вказано в гривнях. Способи оплати: онлайн карткою, післяплата, оплата під час самовивозу.</p><h2>4. Доставка</h2><p>Новою поштою по Україні за тарифами перевізника або самовивіз у Бучі.</p><h2>5. Повернення</h2><p>Умови повернення описано на сторінці «Повернення й обмін».</p><h2>6. Продавець</h2><p>Реквізити продавця вказано нижче й на сторінці замовлення.</p>");

            migrationBuilder.UpdateData(
                schema: "content",
                table: "pages",
                keyColumn: "slug",
                keyValue: "payment-delivery",
                column: "lead",
                value: "Нова пошта по Україні або самовивіз у Бучі.");

            migrationBuilder.UpdateData(
                schema: "delivery",
                table: "pickup_points",
                keyColumn: "code",
                keyValue: "bucha-store",
                column: "name",
                value: "Магазин Poli Valko у Бучі");
        }
    }
}
