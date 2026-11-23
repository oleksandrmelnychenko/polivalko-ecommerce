using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Storefront;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.IntegrationTests;

// The order of the catalog in both storefront modes: pins, what can be bought, the season, then what the mode ranks by.
// Each test has its own hidden sections and its own day, so neither receipts nor what is kept in memory leaks between tests.
public sealed class SeasonOrderTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Both_modes_show_what_is_in_season_first_then_what_sells_all_year_then_what_is_out_of_season()
    {
        var today = new DateOnly(2064, 12, 10);
        var shelf = await api.AddCategoryAsync();
        var seasonal = await api.AddSoldProductAsync(shelf, "Товар сезону");
        var steady = await api.AddSoldProductAsync(shelf, "Товар цілорічний");
        var away = await api.AddSoldProductAsync(shelf, "Товар не сезону");
        var pin = await api.AddSoldProductAsync(shelf, "Закріплений не сезону");
        var gone = await api.AddSoldProductAsync(shelf, "Товар сезону без залишку", stock: 0);
        // Bought in these weeks last year; bought every day; bought in September only.
        await api.AddReceiptsAsync(seasonal, new DateOnly(2063, 12, 15), 6);
        await api.AddReceiptsAsync(seasonal, new DateOnly(2063, 6, 1), 2);
        await api.AddReceiptsAsync(gone, new DateOnly(2063, 12, 16), 6);
        await api.AddReceiptsAsync(gone, new DateOnly(2063, 6, 2), 2);
        await api.AddDailyReceiptsAsync(steady, new DateOnly(2063, 1, 1), today.AddDays(-1));
        foreach (var product in new[] { away, pin })
        {
            await api.AddReceiptsAsync(product, new DateOnly(2062, 9, 1), 60);
            await api.AddReceiptsAsync(product, new DateOnly(2063, 9, 1), 60);
        }
        Product[] products = [seasonal, steady, away, pin, gone];
        Guid[] bySeason = [seasonal.Id, steady.Id, pin.Id, away.Id, gone.Id];

        foreach (var mode in new[] { ProductSort.Seasonal, ProductSort.StockCover })
        {
            // The product bought every day has by far the most purchases, and those out of season have the largest
            // stock for their sales: neither comes before the season.
            (await RankAsync(products, [shelf], today, mode)).ShouldBe(bySeason, mode);
            // A category page and a search keep the same order.
            (await RankAsync(products, [shelf], today, mode, acrossCategories: false)).ShouldBe(bySeason, mode);
            (await RankAsync(products, [shelf], today, mode, term: "товар")).ShouldBe(bySeason, mode);
            // Pins come before everything, an exact article before pins, and nothing is hidden.
            (await RankAsync(products, [shelf], today, mode, pinned: [pin.Id]))
                .ShouldBe([pin.Id, seasonal.Id, steady.Id, away.Id, gone.Id], mode);
            (await RankAsync(products, [shelf], today, mode, term: gone.Sku))[0].ShouldBe(gone.Id, mode);
        }
    }

    [Fact]
    public async Task Inside_a_season_products_follow_their_purchases_in_the_same_weeks_of_past_years_and_lately()
    {
        var today = new DateOnly(2065, 12, 10);
        var heaters = await api.AddCategoryAsync(name: "Обігрівачі");
        // The names sort the other way round, so only the purchases can give this order.
        var lastYear = await api.AddSoldProductAsync(heaters, "Обігрівач 5");
        var twoYearsAgo = await api.AddSoldProductAsync(heaters, "Обігрівач 4");
        var threeYearsAgo = await api.AddSoldProductAsync(heaters, "Обігрівач 3");
        var lately = await api.AddSoldProductAsync(heaters, "Обігрівач 2");
        var never = await api.AddSoldProductAsync(heaters, "Обігрівач 1");
        // Two purchases last year count for six, two the year before for four, three older ones for three,
        // one in the last four weeks for two.
        await api.AddReceiptsAsync(lastYear, new DateOnly(2064, 12, 15), 2);
        await api.AddReceiptsAsync(twoYearsAgo, new DateOnly(2063, 12, 15), 2);
        await api.AddReceiptsAsync(threeYearsAgo, new DateOnly(2062, 12, 15), 3);
        await api.AddReceiptsAsync(lately, today.AddDays(-5), 1);

        var order = await RankAsync([lastYear, twoYearsAgo, threeYearsAgo, lately, never], [heaters], today, ProductSort.Seasonal);

        order.ShouldBe([lastYear.Id, twoYearsAgo.Id, threeYearsAgo.Id, lately.Id, never.Id]);
    }

    [Fact]
    public async Task The_first_places_take_turns_between_rule_families_and_products_in_season_by_their_sales()
    {
        var today = new DateOnly(2066, 12, 10);
        var heaters = await api.AddCategoryAsync(name: "Обігрівачі");
        var shelf = await api.AddCategoryAsync();
        var bare = await api.AddCategoryAsync();
        var heater = await api.AddSoldProductAsync(heaters, "Обігрівач 1");
        var convector = await api.AddSoldProductAsync(heaters, "Конвектор 2");
        // No rule names these two: only their receipts put them in season.
        var sold = await api.AddSoldProductAsync(shelf, "Товар 1");
        var alsoSold = await api.AddSoldProductAsync(shelf, "Товар 2");
        var plain = await api.AddProductAsync(bare.Slug, "Товар 3", 100);
        await api.AddReceiptsAsync(heater, new DateOnly(2065, 12, 15), 3);
        await api.AddReceiptsAsync(convector, new DateOnly(2065, 12, 15), 1);
        await api.AddReceiptsAsync(sold, new DateOnly(2065, 12, 15), 6);
        await api.AddReceiptsAsync(sold, new DateOnly(2065, 6, 1), 2);
        await api.AddReceiptsAsync(alsoSold, new DateOnly(2065, 12, 16), 5);
        await api.AddReceiptsAsync(alsoSold, new DateOnly(2065, 6, 2), 2);

        var order = await RankAsync([heater, convector, sold, alsoSold, plain], [heaters, shelf, bare], today, ProductSort.Seasonal);

        // The rule family opens, the products in season by their sales follow as a family of their own, and so in turn,
        // although both of them were bought more often than any heater.
        order.ShouldBe([heater.Id, sold.Id, convector.Id, alsoSold.Id, plain.Id]);
    }

    [Fact]
    public async Task Products_nobody_has_bought_and_no_rule_names_are_listed_by_name_and_have_no_season()
    {
        // No receipts in these years, no orders, no rule for the section, no verdict for it: every row set is empty.
        var today = new DateOnly(2070, 5, 5);
        var shelf = await api.AddCategoryAsync();
        var second = await api.AddProductAsync(shelf.Slug, "Товар Б", 100);
        var first = await api.AddProductAsync(shelf.Slug, "Товар А", 100);

        foreach (var mode in new[] { ProductSort.Seasonal, ProductSort.StockCover })
            (await RankAsync([second, first], [shelf], today, mode)).ShouldBe([first.Id, second.Id], mode);
        var seasons = await api.WithScopeAsync(async services =>
        {
            var db = services.GetRequiredService<PoliValkoDbContext>();
            var rows = await SeasonClassifier.QueryAsync(db.Set<Product>().Where(p => p.Id == first.Id || p.Id == second.Id), [shelf], db,
                services.GetRequiredService<IMemoryCache>(), today, today, Ct);
            return await rows.ToListAsync(Ct);
        });
        seasons.Select(row => (SeasonClassifier.Name(row.State), SeasonClassifier.Source(row)))
            .ShouldBe([("all_year", "none"), ("all_year", "none")]);
    }

    [Fact]
    public async Task A_rule_alone_puts_a_product_first_where_nothing_has_been_sold_yet()
    {
        // A rule in force names one product; there are no receipts, no orders and no verdict for any section.
        var today = new DateOnly(2071, 12, 10);
        var heaters = await api.AddCategoryAsync(name: "Обігрівачі");
        var shelf = await api.AddCategoryAsync();
        var plain = await api.AddProductAsync(shelf.Slug, "Абажур", 100);
        var heater = await api.AddProductAsync(heaters.Slug, "Обігрівач", 100);

        foreach (var mode in new[] { ProductSort.Seasonal, ProductSort.StockCover })
            (await RankAsync([plain, heater], [heaters, shelf], today, mode)).ShouldBe([heater.Id, plain.Id], mode);
    }

    private Task<Guid[]> RankAsync(Product[] products, Category[] categories, DateOnly today, string mode,
        bool acrossCategories = true, string? term = null, Guid[]? pinned = null) => api.WithScopeAsync(async services =>
    {
        var db = services.GetRequiredService<PoliValkoDbContext>();
        var ids = products.Select(p => p.Id).ToArray();
        var ranked = await services.GetRequiredService<SeasonalMerchandising>().SortAsync(
            db.Set<Product>().Where(p => ids.Contains(p.Id)), categories, term, db, today, Ct, mode, acrossCategories, pinned);
        return await ranked.Select(p => p.Id).ToArrayAsync(Ct);
    });
}
