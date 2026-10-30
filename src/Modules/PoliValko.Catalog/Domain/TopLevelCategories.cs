namespace PoliValko.Catalog.Domain;

/// <summary>
/// Верхній рівень каталогу відповідає назвам груп у Navkolo (розділ 4 ТЗ). Поки немає доступу до API,
/// зв'язок із групою — її назва; після перевірки API адміністратор замінить його на ідентифікатор групи.
/// </summary>
public static class TopLevelCategories
{
    public static readonly Category[] All =
    [
        Create("0192f3a0-0001-7000-8000-000000000001", 1, "vse-dlia-vidpochynku", "Все для відпочинку"),
        Create("0192f3a0-0002-7000-8000-000000000002", 2, "vse-dlia-polyvu", "Все для поливу"),
        Create("0192f3a0-0003-7000-8000-000000000003", 3, "vse-dlia-roslyn", "Все для рослин"),
        Create("0192f3a0-0004-7000-8000-000000000004", 4, "hospodarchi-tovary", "Господарчі товари"),
        Create("0192f3a0-0005-7000-8000-000000000005", 5, "landshaftnyi-dyzain", "Ландшафтний дизайн"),
        Create("0192f3a0-0006-7000-8000-000000000006", 6, "novyi-rik", "Новий рік"),
        Create("0192f3a0-0007-7000-8000-000000000007", 7, "ruchnyi-instrument", "Ручний інструмент"),
        Create("0192f3a0-0008-7000-8000-000000000008", 8, "tekhnika-dlia-sadu-ta-horodu", "Техніка для саду та городу"),
    ];

    private static Category Create(string id, int order, string slug, string name) =>
        new() { Id = Guid.Parse(id), SortOrder = order, Slug = slug, Name = name, IsVisible = true, NavkoloRef = name };
}
