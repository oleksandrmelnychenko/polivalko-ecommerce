namespace PoliValko.Infrastructure.Security.Permissions;

public static class PermissionCatalog
{
    public const string Version = "2026-11-08.1";

    public static readonly IReadOnlyList<PermissionDefinition> Permissions =
    [
        new(PermissionKeys.DashboardView, "Огляд: перегляд показників", "Виручка, замовлення, статуси й топ товарів за період.", "dashboard", "Огляд", PermissionRisk.Low),

        new(PermissionKeys.OrdersView, "Замовлення: список і картка", "Список, пошук, картка, оплати, чеки, повернення й історія замовлення.", "orders", "Замовлення", PermissionRisk.Low),
        new(PermissionKeys.OrdersStatusChange, "Зміна статусу замовлення", "Підтвердження, відправлення, видача, скасування, також масово; службова нотатка.", "orders", "Замовлення", PermissionRisk.Medium),
        new(PermissionKeys.OrdersRefundCreate, "Оформлення повернення коштів", "Повне чи часткове повернення за позиціями.", "orders", "Замовлення", PermissionRisk.High),
        new(PermissionKeys.OrdersExport, "Експорт замовлень у CSV", "Вивантаження вибірки з контактами покупців.", "orders", "Замовлення", PermissionRisk.Medium),

        new(PermissionKeys.CustomersView, "Покупці: список і контакти", "Імена, телефони, пошта, кабінети й історія замовлень покупців.", "customers", "Покупці", PermissionRisk.Medium),
        new(PermissionKeys.CustomerAccountsManage, "Кабінети покупців: блокування, скидання пароля", "Блокування й розблокування кабінету, лист для відновлення пароля.", "customers", "Покупці", PermissionRisk.High),

        new(PermissionKeys.RequestsView, "Заявки на послуги: перегляд", "Заявки з форми послуг на сайті.", "requests", "Заявки", PermissionRisk.Low),
        new(PermissionKeys.RequestsStatusChange, "Зміна статусу заявки", "Взяти в роботу, завершити, скасувати.", "requests", "Заявки", PermissionRisk.Low),

        new(PermissionKeys.ProductsView, "Товари: перегляд", "Список товарів, залишки й картка товару.", "catalog", "Каталог", PermissionRisk.Low),
        new(PermissionKeys.ProductsEdit, "Товари: редагування, фото, видимість", "Назва для вітрини, опис, характеристики, бренд, мітки, SEO, фото, показ на сайті, також масово.", "catalog", "Каталог", PermissionRisk.Medium),
        new(PermissionKeys.CollectionsManage, "Добірки головної", "Склад і порядок добірок на головній сторінці.", "catalog", "Каталог", PermissionRisk.Low),
        new(PermissionKeys.CategoriesManage, "Категорії каталогу", "Створення, зміна й видалення категорій і підкатегорій, фото, опис, фільтри, групи Navkolo.", "catalog", "Каталог", PermissionRisk.Medium),
        new(PermissionKeys.AttributesManage, "Характеристики: довідник і фільтри", "Назви, одиниці, вигляд фільтра; перейменування змінює характеристики всіх товарів.", "catalog", "Каталог", PermissionRisk.Medium),
        new(PermissionKeys.BrandsManage, "Бренди", "Довідник брендів: назва, опис, логотип, перейменування й об'єднання.", "catalog", "Каталог", PermissionRisk.Low),
        new(PermissionKeys.LabelsManage, "Мітки товарів", "Мітки «Акція», «Новинка», «Хіт» та власні: колір, порядок, правила показу.", "catalog", "Каталог", PermissionRisk.Low),
        new(PermissionKeys.CatalogImportRun, "Імпорт товарів з файлу", "Завантаження каталогу Navkolo з JSON або CSV.", "catalog", "Каталог", PermissionRisk.High),

        new(PermissionKeys.SiteHomeManage, "Головна й банери", "Банери, оголошення, порядок і тексти блоків головної сторінки.", "site", "Сайт", PermissionRisk.Medium),
        new(PermissionKeys.SiteContentManage, "Сторінки й послуги", "Тексти сторінок і напрями послуг.", "site", "Сайт", PermissionRisk.Medium),
        new(PermissionKeys.RedirectsManage, "Перенаправлення адрес (SEO)", "Перенаправлення старих адрес сайту (301).", "site", "Сайт", PermissionRisk.Medium),
        new(PermissionKeys.SiteSeoManage, "SEO: мета-шаблони", "Шаблони заголовків і описів товарів і категорій.", "site", "Сайт", PermissionRisk.Medium),

        new(PermissionKeys.SettingsShopManage, "Магазин: контакти, графік, реквізити", "Контакти, графік роботи, особливі дні, соцмережі й реквізити продавця.", "settings", "Налаштування", PermissionRisk.High),
        new(PermissionKeys.PickupManage, "Доставка й самовивіз", "Способи доставки, точки самовивозу: адреса, графік, інструкція, видимість.", "settings", "Налаштування", PermissionRisk.Medium),
        new(PermissionKeys.SettingsNavkoloManage, "Навколо: підключення", "Ключ API, склад і ввімкнення синхронізації.", "settings", "Налаштування", PermissionRisk.High),
        new(PermissionKeys.SettingsNotificationsManage, "Сповіщення", "Куди й про які події надсилати сповіщення працівникам.", "settings", "Налаштування", PermissionRisk.Medium),

        new(PermissionKeys.IntegrationStatusView, "Стан синхронізацій", "Останні запуски, помилки, стан Нової пошти, оплати й чеків.", "integration", "Інтеграції", PermissionRisk.Low),
        new(PermissionKeys.IntegrationJobsRun, "Запуск синхронізацій вручну", "Позаплановий запуск фонових завдань.", "integration", "Інтеграції", PermissionRisk.Medium),
        new(PermissionKeys.IntegrationOutboxManage, "Черга операцій і повтор", "Операції, які не вдалися після всіх автоматичних спроб, і ручний повтор.", "integration", "Інтеграції", PermissionRisk.High),

        new(PermissionKeys.AuditView, "Журнал змін", "Хто, коли й що змінив у консолі.", "system", "Система", PermissionRisk.Medium),
        new(PermissionKeys.StaffUsersManage, "Працівники: створення, ролі, паролі, блокування", "Облікові записи працівників і призначення ролей.", "system", "Система", PermissionRisk.High),
        new(PermissionKeys.StaffRolesManage, "Ролі та права", "Створення ролей і налаштування їхніх прав.", "system", "Система", PermissionRisk.High),
    ];

    public static readonly IReadOnlyList<string> ManagerDefaults =
    [
        PermissionKeys.DashboardView,
        PermissionKeys.OrdersView,
        PermissionKeys.OrdersStatusChange,
        PermissionKeys.OrdersRefundCreate,
        PermissionKeys.OrdersExport,
        PermissionKeys.CustomersView,
        PermissionKeys.RequestsView,
        PermissionKeys.RequestsStatusChange,
        PermissionKeys.ProductsView,
        PermissionKeys.ProductsEdit,
        PermissionKeys.CollectionsManage,
        PermissionKeys.LabelsManage,
        PermissionKeys.IntegrationStatusView,
    ];

    private static readonly HashSet<string> Keys = Permissions.Select(p => p.Key).ToHashSet(StringComparer.Ordinal);

    public static IReadOnlyList<string> AllKeys { get; } = Permissions.Select(p => p.Key).ToList();

    public static bool Contains(string key) => Keys.Contains(key);

    public static IReadOnlyList<string> Order(IEnumerable<string> keys)
    {
        var set = keys.ToHashSet(StringComparer.Ordinal);
        return Permissions.Where(p => set.Contains(p.Key)).Select(p => p.Key).ToList();
    }
}
