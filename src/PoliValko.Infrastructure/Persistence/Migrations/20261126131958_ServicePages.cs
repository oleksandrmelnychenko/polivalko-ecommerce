using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PoliValko.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ServicePages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "body_html",
                schema: "content",
                table: "service_directions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "seo_description",
                schema: "content",
                table: "service_directions",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "seo_title",
                schema: "content",
                table: "service_directions",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "slug",
                schema: "content",
                table: "service_directions",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "updated_at",
                schema: "content",
                table: "service_directions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.UpdateData(
                schema: "content",
                table: "service_directions",
                keyColumn: "code",
                keyValue: "garden-care",
                columns: new[] { "body_html", "seo_description", "seo_title", "slug", "updated_at" },
                values: new object[] { null, null, null, null, null });

            migrationBuilder.UpdateData(
                schema: "content",
                table: "service_directions",
                keyColumn: "code",
                keyValue: "greening",
                columns: new[] { "body_html", "seo_description", "seo_title", "slug", "updated_at" },
                values: new object[] { null, null, null, null, null });

            migrationBuilder.UpdateData(
                schema: "content",
                table: "service_directions",
                keyColumn: "code",
                keyValue: "irrigation-installation",
                columns: new[] { "body_html", "seo_description", "seo_title", "slug", "updated_at" },
                values: new object[] { null, null, null, null, null });

            migrationBuilder.UpdateData(
                schema: "content",
                table: "service_directions",
                keyColumn: "code",
                keyValue: "irrigation-service",
                columns: new[] { "body_html", "seo_description", "seo_title", "slug", "updated_at" },
                values: new object[] { null, null, null, null, null });

            migrationBuilder.UpdateData(
                schema: "content",
                table: "service_directions",
                keyColumn: "code",
                keyValue: "landscape-design",
                columns: new[] { "body_html", "seo_description", "seo_title", "slug", "updated_at" },
                values: new object[] { null, null, null, null, null });

            migrationBuilder.UpdateData(
                schema: "content",
                table: "service_directions",
                keyColumn: "code",
                keyValue: "lawns",
                columns: new[] { "body_html", "seo_description", "seo_title", "slug", "updated_at" },
                values: new object[] { null, null, null, null, null });

            migrationBuilder.UpdateData(
                schema: "content",
                table: "service_directions",
                keyColumn: "code",
                keyValue: "plant-treatment",
                columns: new[] { "body_html", "seo_description", "seo_title", "slug", "updated_at" },
                values: new object[] { null, null, null, null, null });

            migrationBuilder.CreateIndex(
                name: "ix_service_directions_slug",
                schema: "content",
                table: "service_directions",
                column: "slug",
                unique: true);

            // Draft pages for the services; the shop edits them in the console. Rows the shop already filled stay as they are.
            migrationBuilder.Sql("""
            UPDATE content.service_directions
            SET body_html = $draft$<p>Ландшафтний дизайн починається з того, як ви хочете користуватися ділянкою: де відпочивати, де город, де гратимуться діти, куди ставити авто. Під це плануємо зони, доріжки, рослини й освітлення з урахуванням ґрунту, сонця й рельєфу.</p><h2>Що входить</h2><ul><li>Розмова про ваші побажання й огляд ділянки.</li><li>План зонування: доріжки, газон, клумби, город, місця відпочинку.</li><li>Підбір рослин під ґрунт, освітлення й догляд, який вам підходить.</li><li>Розміщення поливу й садового освітлення.</li></ul><h2>Як ми працюємо</h2><p>Спочатку узгоджуємо задачу й бюджет, потім готуємо план і показуємо його вам. Після погодження ділянку можна облаштувати поетапно: озеленення, газон, автополив.</p><p>Обсяг робіт, вартість і строки узгоджуємо з вами окремо. Бордюри, опори, агроволокно й інші матеріали є в розділі <a href="/catalog/landshaftnyi-dyzain">«Ландшафтний дизайн»</a> нашого магазину в Бучі.</p>$draft$, seo_title = COALESCE(seo_title, $draft$Ландшафтний дизайн ділянки в Бучі$draft$), updated_at = now()
            WHERE code = 'landscape-design' AND body_html IS NULL;
            UPDATE content.service_directions
            SET body_html = $draft$<p>Автоматичний полив поливає газон, клумби й город за розкладом, навіть коли вас немає на ділянці. Систему розраховуємо під ваш тиск і витрату води, форму ділянки й рослини.</p><h2>Що входить</h2><ul><li>Огляд ділянки й джерела води: колодязь, свердловина чи водопровід.</li><li>Розрахунок зон поливу, підбір дощувачів, форсунок і крапельних ліній.</li><li>Прокладання труб, монтаж клапанів, контролера й датчика дощу.</li><li>Запуск, налаштування розкладу й пояснення, як користуватися системою.</li></ul><h2>Обладнання</h2><p>Обладнання Hunter та Irritec для автополиву можна оглянути й купити в нашому магазині в Бучі: <a href="/catalog/pidzemnyi-polyv">підземний полив</a> і <a href="/catalog/krapelnyi-polyv">крапельний полив</a>.</p><p>Обсяг робіт, вартість і строки узгоджуємо з вами окремо, після того як дізнаємося деталі ділянки.</p>$draft$, seo_title = COALESCE(seo_title, $draft$Автополив під ключ у Бучі: проєкт і монтаж$draft$), updated_at = now()
            WHERE code = 'irrigation-installation' AND body_html IS NULL;
            UPDATE content.service_directions
            SET body_html = $draft$<p>Озеленення ділянки: підбираємо й висаджуємо дерева, кущі, хвойні й багаторічники так, щоб вони росли на вашому ґрунті й освітленні та не вимагали більше догляду, ніж ви готові приділяти.</p><h2>Що входить</h2><ul><li>Огляд ділянки: ґрунт, сонце й тінь, вологість.</li><li>Підбір рослин і план посадки.</li><li>Підготовка посадкових ям, ґрунту й мульчі, висадка.</li><li>Перший полив і поради з догляду після посадки.</li></ul><h2>Коли садити</h2><p>Найкращий час для посадки більшості дерев і кущів: весна й осінь. Рослини в контейнерах можна садити й улітку за умови регулярного поливу.</p><p>Ґрунти, добрива й засоби для догляду є в розділі <a href="/catalog/vse-dlia-roslyn">«Все для рослин»</a>. Обсяг робіт, вартість і строки узгоджуємо з вами окремо.</p>$draft$, seo_title = COALESCE(seo_title, $draft$Озеленення ділянки в Бучі: дерева й кущі$draft$), updated_at = now()
            WHERE code = 'greening' AND body_html IS NULL;
            UPDATE content.service_directions
            SET body_html = $draft$<p>Влаштовуємо посівний і рулонний газон. Від підготовки основи залежить, наскільки рівним і густим він буде через рік, тому з неї й починаємо.</p><h2>Що входить</h2><ul><li>Очищення ділянки від бур’янів і сміття, розпушування й вирівнювання ґрунту.</li><li>Посів газонної суміші або укладання рулонного газону.</li><li>Прикочування й перший полив.</li><li>Поради з першого скошування, поливу й підживлення.</li></ul><h2>Посівний чи рулонний</h2><p>Посівний газон дешевший і дає більше вибору сумішей, але стає щільним за кілька місяців. Рулонний зелений одразу після укладання, проте потребує щоденного поливу в перші тижні.</p><p>Насіння газонних трав є в розділі <a href="/catalog/nasinnia-hazonnykh-trav">«Насіння газонних трав»</a>. Обсяг робіт, вартість і строки узгоджуємо з вами окремо.</p>$draft$, seo_title = COALESCE(seo_title, $draft$Газон під ключ у Бучі: посівний і рулонний$draft$), updated_at = now()
            WHERE code = 'lawns' AND body_html IS NULL;
            UPDATE content.service_directions
            SET body_html = $draft$<p>Сезонний догляд за садом і ділянкою для тих, хто хоче доглянутий сад без щотижневої роботи.</p><h2>Що входить</h2><ul><li>Обрізка дерев, кущів і живоплоту.</li><li>Підживлення й мульчування.</li><li>Прополювання клумб і прибирання листя.</li><li>Підготовка саду до зими й весняне прибирання.</li></ul><h2>Як домовляємося</h2><p>Можна замовити разову роботу, наприклад осінню обрізку, або регулярний догляд протягом сезону. Перелік робіт складаємо разом з вами.</p><p>Інструмент і добрива для самостійного догляду є в розділах <a href="/catalog/ruchnyi-instrument">«Ручний інструмент»</a> і <a href="/catalog/dobryva">«Добрива»</a>. Обсяг робіт, вартість і строки узгоджуємо з вами окремо.</p>$draft$, seo_title = COALESCE(seo_title, $draft$Догляд за садом у Бучі: обрізка й прибирання$draft$), updated_at = now()
            WHERE code = 'garden-care' AND body_html IS NULL;
            UPDATE content.service_directions
            SET body_html = $draft$<p>Обслуговуємо системи автополиву: запускаємо навесні, консервуємо на зиму, шукаємо й усуваємо несправності.</p><h2>Що входить</h2><ul><li>Весняний запуск: перевірка труб, клапанів і дощувачів, налаштування контролера.</li><li>Консервація на зиму: зливання й продування системи, щоб вода не розірвала труби морозом.</li><li>Ремонт: заміна дощувачів, форсунок, соленоїдів, усунення протікань.</li><li>Налаштування секторів і розкладу поливу.</li></ul><h2>Запчастини</h2><p>Форсунки, соленоїди, клапани й фітинги Hunter та Irritec є в нашому магазині в Бучі: <a href="/catalog/hunter">Hunter</a>, <a href="/catalog/irritec">Irritec</a>.</p><p>Обсяг робіт, вартість і строки узгоджуємо з вами окремо.</p>$draft$, seo_title = COALESCE(seo_title, $draft$Сервіс автополиву: запуск, консервація, ремонт$draft$), updated_at = now()
            WHERE code = 'irrigation-service' AND body_html IS NULL;
            UPDATE content.service_directions
            SET body_html = $draft$<p>Обробка дерев, кущів, газону й городу від шкідників і хвороб препаратами, дозволеними в Україні.</p><h2>Що входить</h2><ul><li>Огляд рослин і визначення проблеми: шкідник, хвороба чи помилка в догляді.</li><li>Підбір препарату й схеми обробок.</li><li>Обприскування з дотриманням норм і строків очікування до збору врожаю.</li><li>Поради, як зменшити ризик повторення.</li></ul><h2>Коли обробляти</h2><p>Профілактичні обробки саду роблять навесні до розпускання бруньок і восени після листопаду. Інші обробки залежать від проблеми, тому спершу її визначаємо.</p><p>Засоби для самостійної обробки є в розділі <a href="/catalog/zasoby-zakhystu-roslyn">«Засоби захисту рослин»</a>. Обсяг робіт, вартість і строки узгоджуємо з вами окремо.</p>$draft$, seo_title = COALESCE(seo_title, $draft$Обробка саду від шкідників і хвороб у Бучі$draft$), updated_at = now()
            WHERE code = 'plant-treatment' AND body_html IS NULL;
            """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_service_directions_slug",
                schema: "content",
                table: "service_directions");

            migrationBuilder.DropColumn(
                name: "body_html",
                schema: "content",
                table: "service_directions");

            migrationBuilder.DropColumn(
                name: "seo_description",
                schema: "content",
                table: "service_directions");

            migrationBuilder.DropColumn(
                name: "seo_title",
                schema: "content",
                table: "service_directions");

            migrationBuilder.DropColumn(
                name: "slug",
                schema: "content",
                table: "service_directions");

            migrationBuilder.DropColumn(
                name: "updated_at",
                schema: "content",
                table: "service_directions");
        }
    }
}
