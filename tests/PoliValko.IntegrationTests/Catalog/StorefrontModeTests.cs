using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Storefront;
using PoliValko.Catalog.Persistence;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Settings;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class StorefrontModeTests(ApiFactory api)
{
    private const string Editor = "/api/v1/console/catalog/storefront-mode";
    private const string Public = "/api/v1/catalog/storefront-mode";
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Monthly_preview_changes_the_season_and_preserves_the_live_mode_and_pin_order()
    {
        using var shop = api.CreateClient();
        using var manager = await Staff.ManagerAsync(api);
        var before = await shop.ReadAsync<StorefrontModeDto>(Public);
        var today = KyivTime.Today(TimeProvider.System);
        var pin = await api.AddProductAsync("novyi-rik", "Закріплений для перегляду місяця", 50);
        await api.AddProductAsync("novyi-rik", "Ялинка для перегляду місяця", 100);
        await api.AddProductAsync("vse-dlia-vidpochynku", "Гамак для перегляду місяця", 100);
        var url = $"{Editor}/preview?mode=seasonal&pinned={pin.Id}";
        var livePreview = await PreviewAsync(manager, url);
        var current = await PreviewAsync(manager, url + "&month=" + today.Month);
        current.ShouldBe(livePreview);
        var july = await PreviewAsync(manager, url + "&month=7");
        var december = await PreviewAsync(manager, url + "&month=12");
        july[0].ShouldBe(pin.Id);
        december[0].ShouldBe(pin.Id);
        july.SequenceEqual(december).ShouldBeFalse();
        (await manager.GetAsync(url + "&month=0", Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await manager.GetAsync(url + "&month=13", Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await manager.GetAsync(Editor + "/preview?mode=trending&month=7", Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await shop.GetAsync(url + "&month=7", Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await shop.ReadAsync<StorefrontModeDto>(Public)).Revision.ShouldBe(before.Revision);
    }

    [Fact]
    public async Task Monthly_leaders_balance_sales_across_December_January_and_the_summer_boundaries()
    {
        var heaterCategory = new Category { Id = Guid.NewGuid(), Slug = "winter-" + Guid.NewGuid(), Name = "Обігрівачі" };
        await api.WithDbAsync(db => { db.Add(heaterCategory); return db.SaveChangesAsync(Ct); });
        var heater = await api.AddProductAsync(heaterCategory.Slug, "Обігрівач", 100);
        var convector = await api.AddProductAsync(heaterCategory.Slug, "Конвектор", 100);
        var hose = await api.AddProductAsync("vse-dlia-polyvu", "Шланг", 100);
        var sprayer = await api.AddProductAsync("vse-dlia-polyvu", "Дощувач", 100);
        var ids = new[] { heater.Id, convector.Id, hose.Id, sprayer.Id };
        await api.WithScopeAsync(async services =>
        {
            var db = services.GetRequiredService<PoliValkoDbContext>();
            foreach (var id in ids)
                await db.Set<Product>().Where(p => p.Id == id)
                    .ExecuteUpdateAsync(s => s.SetProperty(p => p.NavkoloId, "dntrade-code:" + id.ToString()), Ct);
            foreach (var (id, month, receipts) in new[] {
                (heater.Id, 12, 6), (convector.Id, 12, 5), (heater.Id, 1, 10), (convector.Id, 1, 2),
                (hose.Id, 4, 4), (sprayer.Id, 4, 2), (hose.Id, 5, 3), (sprayer.Id, 6, 2),
                (hose.Id, 7, 3), (hose.Id, 8, 5), (sprayer.Id, 8, 2) })
            {
                await db.Database.ExecuteSqlAsync($"""
                    INSERT INTO accounting.documents(id,source_account,source_id,entity_type,kind,day,status,store_ids,total,details)
                    SELECT gen_random_uuid(),'valko-dntrade',gen_random_uuid()::text,'receipt','cash',
                        make_date(2038,{month},1),'active',ARRAY[]::text[],100,
                        jsonb_build_object('products',jsonb_build_array(jsonb_build_object('product',
                            jsonb_build_object('code',{id.ToString()}),'quantity',1))) FROM generate_series(1,{receipts})
                    """, Ct);
            }
            var categories = await CategoryQueries.LoadVisibleCategoriesAsync(db, Ct);
            var merchandising = services.GetRequiredService<SeasonalMerchandising>();
            foreach (var (month, expected) in new[] { (1, heater.Id), (12, convector.Id), (8, sprayer.Id),
                         (4, sprayer.Id), (5, hose.Id), (7, hose.Id) })
            {
                var ranked = await merchandising.SortAsync(db.Set<Product>().Where(p => ids.Contains(p.Id)), categories,
                    null, db, new DateOnly(2039, 1, 1), Ct, seasonDate: new DateOnly(2039, month, 15));
                (await ranked.Select(p => p.Id).FirstAsync(Ct)).ShouldBe(expected);
            }
            return true;
        });
        // Do not leave an extra visible root in the shared fixture.
        await api.WithDbAsync(db => db.Set<Category>().Where(c => c.Id == heaterCategory.Id)
            .ExecuteUpdateAsync(set => set.SetProperty(c => c.IsVisible, false), Ct));
    }

    [Fact]
    public async Task Summer_leaders_use_distinct_monthly_receipts_and_rotate_available_seasonal_products()
    {
        var hose = await api.AddProductAsync("vse-dlia-polyvu", "Садовий шланг", 120);
        var grill = await api.AddProductAsync("vse-dlia-vidpochynku", "Мангал", 100);
        var hammock = await api.AddProductAsync("vse-dlia-vidpochynku", "Гамак", 110);
        var soldOut = await api.AddProductAsync("vse-dlia-polyvu", "Дощувач", 110, stock: 0);
        var offSeason = await api.AddProductAsync("novyi-rik", "Ялинка", 110);
        Product[] items = [hose, grill, hammock, soldOut, offSeason];
        var ids = items.Select(p => p.Id).ToArray();
        await api.WithScopeAsync(async services =>
        {
            var db = services.GetRequiredService<PoliValkoDbContext>();
            foreach (var item in items)
            {
                var code = item.Id.ToString();
                await db.Set<Product>().Where(p => p.Id == item.Id)
                    .ExecuteUpdateAsync(s => s.SetProperty(p => p.NavkoloId, "dntrade-code:" + code), Ct);
                // Repeated lines and bulk quantities in a single receipt count as one purchase.
                var lineCount = item.Id == hammock.Id ? 6 : 1;
                var receipts = item.Id == hose.Id ? 4 : item.Id == grill.Id ? 3 : item.Id == hammock.Id ? 1 : 8;
                await db.Database.ExecuteSqlAsync($"""
                    INSERT INTO accounting.documents(id,source_account,source_id,entity_type,kind,day,status,store_ids,total,details)
                    SELECT gen_random_uuid(),'valko-dntrade',gen_random_uuid()::text,'receipt','cash',
                        make_date(2036,m,1),'active',ARRAY[]::text[],100,jsonb_build_object('products',
                            (SELECT jsonb_agg(jsonb_build_object('product',jsonb_build_object('code',{code}),'quantity',50))
                             FROM generate_series(1,{lineCount})))
                    FROM generate_series(5,7) m CROSS JOIN generate_series(1,{receipts})
                    """, Ct);
            }
            var merchandising = services.GetRequiredService<SeasonalMerchandising>();
            var categories = await CategoryQueries.LoadVisibleCategoriesAsync(db, Ct);
            foreach (var (month, expected) in new[] { (7, hammock.Id), (5, hose.Id), (6, grill.Id) })
            {
                var ranked = await merchandising.SortAsync(db.Set<Product>().Where(p => ids.Contains(p.Id)), categories,
                    null, db, new DateOnly(2036, 11, 15), Ct, seasonDate: new DateOnly(2037, month, 15));
                (await ranked.Select(p => p.Id).FirstAsync(Ct)).ShouldBe(expected);
            }
            return true;
        });
    }

    [Fact]
    public async Task Seasonal_leaders_rotate_available_families_before_pagination_and_fill_empty_slots()
    {
        var irrigation = new List<Product>();
        for (var i = 0; i < 14; i++)
            irrigation.Add(await api.AddProductAsync("vse-dlia-polyvu", $"A{i:D2} Шланг", 100));
        var garden = await api.AddProductAsync("vse-dlia-vidpochynku", "Z1 Гамак", 100);
        var nextGarden = await api.AddProductAsync("vse-dlia-vidpochynku", "Z2 Гамак", 100);
        var unavailable = await api.AddProductAsync("vse-dlia-vidpochynku", "A Гамак", 100, stock: 0);
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
    public async Task Purchases_and_stock_cover_put_different_products_first()
    {
        // Both are hoses in July, so both are in season; by name the one with the large stock would come first.
        var popular = await api.AddProductAsync("vse-dlia-polyvu", "Шланг ходовий", 50, stock: 5);
        var surplus = await api.AddProductAsync("vse-dlia-polyvu", "Шланг із запасом", 50, stock: 20);
        var latest = await TestOrders.PlaceAsync(api, popular.Id, 1, 50, CheckoutApiTests.UniquePhone());
        var earlier = await TestOrders.PlaceAsync(api, popular.Id, 1, 50, CheckoutApiTests.UniquePhone());
        var older = await TestOrders.PlaceAsync(api, surplus.Id, 2, 50, CheckoutApiTests.UniquePhone());
        var day = new DateOnly(2033, 7, 12);
        await api.WithScopeAsync(async services =>
        {
            var db = services.GetRequiredService<PoliValkoDbContext>();
            await db.Database.ExecuteSqlAsync($"UPDATE ordering.orders SET status='Confirmed', created_at={KyivTime.StartOfDay(day)} WHERE number={latest.Number}", Ct);
            await db.Database.ExecuteSqlAsync($"UPDATE ordering.orders SET status='Confirmed', created_at={KyivTime.StartOfDay(day.AddDays(-3))} WHERE number={earlier.Number}", Ct);
            await db.Database.ExecuteSqlAsync($"UPDATE ordering.orders SET status='Confirmed', created_at={KyivTime.StartOfDay(day.AddDays(-10))} WHERE number={older.Number}", Ct);
            var merchandising = services.GetRequiredService<SeasonalMerchandising>();
            var products = db.Set<Product>().Where(p => p.Id == popular.Id || p.Id == surplus.Id);
            var categories = await CategoryQueries.LoadVisibleCategoriesAsync(db, Ct);
            // Two orders against one.
            var seasonal = await merchandising.SortAsync(products, categories, null, db, day, Ct, "seasonal");
            (await seasonal.Select(p => p.Id).ToArrayAsync(Ct)).ShouldBe([popular.Id, surplus.Id]);
            // Two units sold in four weeks from a stock of twenty against two from five.
            var cover = await merchandising.SortAsync(products, categories, null, db, day, Ct, "stock_cover");
            (await cover.Select(p => p.Id).ToArrayAsync(Ct)).ShouldBe([surplus.Id, popular.Id]);
            return true;
        });
    }

    [Fact]
    public async Task A_photo_ranks_a_product_above_stock_cover_among_what_can_be_bought()
    {
        // An old product with stock to spare and no sales covers the longest, so by cover alone it would lead.
        var noPhoto = await api.AddProductAsync("vse-dlia-polyvu", "Шланг без фото", 50, stock: 20, createdAt: DateTimeOffset.UtcNow.AddDays(-90));
        var withPhoto = await api.AddProductAsync("vse-dlia-polyvu", "Шланг із фото", 50, stock: 1);
        var soldOutWithPhoto = await api.AddProductAsync("vse-dlia-polyvu", "Шланг розпроданий із фото", 50, stock: 0);
        await api.WithDbAsync(async db =>
        {
            foreach (var product in new[] { withPhoto, soldOutWithPhoto })
            {
                db.Add(new ProductImage { Id = Guid.CreateVersion7(), ProductId = product.Id, Url = $"https://example.test/{product.Slug}.jpg", Alt = "Шланг" });
            }

            return await db.SaveChangesAsync(Ct);
        });
        // A day no other test uses: recent purchases are cached per day, and a shared day would hand one test's
        // sales picture to another.
        var day = new DateOnly(2087, 7, 12);
        await api.WithScopeAsync(async services =>
        {
            var db = services.GetRequiredService<PoliValkoDbContext>();
            var merchandising = services.GetRequiredService<SeasonalMerchandising>();
            var products = db.Set<Product>().Where(p => p.Id == noPhoto.Id || p.Id == withPhoto.Id || p.Id == soldOutWithPhoto.Id);
            var categories = await CategoryQueries.LoadVisibleCategoriesAsync(db, Ct);
            var cover = await merchandising.SortAsync(products, categories, null, db, day, Ct, "stock_cover");
            // What can be bought still comes first; among it, the product a visitor can see.
            (await cover.Select(p => p.Id).ToArrayAsync(Ct)).ShouldBe([withPhoto.Id, noPhoto.Id, soldOutWithPhoto.Id]);
            return true;
        });
    }

    [Fact]
    public async Task There_are_two_modes_and_a_saved_trending_mode_reads_as_seasonal()
    {
        using var shop = api.CreateClient();
        using var manager = await Staff.ManagerAsync(api);
        (await shop.GetAsync("/api/v1/products?sort=trending", Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await manager.GetAsync(Editor + "/preview?mode=trending", Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        // Another month can be looked at in either mode.
        (await manager.GetAsync(Editor + "/preview?mode=stock_cover&month=7", Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var original = await manager.ReadAsync<StorefrontModeDto>(Editor);
        (await manager.PutJsonAsync(Editor, new ChangeStorefrontMode("trending", null, original.Revision))).StatusCode
            .ShouldBe(HttpStatusCode.BadRequest);
        // A setting saved while the third mode still existed.
        var retired = new StorefrontModeDto("trending", KyivTime.Today(TimeProvider.System).AddDays(3), Guid.NewGuid());
        Task SaveAsync(StorefrontModeDto setting) => api.WithScopeAsync(async services =>
        {
            await services.GetRequiredService<ISettingsStore>().SaveAsync("catalog.storefront_mode", setting, "test", Ct);
            return true;
        });
        await SaveAsync(retired);
        try
        {
            (await shop.ReadAsync<StorefrontModeDto>(Public)).ShouldBe(new StorefrontModeDto("seasonal", null, retired.Revision));
            var listed = await shop.ReadAsync<ProductSearchResponse>("/api/v1/products?pageSize=12");
            var seasonal = await shop.ReadAsync<ProductSearchResponse>("/api/v1/products?pageSize=12&sort=seasonal");
            listed.Items.Select(p => p.Id).ShouldBe(seasonal.Items.Select(p => p.Id));
        }
        finally { await SaveAsync(original); }
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
        var preview = await PreviewAsync(manager, $"{Editor}/preview?mode=seasonal&pinned={first.Id}&pinned={second.Id}");
        preview.Take(2).ShouldBe(ids);
        (await manager.PutJsonAsync(Editor, change with { PinnedProductIds = [first.Id, first.Id] })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var edited = await (await manager.PutJsonAsync(Editor, change)).ReadAsync<StorefrontModeDto>();
        try
        {
            edited.PinnedProductIds.ShouldBe(ids);
            var page = await shop.ReadAsync<ProductSearchResponse>("/api/v1/products?pageSize=48");
            page.Items.Select(p => p.Id).ShouldBe(preview);
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
        (await shop.GetAsync(Editor + "/preview?mode=stock_cover", Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        foreach (var mode in new[] { "seasonal", "stock_cover" })
        {
            var preview = await PreviewAsync(manager, Editor + "/preview?mode=" + mode);
            var page = await shop.ReadAsync<ProductSearchResponse>("/api/v1/products?pageSize=48&sort=" + mode);
            preview.ShouldBe(page.Items.Select(p => p.Id));
        }
        (await shop.ReadAsync<StorefrontModeDto>(Public)).ShouldBe(original);
        var change = new ChangeStorefrontMode("stock_cover", today, original.Revision);
        (await manager.PutJsonAsync(Editor, change with { Through = today.AddDays(-1) })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var edited = await (await manager.PutJsonAsync(Editor, change)).ReadAsync<StorefrontModeDto>();
        try
        {
            (await shop.ReadAsync<StorefrontModeDto>(Public)).ShouldBe(edited);
            (await manager.PutJsonAsync(Editor, change)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
            var actual = await shop.ReadAsync<ProductSearchResponse>("/api/v1/products?pageSize=48");
            var preview = await PreviewAsync(manager, Editor + "/preview?mode=stock_cover");
            actual.Items.Select(p => p.Id).ShouldBe(preview);
            var expired = await api.WithDbAsync(db => StorefrontMode.CurrentAsync(db, today.AddDays(1), Ct));
            expired.ShouldBe(new StorefrontModeDto("seasonal", null, edited.Revision));
        }
        finally
        {
            (await manager.PutJsonAsync(Editor, new ChangeStorefrontMode(original.Mode, original.Through, edited.Revision)))
                .StatusCode.ShouldBe(HttpStatusCode.OK);
        }
    }

    [Fact]
    public async Task Preview_tells_each_products_season_and_reason_counts_the_catalog_and_finds_a_product_by_name()
    {
        using var manager = await Staff.ManagerAsync(api);
        var token = Guid.NewGuid().ToString("N")[..10];
        // A department of its own: receipts that other tests leave in the shared ones cannot speak for its products.
        var pool = new Category { Id = Guid.NewGuid(), Slug = "preview-" + Guid.NewGuid(), Name = "Хімія для басейнів" };
        await api.WithDbAsync(db => { db.Add(pool); return db.SaveChangesAsync(Ct); });
        try
        {
            var garland = await api.AddProductAsync("novyi-rik", $"Гірлянда {token}", 100);
            var chlorine = await api.AddProductAsync(pool.Slug, $"Хлор у гранулах {token}", 100);
            var url = $"{Editor}/preview?mode=seasonal&q={token}";

            var december = await manager.ReadAsync<StorefrontPreviewDto>(url + "&month=12");

            var winter = december.Items.ToDictionary(item => item.Product.Id, item => (item.Season, item.Source));
            winter.Keys.Order().ShouldBe(new[] { garland.Id, chlorine.Id }.Order());
            winter[garland.Id].ShouldBe(("in_season", "rule"));
            winter[chlorine.Id].ShouldBe(("off_season", "rule"));
            var july = (await manager.ReadAsync<StorefrontPreviewDto>(url + "&month=7")).Items
                .ToDictionary(item => item.Product.Id, item => (item.Season, item.Source));
            july[chlorine.Id].ShouldBe(("in_season", "rule"));
            // A lookup tells the season of what it found. The counts belong to the catalog as a whole.
            december.Counts.ShouldBeNull();
            var whole = await manager.ReadAsync<StorefrontPreviewDto>($"{Editor}/preview?mode=seasonal&month=12");
            // Products, not listing cards: a listing shows a pack group as one card.
            var visible = await api.WithDbAsync(async db =>
            {
                var ids = (await CatalogVisibility.CategoriesAsync(db, Ct)).Select(c => c.Id).ToArray();
                return await CatalogVisibility.Products(db, ids).CountAsync(Ct);
            });
            var counts = whole.Counts.ShouldNotBeNull();
            (counts.InSeason + counts.AllYear + counts.OffSeason).ShouldBe(visible);
            counts.InSeason.ShouldBeGreaterThan(0);
            whole.MissingSections.ShouldNotBeNull();
            foreach (var unreadable in new[] { new string((char)1093, 129), "a%07b" })
                (await manager.GetAsync($"{Editor}/preview?mode=seasonal&q={unreadable}", Ct)).StatusCode
                    .ShouldBe(HttpStatusCode.BadRequest);
        }
        finally
        {
            // Do not leave an extra visible root in the shared fixture.
            await api.WithDbAsync(db => db.Set<Category>().Where(c => c.Id == pool.Id)
                .ExecuteUpdateAsync(set => set.SetProperty(c => c.IsVisible, false), Ct));
        }
    }

    private static async Task<Guid[]> PreviewAsync(HttpClient manager, string url) =>
        (await manager.ReadAsync<StorefrontPreviewDto>(url)).Items.Select(item => item.Product.Id).ToArray();
}
