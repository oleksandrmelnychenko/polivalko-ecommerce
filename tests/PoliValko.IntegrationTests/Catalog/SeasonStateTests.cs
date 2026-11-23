using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Storefront;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.IntegrationTests;

// Each test has its own top-level category, its own years and its own pair of dates: the history spans three years,
// sums up whole categories and is cached by date, so shared categories or dates would leak between tests.
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

    private static int Verdict(SeasonHistory history, Product product)
    {
        var index = Array.IndexOf(history.ProductIds, product.Id);
        index.ShouldBeGreaterThanOrEqualTo(0, product.Name + " has no history");
        return history.Verdicts[index];
    }

    private Task<SeasonHistory> LoadAsync(DateOnly today, DateOnly anchor) => api.WithScopeAsync(services =>
        SeasonalHistory.LoadAsync(services.GetRequiredService<PoliValkoDbContext>(),
            services.GetRequiredService<IMemoryCache>(), today, anchor, Ct));

    private async Task<Category> AddCategoryAsync(Guid? parent = null)
    {
        var category = new Category { Id = Guid.NewGuid(), ParentId = parent, Slug = "season-" + Guid.NewGuid(), Name = "Полиця сезону" };
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
