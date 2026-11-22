using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Storefront;

namespace PoliValko.IntegrationTests;

public sealed class SeasonalPurposeTests(ApiFactory api)
{
    [Fact]
    public async Task Monthly_leaders_match_sowing_watering_mowing_and_winterization_tasks()
    {
        var ct = TestContext.Current.CancellationToken;
        var cases = new (string Section, string Title, string? Purpose, int[] Months)[]
        {
            ("Насіння", "Томат Чорний Принц", "Для розсади", [2, 3, 4]),
            ("Грунти та добавки", "Кокосовий брикет", null, [1, 2, 3, 4, 5]),
            ("Грунти та добавки", "Кокосові чіпси для орхідей", null, []),
            ("vse-dlia-polyvu", "Шланг-дощувач", null, [4, 5, 6, 7, 8]),
            ("vse-dlia-polyvu", "Набір для поливу з конекторами", null, [4, 5, 6, 7, 8]),
            ("vse-dlia-polyvu", "З’єднувальна муфта для крапельної трубки", "Для шланга", []),
            ("vse-dlia-polyvu", "Корпус дощувача", null, []),
            ("vse-dlia-polyvu", "Перехідник для продувки поливу", null, [10, 11]),
            ("Техніка для саду та городу", "Газонокосарка", null, [4, 5, 6, 7, 8, 9]),
            ("Техніка для саду та городу", "Квадратна ліска для тримера", null, []),
        };
        await CheckMonthsAsync(cases, Enumerable.Range(1, 12).ToArray(), ct);
    }

    [Fact]
    public async Task Seasonal_selection_uses_the_product_task_and_respects_category_and_month_boundaries()
    {
        var ct = TestContext.Current.CancellationToken;
        var cases = new (string Section, string Title, string? Attribute, int[] Months)[]
        {
            ("Годівниці", "Корзина велика", null, []),
            ("Годівниці", "Годівниця", null, [1, 3, 11]),
            ("Годівниці", "Шпаківня", null, [3]),
            ("Обігрівачі", "Лампа акумуляторна", null, []),
            ("Обігрівачі", "Конвектор", null, [1, 3, 11]),
            ("Насіння", "Перець солодкий", null, [1, 3]),
            ("Насіння", "Редька Зимова Чорна", null, []),
            ("Насіння", "Фацелія", "Сидерат", [9]),
            ("Добрива", "Суміш для газону", "Осіннє підживлення", [9, 11]),
            ("Горщики", "Вазон для орхідей", null, []),
            ("Горщики", "Касета для розсади", null, [3]),
            ("Септик/Компост", "Унікал", "Для компостування листя", [9, 11]),
            ("Септик/Компост", "Унікал для каналізації", null, []),
            ("Все для прибирання", "Реагент антилід", null, [1, 11]),
            ("Все для прибирання", "Пакет для сміття", null, []),
            ("Хімія для басейнів", "Засіб для зимової консервації басейну", null, [9]),
            ("Хімія для басейнів", "Хлор у гранулах", null, [7]),
            ("Горщики", "Хлор у гранулах", null, []),
        };
        await CheckMonthsAsync(cases, [1, 3, 7, 9, 11], ct);
    }

    private async Task CheckMonthsAsync((string Section, string Title, string? Attribute, int[] Months)[] cases, int[] months, CancellationToken ct)
    {
        var root = await api.WithDbAsync(db => db.Set<Category>().SingleAsync(c => c.Slug == "landshaftnyi-dyzain", ct));
        var expected = new Dictionary<Guid, int[]>();
        var categories = new List<Category>();
        foreach (var section in cases.GroupBy(row => row.Section))
        {
            var category = new Category { Id = Guid.NewGuid(), ParentId = root.Id, Slug = "purpose-" + Guid.NewGuid(), Name = section.Key };
            categories.Add(category);
            await api.WithDbAsync(db => { db.Add(category); return db.SaveChangesAsync(ct); });
            foreach (var row in section)
            {
                var product = await api.AddProductAsync(category.Slug, row.Title, 100);
                expected.Add(product.Id, row.Months);
                if (row.Attribute is null) continue;
                await api.WithDbAsync(db =>
                {
                    db.Add(new ProductAttribute { Id = Guid.NewGuid(), ProductId = product.Id, Name = "Призначення", Value = row.Attribute });
                    return db.SaveChangesAsync(ct);
                });
            }
        }
        await api.WithDbAsync(async db =>
        {
            foreach (var month in months)
            {
                var matches = SeasonalPurpose.Query(db, categories, new DateOnly(2034, month, 15), true).Rows;
                var actual = await matches.Select(m => m.ProductId).ToListAsync(ct);
                actual.Order().ShouldBe(expected.Where(kv => kv.Value.Contains(month)).Select(kv => kv.Key).Order());
            }
            return true;
        });
    }
}
