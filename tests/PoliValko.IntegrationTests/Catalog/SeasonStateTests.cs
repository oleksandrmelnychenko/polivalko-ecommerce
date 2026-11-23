using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Storefront;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.IntegrationTests;

// Each test has its own top-level category, its own years and its own pair of dates: the history spans three years,
// sums up whole categories and is cached by date, so shared categories or dates would leak between tests.
// The categories are hidden, so the shop the other tests look at gains neither departments nor products.
public sealed class SeasonStateTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Purchases_in_the_coming_weeks_of_past_years_decide_the_season_and_a_new_product_stays_undecided()
    {
        var today = new DateOnly(2046, 6, 10);
        var shelf = await AddCategoryAsync();
        var newShelf = await AddCategoryAsync(shelf.Id);
        var seasonal = await AddSoldProductAsync(shelf, "Сезонний");
        var elsewhere = await AddSoldProductAsync(shelf, "Не в сезон");
        var even = await AddSoldProductAsync(shelf, "Цілорічний");
        var fresh = await AddSoldProductAsync(newShelf, "Новинка");
        // Six purchases in the same four weeks last year and two in winter.
        await AddReceiptsAsync(seasonal, new DateOnly(2045, 6, 15), 6);
        await AddReceiptsAsync(seasonal, new DateOnly(2045, 1, 10), 2);
        // Many purchases, none of them in those weeks.
        await AddReceiptsAsync(elsewhere, new DateOnly(2044, 9, 1), 60);
        await AddReceiptsAsync(elsewhere, new DateOnly(2045, 9, 1), 60);
        // One purchase a day since the start of last year.
        await AddDailyReceiptsAsync(even, new DateOnly(2045, 1, 1), today.AddDays(-1));
        // First sold a month ago: no past year to compare with.
        await AddReceiptsAsync(fresh, today.AddDays(-30), 10);

        var history = await LoadAsync(today, today);

        Verdict(history, seasonal).ShouldBe((int)Season.In);
        Verdict(history, elsewhere).ShouldBe((int)Season.Off);
        Verdict(history, even).ShouldBe((int)Season.AllYear);
        Verdict(history, fresh).ShouldBe(SeasonHistory.Undecided);
        history.ByCategory[newShelf.Id].ShouldBe((0m, 0m));
        // The shelf holds the three products sold there: 6 + 0 + 28 purchases in the window.
        history.ByCategory[shelf.Id].Observed.ShouldBe(34m);
    }

    [Fact]
    public async Task A_month_looked_at_ahead_counts_only_the_days_of_last_years_window_that_have_passed()
    {
        // October is looked at from 17 October: last year's window for next October began two days ago.
        var today = new DateOnly(2047, 10, 17);
        var anchor = new DateOnly(2048, 10, 15);
        var shelf = await AddCategoryAsync();
        var even = await AddSoldProductAsync(shelf, "Рівний попит");
        // One purchase a day since after the window of two years ago had closed.
        await AddDailyReceiptsAsync(even, new DateOnly(2046, 11, 20), today);

        var history = await LoadAsync(today, anchor);

        // Three purchases in the three days that have passed is exactly the even spread, not an empty season.
        Verdict(history, even).ShouldBe(SeasonHistory.Undecided);
        history.ByCategory[shelf.Id].ShouldBe((3m, 3m));
    }

    [Fact]
    public async Task A_burst_right_after_the_first_sale_is_not_a_season_and_an_old_product_keeps_all_three_windows()
    {
        var today = new DateOnly(2056, 11, 23);
        var shelf = await AddCategoryAsync();
        var oldShelf = await AddCategoryAsync();
        var launched = await AddSoldProductAsync(shelf, "Новинка минулого грудня");
        var old = await AddSoldProductAsync(oldShelf, "Давній товар");
        // First sold inside last year's window: six purchases in six days, then one a month.
        await AddDailyReceiptsAsync(launched, new DateOnly(2055, 12, 10), new DateOnly(2055, 12, 15));
        for (var month = 1; month <= 10; month++) await AddReceiptsAsync(launched, new DateOnly(2056, month, 15), 1);
        // One purchase a day since ten days before the oldest window began.
        await AddDailyReceiptsAsync(old, new DateOnly(2053, 11, 13), today.AddDays(-1));

        var history = await LoadAsync(today, today);

        // The window had begun before the product was first sold, so it cannot be compared with the rest of its life.
        Verdict(history, launched).ShouldBe(SeasonHistory.Undecided);
        history.ByCategory[shelf.Id].ShouldBe((0m, 0m));
        Verdict(history, old).ShouldBe((int)Season.AllYear);
        history.ByCategory[oldShelf.Id].ShouldBe((84m, 84m));
    }

    [Fact]
    public async Task Rules_and_history_give_every_product_a_state_and_its_reason()
    {
        var today = new DateOnly(2051, 12, 10);
        var department = await AddCategoryAsync();
        var shelf = await AddCategoryAsync(department.Id);
        var newYear = await AddCategoryAsync(department.Id, "novyi-rik");
        var pool = await AddCategoryAsync(name: "Хімія для басейнів");
        var summerShelf = await AddCategoryAsync();
        var emptyShelf = await AddCategoryAsync();
        var fair = await AddCategoryAsync(name: "novyi-rik");
        var garland = await api.AddProductAsync(newYear.Slug, "Гірлянда", 100);
        var sold = await AddSoldProductAsync(shelf, "Продається зараз");
        var sparse = await AddSoldProductAsync(shelf, "Мало чеків");
        var topLevel = await api.AddProductAsync(department.Slug, "Без чеків у відділі", 100);
        var chlorine = await AddSoldProductAsync(pool, "Хлор у гранулах");
        var summer = await AddSoldProductAsync(summerShelf, "Літній товар");
        var unknown = await api.AddProductAsync(emptyShelf.Slug, "Без історії", 100);
        var autumnToy = await AddSoldProductAsync(fair, "Іграшка, яку купують восени");
        var shock = await AddSoldProductAsync(pool, "Хлор шок");
        await AddReceiptsAsync(sold, new DateOnly(2050, 12, 15), 6);
        await AddReceiptsAsync(sold, new DateOnly(2050, 6, 1), 2);
        await AddReceiptsAsync(sparse, new DateOnly(2050, 6, 1), 1);
        await AddDailyReceiptsAsync(chlorine, new DateOnly(2050, 1, 1), today.AddDays(-1));
        await AddReceiptsAsync(summer, new DateOnly(2049, 9, 1), 60);
        await AddReceiptsAsync(summer, new DateOnly(2050, 9, 1), 60);
        await AddReceiptsAsync(autumnToy, new DateOnly(2049, 9, 1), 60);
        await AddReceiptsAsync(autumnToy, new DateOnly(2050, 9, 1), 60);
        await AddReceiptsAsync(shock, new DateOnly(2050, 12, 15), 6);
        await AddReceiptsAsync(shock, new DateOnly(2050, 6, 1), 2);
        Category[] categories = [department, shelf, newYear, pool, summerShelf, emptyShelf, fair];
        Product[] products = [garland, sold, sparse, topLevel, chlorine, summer, unknown, autumnToy, shock];

        var december = await ClassifyAsync(products, categories, today, today);

        december[garland.Id].ShouldBe(("in_season", "rule"));
        december[sold.Id].ShouldBe(("in_season", "product"));
        december[sparse.Id].ShouldBe(("in_season", "category"));
        december[topLevel.Id].ShouldBe(("in_season", "department"));
        // Its rule is for summer, but it sells evenly all year.
        december[chlorine.Id].ShouldBe(("all_year", "product"));
        december[summer.Id].ShouldBe(("off_season", "product"));
        december[unknown.Id].ShouldBe(("all_year", "none"));
        // A rule for this month outranks receipts that say the opposite.
        december[autumnToy.Id].ShouldBe(("in_season", "rule"));
        // Receipts now outrank a rule written for the summer.
        december[shock.Id].ShouldBe(("in_season", "product"));

        // Looked at for January: the garland rule is over and nothing else speaks for it.
        var january = await ClassifyAsync(products, categories, today, new DateOnly(2052, 1, 15));
        january[garland.Id].ShouldBe(("off_season", "rule"));

        // The shelf leaves its department while the history is still cached: the next look follows the new tree.
        var moved = new Category { Id = shelf.Id, Slug = shelf.Slug, Name = shelf.Name, IsVisible = false };
        var afterMove = await ClassifyAsync(products, [department, moved, newYear, pool, summerShelf, emptyShelf, fair], today, today);
        afterMove[topLevel.Id].ShouldBe(("all_year", "none"));
        afterMove[sparse.Id].ShouldBe(("in_season", "department"));
    }

    private Task<Dictionary<Guid, (string Season, string Source)>> ClassifyAsync(Product[] products, Category[] categories,
        DateOnly today, DateOnly anchor) => api.WithScopeAsync(async services =>
    {
        var db = services.GetRequiredService<PoliValkoDbContext>();
        var ids = products.Select(p => p.Id).ToArray();
        var rows = await (await SeasonClassifier.QueryAsync(db.Set<Product>().Where(p => ids.Contains(p.Id)), categories, db,
            services.GetRequiredService<IMemoryCache>(), today, anchor, Ct)).ToListAsync(Ct);
        return rows.ToDictionary(row => row.ProductId, row => (SeasonClassifier.Name(row.State), SeasonClassifier.Source(row)));
    });

    private static int Verdict(SeasonHistory history, Product product)
    {
        var index = Array.IndexOf(history.ProductIds, product.Id);
        index.ShouldBeGreaterThanOrEqualTo(0, product.Name + " has no history");
        return history.Verdicts[index];
    }

    private Task<SeasonHistory> LoadAsync(DateOnly today, DateOnly anchor) => api.WithScopeAsync(services =>
        SeasonalHistory.LoadAsync(services.GetRequiredService<PoliValkoDbContext>(),
            services.GetRequiredService<IMemoryCache>(), today, anchor, Ct));

    private async Task<Category> AddCategoryAsync(Guid? parent = null, string name = "Полиця сезону")
    {
        var category = new Category { Id = Guid.NewGuid(), ParentId = parent, Slug = "season-" + Guid.NewGuid(), Name = name, IsVisible = false };
        await api.WithDbAsync(db => { db.Add(category); return db.SaveChangesAsync(Ct); });
        return category;
    }

    private async Task<Product> AddSoldProductAsync(Category category, string name)
    {
        var product = await api.AddProductAsync(category.Slug, name, 100);
        await api.WithDbAsync(db => db.Set<Product>().Where(p => p.Id == product.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.NavkoloId, "dntrade-code:" + product.Id), Ct));
        return product;
    }

    private Task AddReceiptsAsync(Product product, DateOnly day, int count) => AddDailyReceiptsAsync(product, day, day, count);

    private Task AddDailyReceiptsAsync(Product product, DateOnly from, DateOnly to, int perDay = 1)
    {
        var code = product.Id.ToString();
        return api.WithDbAsync(db => db.Database.ExecuteSqlAsync($"""
            INSERT INTO accounting.documents(id,source_account,source_id,entity_type,kind,day,status,store_ids,total,details)
            SELECT gen_random_uuid(),'valko-dntrade',gen_random_uuid()::text,'receipt','cash',day::date,'active',ARRAY[]::text[],100,
                jsonb_build_object('products',jsonb_build_array(jsonb_build_object('product',
                    jsonb_build_object('code',{code}),'quantity',1)))
            FROM generate_series({from}::timestamp,{to}::timestamp,interval '1 day') day CROSS JOIN generate_series(1,{perDay})
            """, Ct));
    }
}
