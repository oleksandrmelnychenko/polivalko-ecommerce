using System.Net;
using System.Net.Http.Json;
using PoliValko.Catalog;
using PoliValko.Catalog.Features.Console.Brands;
using PoliValko.Catalog.Features.Console.Products;

namespace PoliValko.IntegrationTests;

public sealed class ConsoleBrandApiTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Brands_are_created_renamed_and_protected_while_in_use()
    {
        var admin = await Staff.AdminAsync(api);
        var name = CatalogDictionaries.Unique("Флора Плюс");
        var brand = await (await admin.PostAsJsonAsync(
                CatalogDictionaries.Brands,
                new SaveBrandRequest($" {name} ", null, "Добрива й ґрунти", "/api/media/content/2026/11/logo.png"),
                TestJson.Options,
                Ct))
            .ReadAsync<BrandDto>(HttpStatusCode.Created);
        brand.Name.ShouldBe(name);
        brand.Slug.ShouldStartWith("flora-plius-");
        brand.LogoUrl.ShouldBe("/api/media/content/2026/11/logo.png");
        brand.ProductCount.ShouldBe(0);

        foreach (var (request, field) in new[]
                 {
                     (new SaveBrandRequest(name.ToUpperInvariant(), null, null, null), "name"),
                     (new SaveBrandRequest(CatalogDictionaries.Unique("Інший"), brand.Slug, null, null), "slug"),
                     (new SaveBrandRequest(CatalogDictionaries.Unique("Інший"), "Не Slug", null, null), "slug"),
                     (new SaveBrandRequest(CatalogDictionaries.Unique("Інший"), null, null, "javascript:alert(1)"), "logoUrl"),
                 })
        {
            var invalid = await admin.PostAsJsonAsync(CatalogDictionaries.Brands, request, TestJson.Options, Ct);
            invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            (await invalid.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.ShouldContainKey(field);
        }

        var first = await api.AddProductAsync("vse-dlia-roslyn", "Добриво бренду", 150m, brand: name);
        var second = await api.AddProductAsync("vse-dlia-roslyn", "Ґрунт бренду", 90m, brand: name.ToUpperInvariant());
        (await admin.ReadAsync<List<BrandDto>>(CatalogDictionaries.Brands)).Single(b => b.Id == brand.Id).ProductCount.ShouldBe(2);

        var inUse = await admin.DeleteAsync($"{CatalogDictionaries.Brands}/{brand.Id}", Ct);
        inUse.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var conflict = (await inUse.Content.ReadFromJsonAsync<Dictionary<string, object>>(Ct))!;
        conflict["code"].ToString().ShouldBe("brands.in_use");
        conflict["productCount"].ToString().ShouldBe("2");

        var newName = CatalogDictionaries.Unique("Флора");
        var renamed = await (await admin.PutAsJsonAsync(
                $"{CatalogDictionaries.Brands}/{brand.Id}",
                new SaveBrandRequest(newName, null, null, null),
                TestJson.Options,
                Ct))
            .ReadAsync<BrandDto>();
        renamed.Name.ShouldBe(newName);
        renamed.Slug.ShouldBe(brand.Slug);
        renamed.ProductCount.ShouldBe(2);
        (await admin.ReadAsync<ConsoleProductDto>($"/api/v1/console/catalog/products/{first.Id}")).Brand.ShouldBe(newName);
        (await admin.ReadAsync<ConsoleProductDto>($"/api/v1/console/catalog/products/{second.Id}")).Brand.ShouldBe(newName);

        var filtered = await admin.ReadAsync<PoliValko.SharedKernel.PagedResponse<ConsoleProductListItemDto>>(
            $"/api/v1/console/catalog/products?brand={Uri.EscapeDataString(newName.ToLowerInvariant())}");
        filtered.Items.Select(i => i.Id).ShouldBe([first.Id, second.Id], ignoreOrder: true);
    }

    [Fact]
    public async Task Merge_moves_products_and_removes_the_source()
    {
        var admin = await Staff.AdminAsync(api);
        var source = await CatalogDictionaries.CreateBrandAsync(admin, CatalogDictionaries.Unique("Gardena Old"));
        var target = await CatalogDictionaries.CreateBrandAsync(admin, CatalogDictionaries.Unique("Gardena"));
        var product = await api.AddProductAsync("vse-dlia-polyvu", "Конектор для об'єднання", 75m, brand: source.Name);
        await api.AddProductAsync("vse-dlia-polyvu", "Пістолет цільового бренду", 175m, brand: target.Name);

        var self = await admin.PostAsJsonAsync($"{CatalogDictionaries.Brands}/{source.Id}/merge", new MergeBrandRequest(source.Id), TestJson.Options, Ct);
        self.StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        var merged = await (await admin.PostAsJsonAsync($"{CatalogDictionaries.Brands}/{source.Id}/merge", new MergeBrandRequest(target.Id), TestJson.Options, Ct))
            .ReadAsync<BrandDto>();
        merged.Id.ShouldBe(target.Id);
        merged.ProductCount.ShouldBe(2);
        (await admin.ReadAsync<ConsoleProductDto>($"/api/v1/console/catalog/products/{product.Id}")).Brand.ShouldBe(target.Name);
        (await admin.ReadAsync<List<BrandDto>>(CatalogDictionaries.Brands)).ShouldNotContain(b => b.Id == source.Id);
        (await admin.PostAsJsonAsync($"{CatalogDictionaries.Brands}/{source.Id}/merge", new MergeBrandRequest(target.Id), TestJson.Options, Ct))
            .StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Product_brand_must_come_from_the_dictionary()
    {
        var admin = await Staff.AdminAsync(api);
        var brand = await CatalogDictionaries.CreateBrandAsync(admin);
        var legacy = CatalogDictionaries.Unique("Старий бренд");
        var product = await api.AddProductAsync("hospodarchi-tovary", "Відро з брендом", 120m, brand: legacy);

        var unknown = await Update(admin, product.Id, CatalogDictionaries.Unique("Невідомий"));
        unknown.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await unknown.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.ShouldContainKey("brand");

        (await (await Update(admin, product.Id, legacy)).ReadAsync<ConsoleProductDto>()).Brand.ShouldBe(legacy);
        (await (await Update(admin, product.Id, brand.Name.ToLowerInvariant())).ReadAsync<ConsoleProductDto>()).Brand.ShouldBe(brand.Name);
        (await (await Update(admin, product.Id, "  ")).ReadAsync<ConsoleProductDto>()).Brand.ShouldBeNull();
    }

    [Fact]
    public async Task Sync_creates_brands_from_products_and_manager_only_reads()
    {
        var name = CatalogDictionaries.Unique("Навколо Бренд");
        await api.AddProductAsync("ruchnyi-instrument", "Товар з новим брендом", 60m, brand: name);
        await api.WithScopeAsync(async services =>
        {
            await CatalogModule.SyncDictionariesAsync(services, Ct);
            return true;
        });

        var manager = await Staff.ManagerAsync(api);
        var brands = await manager.ReadAsync<List<BrandDto>>(CatalogDictionaries.Brands);
        brands.Single(b => b.Name == name).ProductCount.ShouldBe(1);

        var denied = await manager.PostAsJsonAsync(CatalogDictionaries.Brands, new SaveBrandRequest(CatalogDictionaries.Unique("Менеджер"), null, null, null), TestJson.Options, Ct);
        denied.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        var id = brands.Single(b => b.Name == name).Id;
        (await manager.DeleteAsync($"{CatalogDictionaries.Brands}/{id}", Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    private static Task<HttpResponseMessage> Update(HttpClient admin, Guid productId, string? brand) =>
        admin.PutAsJsonAsync(
            $"/api/v1/console/catalog/products/{productId}",
            new UpdateProductRequest(null, null, null, brand, null, true, null, null, null),
            TestJson.Options,
            Ct);
}
