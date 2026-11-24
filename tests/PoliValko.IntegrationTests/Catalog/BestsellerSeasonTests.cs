using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Storefront;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.IntegrationTests;

// The home page's «Топ продажів» and the banner's product: the most ordered products, without those a rule keeps for
// other months. Hidden sections and days of their own, as in the other season tests.
public sealed class BestsellerSeasonTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task A_product_a_rule_keeps_for_other_months_leaves_the_top_while_the_rest_keep_the_order_of_their_orders()
    {
        var newYear = await api.AddCategoryAsync(name: "novyi-rik");
        var heaters = await api.AddCategoryAsync(name: "Обігрівачі");
        var shelf = await api.AddCategoryAsync();
        Category[] categories = [newYear, heaters, shelf];
        var garland = await api.AddProductAsync(newYear.Slug, "Гірлянда", 100);
        var heater = await api.AddProductAsync(heaters.Slug, "Обігрівач", 100);
        var sold = await api.AddProductAsync(shelf.Slug, "Товар без залишку", 100, stock: 0);
        // Off season by its own receipts alone, bought in September only: no rule speaks about it.
        var autumn = await api.AddSoldProductAsync(shelf, "Товар осені");
        await api.AddReceiptsAsync(autumn, new DateOnly(2083, 9, 1), 60);
        await api.AddReceiptsAsync(autumn, new DateOnly(2084, 9, 1), 60);
        // The rule keeps it for other months too, but its own receipts say January sells: they win.
        var lit = await api.AddSoldProductAsync(newYear, "Гірлянда, яку беруть і в січні");
        await api.AddReceiptsAsync(lit, new DateOnly(2085, 1, 15), 6);
        await api.AddReceiptsAsync(lit, new DateOnly(2084, 6, 1), 2);
        ProductSalesCount[] top = [new(sold.Id, 20, 20), new(garland.Id, 9, 9), new(autumn.Id, 7, 7), new(lit.Id, 5, 5), new(heater.Id, 3, 3)];
        var december = new DateOnly(2085, 12, 10);
        var january = new DateOnly(2086, 1, 10);

        // In December the garland is what people order; what cannot be bought is never shown.
        (await PickAsync(top, 12, categories, december)).ShouldBe([garland.Id, autumn.Id, lit.Id, heater.Id]);
        // From January its rule speaks of other months: it leaves, and the next one takes its place, also for the banner.
        (await PickAsync(top, 12, categories, january)).ShouldBe([autumn.Id, lit.Id, heater.Id]);
        (await PickAsync(top, 1, categories, january)).ShouldBe([autumn.Id]);
        (await PickAsync(top, 2, categories, january)).ShouldBe([autumn.Id, lit.Id]);
        // What only its receipts put out of season stays, in the order of orders: it is still ordered on the site.
        (await StateAsync(autumn, categories, january)).ShouldBe((int)Season.Off);
        (await StateAsync(lit, categories, january)).ShouldBe((int)Season.In);
        // Its section sells in January through it, so the garland reads as all year there: the rule still keeps it out.
        (await StateAsync(garland, categories, january)).ShouldBe((int)Season.AllYear);
    }

    [Fact]
    public async Task The_public_answer_keeps_its_shape()
    {
        var response = await api.CreateClient().GetAsync("/api/v1/bestsellers?take=5", Ct);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
        body.GetProperty("periodDays").GetInt32().ShouldBe(90);
        body.GetProperty("items").GetArrayLength().ShouldBeLessThanOrEqualTo(5);
    }

    private Task<Guid[]> PickAsync(ProductSalesCount[] top, int count, Category[] categories, DateOnly today) =>
        api.WithScopeAsync(async services =>
        {
            var db = services.GetRequiredService<PoliValkoDbContext>();
            var ids = top.Select(t => t.ProductId).ToArray();
            var purchasable = db.Set<Product>().AsNoTracking().Where(p => ids.Contains(p.Id)).Where(ProductListing.Purchasable);
            var items = await GetBestsellers.PickAsync(top, count, purchasable, categories, db,
                services.GetRequiredService<IMemoryCache>(), TimeProvider.System, today, Ct);
            return items.Select(item => item.Product.Id).ToArray();
        });

    private Task<int> StateAsync(Product product, Category[] categories, DateOnly today) => api.WithScopeAsync(async services =>
    {
        var db = services.GetRequiredService<PoliValkoDbContext>();
        var rows = await SeasonClassifier.QueryAsync(db.Set<Product>().Where(p => p.Id == product.Id), categories, db,
            services.GetRequiredService<IMemoryCache>(), today, today, Ct);
        return await rows.Select(row => row.State).SingleAsync(Ct);
    });
}
