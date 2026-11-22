using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Storefront;
using PoliValko.Infrastructure.Persistence;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class StorefrontModeTests(ApiFactory api)
{
    private const string Editor = "/api/v1/console/catalog/storefront-mode";
    private const string Public = "/api/v1/catalog/storefront-mode";
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Recent_demand_and_stock_cover_prioritize_different_products()
    {
        var recent = await api.AddProductAsync("vse-dlia-polyvu", "Популярний шланг", 50, stock: 3);
        var surplus = await api.AddProductAsync("vse-dlia-polyvu", "Шланг із запасом", 50, stock: 20);
        var latest = await TestOrders.PlaceAsync(api, recent.Id, 2, 50, CheckoutApiTests.UniquePhone());
        var older = await TestOrders.PlaceAsync(api, surplus.Id, 2, 50, CheckoutApiTests.UniquePhone());
        var day = new DateOnly(2033, 7, 12);
        await api.WithScopeAsync(async services =>
        {
            var db = services.GetRequiredService<PoliValkoDbContext>();
            await db.Database.ExecuteSqlAsync($"UPDATE ordering.orders SET status='Confirmed', created_at={KyivTime.StartOfDay(day)} WHERE number={latest.Number}", Ct);
            await db.Database.ExecuteSqlAsync($"UPDATE ordering.orders SET status='Confirmed', created_at={KyivTime.StartOfDay(day.AddDays(-10))} WHERE number={older.Number}", Ct);
            var merchandising = services.GetRequiredService<SeasonalMerchandising>();
            var products = db.Set<Product>().Where(p => p.Id == recent.Id || p.Id == surplus.Id);
            var categories = await CategoryQueries.LoadVisibleCategoriesAsync(db, Ct);
            var trending = await merchandising.SortAsync(products, categories, null, db, day, Ct, "trending");
            (await trending.Select(p => p.Id).ToArrayAsync(Ct)).ShouldBe([recent.Id, surplus.Id]);
            var cover = await merchandising.SortAsync(products, categories, null, db, day, Ct, "stock_cover");
            (await cover.Select(p => p.Id).ToArrayAsync(Ct)).ShouldBe([surplus.Id, recent.Id]);
            return true;
        });
    }

    [Fact]
    public async Task Preview_does_not_publish_and_activation_is_versioned_and_expires_after_the_Kyiv_day()
    {
        using var shop = api.CreateClient();
        using var manager = await Staff.ManagerAsync(api);
        var today = KyivTime.Today(TimeProvider.System);
        var original = await shop.ReadAsync<StorefrontModeDto>(Public);
        (await shop.GetAsync(Editor + "/preview?mode=trending", Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        foreach (var mode in new[] { "seasonal", "trending", "stock_cover" })
        {
            var preview = await manager.ReadAsync<List<ProductListItemDto>>(Editor + "/preview?mode=" + mode);
            var page = await shop.ReadAsync<ProductSearchResponse>("/api/v1/products?pageSize=12&sort=" + mode);
            preview.Select(p => p.Id).ShouldBe(page.Items.Select(p => p.Id));
        }
        (await shop.ReadAsync<StorefrontModeDto>(Public)).ShouldBe(original);
        var change = new ChangeStorefrontMode("stock_cover", today, original.Revision);
        (await manager.PutJsonAsync(Editor, change with { Through = today.AddDays(-1) })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var edited = await (await manager.PutJsonAsync(Editor, change)).ReadAsync<StorefrontModeDto>();
        try
        {
            (await shop.ReadAsync<StorefrontModeDto>(Public)).ShouldBe(edited);
            (await manager.PutJsonAsync(Editor, change)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
            var actual = await shop.ReadAsync<ProductSearchResponse>("/api/v1/products?pageSize=12");
            var preview = await manager.ReadAsync<List<ProductListItemDto>>(Editor + "/preview?mode=stock_cover");
            actual.Items.Select(p => p.Id).ShouldBe(preview.Select(p => p.Id));
            var expired = await api.WithDbAsync(db => StorefrontMode.CurrentAsync(db, today.AddDays(1), Ct));
            expired.ShouldBe(new StorefrontModeDto("seasonal", null, edited.Revision));
        }
        finally
        {
            (await manager.PutJsonAsync(Editor, new ChangeStorefrontMode(original.Mode, original.Through, edited.Revision)))
                .StatusCode.ShouldBe(HttpStatusCode.OK);
        }
    }
}
