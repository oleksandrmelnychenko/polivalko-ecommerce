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
                Address = "м. Буча, Київська обл. (точну адресу надає магазин)",
                Schedule = "Пн–Нд, 9:00–19:00 (уточнюється)",
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
        ["greening"] = "Підбір і висадка дерев, кущів і багаторічників, що приживуться на вашій ділянці.",
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
            Lead = "Договір купівлі-продажу між продавцем і покупцем інтернет-магазину.",
            BodyHtml = "<p><strong>Чернетка структури.</strong> Остаточний текст надає й погоджує продавець перед запуском.</p>"
                + "<h2>1. Загальні положення</h2><p>Оформлюючи замовлення, покупець погоджується з умовами цієї оферти.</p>"
                + "<h2>2. Замовлення</h2><p>Замовлення оформлюється на сайті без реєстрації. Після оформлення покупець отримує номер замовлення.</p>"
                + "<h2>3. Ціна й оплата</h2><p>Ціни вказано в гривнях. Способи оплати: онлайн карткою, післяплата, оплата під час самовивозу.</p>"
                + "<h2>4. Доставка</h2><p>Новою поштою по Україні за тарифами перевізника або самовивіз у Бучі.</p>"
                + "<h2>5. Повернення</h2><p>Умови повернення описано на сторінці «Повернення й обмін».</p>"
                + "<h2>6. Продавець</h2><p>Реквізити продавця вказано нижче й на сторінці замовлення.</p>",
            UpdatedAt = Seeded,
        },
        new()
        {
            Slug = "privacy",
            Title = "Політика приватності",
            Lead = "Які дані ми збираємо під час замовлення і як їх використовуємо.",
            BodyHtml = "<p><strong>Чернетка.</strong> Остаточну редакцію погоджує продавець.</p>"
                + "<h2>Які дані</h2><p>Ім'я, телефон, за бажанням email, населений пункт, відділення або адреса доставки, коментар до замовлення.</p>"
                + "<h2>Навіщо</h2><p>Щоб виконати й доставити замовлення, повідомити про його статус і прийняти оплату.</p>"
                + "<h2>Аналітика</h2><p>Ми рахуємо перегляди й покупки без передачі імені, телефону чи email в аналітичні системи.</p>"
                + "<h2>Зберігання</h2><p>Дані зберігаються на захищеному сервері; доступ мають лише працівники, які обробляють замовлення.</p>"
                + "<h2>Ваші права</h2><p>Ви можете попросити показати, виправити або видалити ваші дані, звернувшись за контактами магазину.</p>",
            UpdatedAt = Seeded,
        },
        new()
        {
            Slug = "returns",
            Title = "Повернення й обмін",
            Lead = "Як повернути товар і отримати кошти.",
            BodyHtml = "<p><strong>Чернетка.</strong> Умови погоджує продавець відповідно до закону «Про захист прав споживачів».</p>"
                + "<h2>Строк</h2><p>Товар належної якості можна повернути протягом 14 днів, якщо він не був у використанні й збережено товарний вигляд.</p>"
                + "<h2>Як повернути</h2><p>Зателефонуйте менеджеру й назвіть номер замовлення. Можна повернути все замовлення або окремі товари.</p>"
                + "<h2>Кошти</h2><p>Оплату карткою повертаємо на ту саму картку. Оплату під час отримання — у спосіб, погоджений з менеджером. На повернення видаємо чек.</p>",
            UpdatedAt = Seeded,
        },
        new()
        {
            Slug = "payment-delivery",
            Title = "Доставка й оплата",
            Lead = "Нова пошта по Україні або самовивіз у Бучі.",
            BodyHtml = "<h2>Нова пошта</h2><p>Відділення, поштомат або кур'єр у будь-якому місті України. Місто й відділення обираєте під час оформлення.</p>"
                + "<p>Доставку оплачуєте за тарифами перевізника. Безкоштовну доставку не обіцяємо без затверджених умов.</p>"
                + "<h2>Самовивіз</h2><p>Магазин у Бучі. Коли замовлення готове, менеджер повідомляє, і ви забираєте його в робочі години.</p>"
                + "<h2>Оплата карткою</h2><p>Онлайн через платіжного провайдера. Статус оплати визначає лише підтвердження від провайдера.</p>"
                + "<h2>Післяплата</h2><p>Оплата у відділенні Нової пошти або кур'єру під час отримання.</p>"
                + "<h2>У магазині</h2><p>Оплата під час самовивозу в Бучі.</p>",
            UpdatedAt = Seeded,
        },
    ];
}
