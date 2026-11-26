using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Media;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Content.Persistence;

internal sealed class ContentModelConfigurator : IModelConfigurator
{
    private static readonly DateTimeOffset Seeded = new(2026, 10, 28, 0, 0, 0, TimeSpan.Zero);

    public void Configure(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ServiceRequest>(builder =>
        {
            builder.ToTable("service_requests", Schemas.Content);
            builder.HasKey(r => r.Id);
            builder.Property(r => r.Id).ValueGeneratedNever();
            builder.Property(r => r.Name).HasMaxLength(100);
            builder.Property(r => r.Phone).HasMaxLength(20);
            builder.Property(r => r.DirectionCode).HasMaxLength(50);
            builder.Property(r => r.Comment).HasMaxLength(1000);
            builder.Property(r => r.Status).HasConversion<string>().HasMaxLength(20);
            builder.HasIndex(r => new { r.Status, r.CreatedAt });
        });

        modelBuilder.Entity<ContentPage>(builder =>
        {
            builder.ToTable("pages", Schemas.Content);
            builder.HasKey(p => p.Slug);
            builder.Property(p => p.Slug).HasMaxLength(50);
            builder.Property(p => p.Title).HasMaxLength(200);
            builder.Property(p => p.Lead).HasMaxLength(500);
            builder.Property(p => p.UpdatedBy).HasMaxLength(200);
            builder.Property(p => p.SeoTitle).HasMaxLength(200);
            builder.Property(p => p.SeoDescription).HasMaxLength(500);
            builder.HasData(DraftPages());
        });

        modelBuilder.Entity<SiteContacts>(builder =>
        {
            builder.ToTable("contacts", Schemas.Content);
            builder.HasKey(c => c.Id);
            builder.Property(c => c.Id).ValueGeneratedNever();
            builder.Property(c => c.StorePhone).HasMaxLength(30);
            builder.Property(c => c.ServicesPhone).HasMaxLength(30);
            builder.Property(c => c.Email).HasMaxLength(200);
            builder.Property(c => c.Address).HasMaxLength(300);
            builder.Property(c => c.Schedule).HasMaxLength(300);
            builder.Property(c => c.MapUrl).HasMaxLength(500);
            builder.Property(c => c.Instagram).HasMaxLength(300);
            builder.Property(c => c.Facebook).HasMaxLength(300);
            builder.Property(c => c.Telegram).HasMaxLength(300);
            builder.Property(c => c.YouTube).HasMaxLength(300);
            builder.Property(c => c.Viber).HasMaxLength(300);
            builder.HasData(new SiteContacts
            {
                Id = SiteContacts.SingletonId,
                Address = "м. Буча, вул. Депутатська, 1-В, ТК «Варшавський», фасадний ряд, приміщення №8",
                Schedule = "Пн–Сб 09:00–17:30, Нд — вихідний",
                UpdatedAt = Seeded,
            });
        });

        modelBuilder.Entity<ServiceDirectionContent>(builder =>
        {
            builder.ToTable("service_directions", Schemas.Content);
            builder.HasKey(d => d.Code);
            builder.Property(d => d.Code).HasMaxLength(50);
            builder.Property(d => d.Description).HasMaxLength(1000);
            builder.Property(d => d.ImageUrl).HasMaxLength(ImageUrls.MaxLength);
            builder.Property(d => d.Slug).HasMaxLength(ServiceDirectionContent.SlugLength);
            builder.HasIndex(d => d.Slug).IsUnique();
            builder.Property(d => d.SeoTitle).HasMaxLength(200);
            builder.Property(d => d.SeoDescription).HasMaxLength(500);
            builder.HasData(ServiceDirections.All.Select((d, i) => new ServiceDirectionContent
            {
                Code = d.Code,
                SortOrder = i + 1,
                IsVisible = true,
                Description = DraftDescriptions.GetValueOrDefault(d.Code),
            }));
        });

        modelBuilder.Entity<Banner>(builder =>
        {
            builder.ToTable("banners", Schemas.Content);
            builder.HasKey(b => b.Id);
            builder.Property(b => b.Id).ValueGeneratedNever();
            builder.Property(b => b.Title).HasMaxLength(Banner.TitleLength);
            builder.Property(b => b.Text).HasMaxLength(Banner.TextLength);
            builder.Property(b => b.Kicker).HasMaxLength(Banner.KickerLength);
            builder.Property(b => b.ButtonLabel).HasMaxLength(Banner.ButtonLabelLength);
            builder.Property(b => b.Link).HasMaxLength(Banner.LinkLength);
            builder.Property(b => b.ImageUrl).HasMaxLength(ImageUrls.MaxLength);
            builder.Property(b => b.MobileImageUrl).HasMaxLength(ImageUrls.MaxLength);
            builder.HasIndex(b => b.SortOrder);
        });
    }

    private static readonly Dictionary<string, string> DraftDescriptions = new()
    {
        ["landscape-design"] = "Проєкт ділянки: зонування, доріжки, рослини й освітлення з урахуванням ґрунту та сонця.",
        ["irrigation-installation"] = "Розрахунок і монтаж автоматичного поливу газону, клумб і городу.",
        ["greening"] = "Підбір і висадка дерев, кущів і багаторічників під ґрунт і освітлення ділянки.",
        ["lawns"] = "Посівний або рулонний газон: підготовка основи, укладання, перший догляд.",
        ["garden-care"] = "Сезонний догляд: обрізка, підживлення, мульчування, прибирання ділянки.",
        ["irrigation-service"] = "Запуск навесні, консервація на зиму, ремонт і налаштування системи поливу.",
        ["plant-treatment"] = "Захист від шкідників і хвороб препаратами, дозволеними в Україні.",
    };

    private static ContentPage[] DraftPages() =>
    [
        new()
        {
            Slug = "offer",
            Title = "Публічна оферта",
            Lead = "На яких умовах ви купуєте товари?",
            BodyHtml = "<h2>1. Що охоплює оферта</h2><p>Ці умови діють, коли ви купуєте товари в інтернет-магазині «Полі-Валько». До кожного замовлення застосовується редакція умов, з якою ви погодилися під час оформлення. Для садових робіт обсяг, ціну й дату виконання узгоджуємо окремо.</p>"
                + "<h2>2. Оформлення замовлення</h2><p>Додайте товари до кошика, перевірте кількість і виберіть спосіб отримання та оплати. Замовлення можна оформити без реєстрації. Якщо посилку забиратиме інша людина, вкажіть її дані як отримувача.</p><p>Перед надсиланням замовлення ви підтверджуєте згоду з офертою. Після оформлення на сайті з’явиться номер замовлення. Назвіть його, якщо хочете уточнити деталі або змінити замовлення до відправлення.</p>"
                + "<h2>3. Ціна й оплата</h2><p>Ціни на сайті вказано в гривнях. У кошику видно вартість товарів з урахуванням кількості та знижок. Якщо під час перевірки зміниться ціна або товару бракуватиме, узгодимо з вами зміни. Ви можете відмовитися від запропонованої заміни чи нової ціни.</p><p>Під час оформлення сайт покаже доступні для вашого замовлення способи оплати. Це може бути оплата карткою онлайн, післяплата або розрахунок у магазині під час самовивозу.</p>"
                + "<h2>4. Доставка й самовивіз</h2><p>Нова пошта доставляє замовлення у відділення, поштомат або кур’єром за адресою. Вартість доставки визначає перевізник за своїми тарифами.</p><p>Самовивіз безкоштовний. Дочекайтеся повідомлення про готовність замовлення й назвіть його номер у магазині. Адресу, графік і способи отримання наведено на сторінці <a href=\"/payment-delivery\">«Доставка й оплата»</a>.</p>"
                + "<h2>5. Обмін, повернення та недоліки товару</h2><p>Щоб обміняти або повернути покупку, зв’яжіться з магазином і вкажіть, про який товар ідеться. Строки, умови та спосіб повернення коштів описано на сторінці <a href=\"/returns\">«Повернення й обмін»</a>.</p><p>Якщо товар має недолік, опишіть його під час звернення. Такі звернення розглядаємо відповідно до законодавства України про захист прав споживачів.</p>"
                + "<h2>6. Дані покупця та звернення</h2><p>Контактні дані покупця й отримувача потрібні, щоб оформити замовлення, повідомити про його стан і передати посилку. Докладніше про обробку даних — у <a href=\"/privacy\">політиці конфіденційності</a>.</p><p>Для питань щодо покупки або претензій скористайтеся <a href=\"/contacts\">контактами магазину</a>. Ви також маєте право звернутися до органу захисту прав споживачів або до суду.</p>",
            UpdatedAt = Seeded,
        },
        new()
        {
            Slug = "privacy",
            Title = "Політика приватності",
            Lead = "Як ми використовуємо ваші дані?",
            BodyHtml = "<h2>Які дані</h2><p>Ім'я, телефон, за бажанням email, населений пункт, відділення або адреса доставки, коментар до замовлення.</p>"
                + "<h2>Навіщо</h2><p>Щоб виконати й доставити замовлення, повідомити про його статус і прийняти оплату.</p>"
                + "<h2>Аналітика</h2><p>Ми рахуємо перегляди й покупки без передачі імені, телефону чи email в аналітичні системи.</p>"
                + "<h2>Зберігання</h2><p>Дані зберігаються на захищеному сервері. Доступ до них мають лише працівники, які обробляють замовлення.</p>"
                + "<h2>Ваші права</h2><p>Щоб переглянути, виправити або видалити свої дані, зателефонуйте чи напишіть у магазин.</p>",
            UpdatedAt = Seeded,
        },
        new()
        {
            Slug = "returns",
            Title = "Повернення й обмін",
            Lead = "Як повернути або обміняти товар?",
            BodyHtml = "<h2>14 днів на повернення</h2><p>Можна повернути товар належної якості, яким не користувалися і який зберіг товарний вигляд.</p>"
                + "<h2>Як оформити повернення</h2><p>Зателефонуйте в магазин, назвіть номер замовлення та скажіть, які товари хочете повернути. Можна повернути й усе замовлення.</p>"
                + "<h2>Як повертаємо кошти</h2><p><strong>Оплата карткою.</strong> Гроші повернемо на ту саму картку.</p><p><strong>Оплата під час отримання.</strong> Спосіб повернення узгодимо з вами. В обох випадках ви отримаєте чек.</p>",
            UpdatedAt = Seeded,
        },
        new()
        {
            Slug = "payment-delivery",
            Title = "Доставка й оплата",
            Lead = "Як отримати й оплатити замовлення?",
            BodyHtml = "<h2>Сторінка замовлення</h2><p>Після оформлення відкривається сторінка замовлення. На ній видно статус, оплату й чеки. Збережіть посилання, щоб повернутися до неї.</p>"
                + "<h2>Підтвердження</h2><p>Ціну й залишок ми звіряємо зі складом магазину під час оформлення. Якщо звірити не вдалося, менеджер підтвердить замовлення телефоном, і оплата карткою стане доступною після цього.</p>",
            UpdatedAt = Seeded,
        },
    ];
}
