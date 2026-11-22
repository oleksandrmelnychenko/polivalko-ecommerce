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
    public async Task Seasonal_leaders_rotate_available_families_before_pagination_and_fill_empty_slots()
    {
        var irrigation = new List<Product>();
        for (var i = 0; i < 14; i++)
            irrigation.Add(await api.AddProductAsync("vse-dlia-polyvu", $"A{i:D2}", 100));
        var garden = await api.AddProductAsync("vse-dlia-vidpochynku", "Z1", 100);
        var nextGarden = await api.AddProductAsync("vse-dlia-vidpochynku", "Z2", 100);
        var unavailable = await api.AddProductAsync("vse-dlia-vidpochynku", "A", 100, stock: 0);
        var other = await api.AddProductAsync("novyi-rik", "0", 100);
        var ids = irrigation.Select(p => p.Id).Concat([garden.Id, nextGarden.Id, unavailable.Id, other.Id]).ToArray();
        await api.WithScopeAsync(async services =>
        {
            var db = services.GetRequiredService<PoliValkoDbContext>();
            var products = db.Set<Product>().Where(p => ids.Contains(p.Id));
            var merchandising = services.GetRequiredService<SeasonalMerchandising>();
            var categories = await CategoryQueries.LoadVisibleCategoriesAsync(db, Ct);
            var day = new DateOnly(2032, 7, 14);
            var ranked = await merchandising.SortAsync(products, categories, null, db, day, Ct);
            Guid[] expected = [irrigation[0].Id, garden.Id, irrigation[1].Id, nextGarden.Id,
                .. irrigation.Skip(2).Select(p => p.Id), other.Id, unavailable.Id];
            (await ranked.Take(12).Select(p => p.Id).ToArrayAsync(Ct)).ShouldBe(expected[..12]);
            (await ranked.Skip(12).Select(p => p.Id).ToArrayAsync(Ct)).ShouldBe(expected[12..]);
            var exact = await merchandising.SortAsync(products, categories, unavailable.Sku, db, day, Ct);
            (await exact.Select(p => p.Id).FirstAsync(Ct)).ShouldBe(unavailable.Id);
            return true;
        });
    }

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
    public async Task Manual_selection_leads_the_default_catalog_in_preview_order_without_duplicates()
    {
        using var shop = api.CreateClient();
        using var manager = await Staff.ManagerAsync(api);
        var first = await api.AddProductAsync("novyi-rik", "Вітрина Z", 500);
        var second = await api.AddProductAsync("novyi-rik", "Вітрина A", 10);
        var original = await manager.ReadAsync<StorefrontModeDto>(Editor);
        Guid[] ids = [first.Id, second.Id];
        var change = new ChangeStorefrontMode("seasonal", null, original.Revision, ids);
        var preview = await manager.ReadAsync<List<ProductListItemDto>>(
            $"{Editor}/preview?mode=seasonal&pinned={first.Id}&pinned={second.Id}");
        preview.Take(2).Select(p => p.Id).ShouldBe(ids);
        (await manager.PutJsonAsync(Editor, change with { PinnedProductIds = [first.Id, first.Id] })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var edited = await (await manager.PutJsonAsync(Editor, change)).ReadAsync<StorefrontModeDto>();
        try
        {
            edited.PinnedProductIds.ShouldBe(ids);
            var page = await shop.ReadAsync<ProductSearchResponse>("/api/v1/products?pageSize=12");
            page.Items.Select(p => p.Id).ShouldBe(preview.Select(p => p.Id));
            page.Items.Select(p => p.Id).Distinct().Count().ShouldBe(page.Items.Count);
            var next = await shop.ReadAsync<ProductSearchResponse>("/api/v1/products?page=2&pageSize=1");
            next.Items.Single().Id.ShouldBe(second.Id);
            var search = await shop.ReadAsync<ProductSearchResponse>("/api/v1/products?q=" + second.Sku);
            search.Items.First().Id.ShouldBe(second.Id);
        }
        finally
        {
            (await manager.PutJsonAsync(Editor, new ChangeStorefrontMode(original.Mode, original.Through, edited.Revision,
                original.PinnedProductIds ?? []))).StatusCode.ShouldBe(HttpStatusCode.OK);
        }
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
