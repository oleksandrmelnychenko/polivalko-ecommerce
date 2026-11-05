using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Console.Categories;
using PoliValko.Catalog.Features.Console.Products;
using PoliValko.Infrastructure.Audit;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class ConsoleProductFiltersApiTests(ApiFactory api)
{
    private const string Products = "/api/v1/console/catalog/products";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Fill_filters_find_products_missing_photo_description_or_attributes()
    {
        var admin = await Staff.AdminAsync(api);
        var product = await api.AddProductAsync("hospodarchi-tovary", "Совок для заповнення", 80m);

        foreach (var fill in new[] { "missing-photo", "missing-description", "missing-attributes", "any-missing" })
        {
            (await ListAsync(admin, $"q={product.Sku}&fill={fill}")).Items.ShouldHaveSingleItem().Id.ShouldBe(product.Id);
        }

        await (await admin.PutAsJsonAsync($"{Products}/{product.Id}", new UpdateProductRequest(
                null, null, null, null, "<p>Опис</p>", true, null, null, [new ProductAttributeDto("Матеріал", "Метал")]), TestJson.Options, Ct))
            .ReadAsync<ConsoleProductDto>();
        (await ListAsync(admin, $"q={product.Sku}&fill=missing-description")).Items.ShouldBeEmpty();
        (await ListAsync(admin, $"q={product.Sku}&fill=missing-attributes")).Items.ShouldBeEmpty();
        (await ListAsync(admin, $"q={product.Sku}&fill=any-missing")).Items.ShouldHaveSingleItem();

        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent([0xFF, 0xD8, 0xFF, 0xE0, .. new byte[32]]);
        file.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        form.Add(file, "file", "photo.jpg");
        (await admin.PostAsync($"{Products}/{product.Id}/images", form, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await ListAsync(admin, $"q={product.Sku}&fill=any-missing")).Items.ShouldBeEmpty();

        foreach (var (query, field) in new[] { ("fill=everything", "fill"), ("newDays=0", "newDays"), ($"labelId={Guid.NewGuid()}", "labelId"), ("stock=some", "stock") })
        {
            var invalid = await admin.GetAsync($"{Products}?{query}", Ct);
            invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            (await invalid.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.ShouldContainKey(field);
        }
    }

    [Fact]
    public async Task Counts_and_quick_filters_agree()
    {
        var manager = await Staff.ManagerAsync(api);
        var before = await manager.ReadAsync<ConsoleProductCountsDto>($"{Products}/counts");

        var marker = Guid.NewGuid().ToString("N")[..6];
        var hiddenWithStock = await api.AddProductAsync("novyi-rik", $"Гірлянда прихована {marker}", 300m, stock: 4, visible: false);
        var hiddenEmpty = await api.AddProductAsync("novyi-rik", $"Гірлянда без залишку {marker}", 300m, stock: 0, visible: false);
        var old = await api.AddProductAsync("novyi-rik", $"Гірлянда стара {marker}", 300m, createdAt: DateTimeOffset.UtcNow.AddDays(-120));

        var after = await manager.ReadAsync<ConsoleProductCountsDto>($"{Products}/counts");
        after.All.ShouldBe(before.All + 3);
        after.HiddenWithStock.ShouldBe(before.HiddenWithStock + 1);
        after.OutOfStock.ShouldBe(before.OutOfStock + 1);
        after.Recent30.ShouldBe(before.Recent30 + 2);
        after.NeedsFilling.ShouldBe(before.NeedsFilling + 3);

        (await ListAsync(manager, $"q={marker}&hiddenWithStock=true")).Items.ShouldHaveSingleItem().Id.ShouldBe(hiddenWithStock.Id);
        (await ListAsync(manager, $"q={marker}&newDays=30")).Items.Select(i => i.Id).ShouldBe([hiddenEmpty.Id, hiddenWithStock.Id], ignoreOrder: true);
        (await ListAsync(manager, $"q={marker}&newDays=365")).Items.Select(i => i.Id).ShouldContain(old.Id);
    }

    [Fact]
    public async Task Bulk_update_changes_category_brand_labels_and_visibility()
    {
        var admin = await Staff.AdminAsync(api);
        var manager = await Staff.ManagerAsync(api);
        var brand = await CatalogDictionaries.CreateBrandAsync(admin);
        var label = await CatalogDictionaries.CreateLabelAsync(manager);
        var target = (await admin.ReadAsync<List<ConsoleCategoryDto>>("/api/v1/console/catalog/categories")).Single(c => c.Slug == "hospodarchi-tovary");
        var first = await api.AddProductAsync("ruchnyi-instrument", "Мітла масова", 120m);
        var second = await api.AddProductAsync("ruchnyi-instrument", "Щітка масова", 60m, visible: false);

        var result = await (await manager.PostAsJsonAsync(
                $"{Products}/bulk",
                new BulkUpdateProductsRequest([first.Id, second.Id], target.Id, brand.Name.ToLowerInvariant(), [label.Id], null, true),
                TestJson.Options,
                Ct))
            .ReadAsync<BulkUpdateProductsResult>();
        result.Updated.ShouldBe(2);

        foreach (var id in new[] { first.Id, second.Id })
        {
            var product = await admin.ReadAsync<ConsoleProductDto>($"{Products}/{id}");
            product.CategoryId.ShouldBe(target.Id);
            product.Brand.ShouldBe(brand.Name);
            product.IsVisible.ShouldBeTrue();
            product.LabelIds.ShouldBe([label.Id]);
        }

        (await ListAsync(admin, $"labelId={label.Id}")).Items.Select(i => i.Id).ShouldBe([first.Id, second.Id], ignoreOrder: true);
        var again = await (await manager.PostAsJsonAsync(
                $"{Products}/bulk",
                new BulkUpdateProductsRequest([first.Id, second.Id], target.Id, null, [label.Id], null, true),
                TestJson.Options,
                Ct))
            .ReadAsync<BulkUpdateProductsResult>();
        again.Updated.ShouldBe(0);

        var removed = await (await manager.PostAsJsonAsync(
                $"{Products}/bulk",
                new BulkUpdateProductsRequest([first.Id], null, "", null, [label.Id], null),
                TestJson.Options,
                Ct))
            .ReadAsync<BulkUpdateProductsResult>();
        removed.Updated.ShouldBe(1);
        var cleared = await admin.ReadAsync<ConsoleProductDto>($"{Products}/{first.Id}");
        cleared.Brand.ShouldBeNull();
        cleared.LabelIds.ShouldBeEmpty();

        var audited = await api.WithDbAsync(db => db.Set<AuditEntry>().Where(e => e.Action == "catalog.products_bulk_updated").Select(e => e.Details).ToListAsync(Ct));
        audited.Count(d => d!.Contains(first.Sku, StringComparison.Ordinal)).ShouldBe(2);

        foreach (var (request, field) in new[]
                 {
                     (new BulkUpdateProductsRequest([], null, null, null, null, true), "productIds"),
                     (new BulkUpdateProductsRequest([first.Id], null, null, null, null, null), "productIds"),
                     (new BulkUpdateProductsRequest([first.Id], Guid.NewGuid(), null, null, null, null), "categoryId"),
                     (new BulkUpdateProductsRequest([first.Id], null, CatalogDictionaries.Unique("Невідомий"), null, null, null), "brand"),
                     (new BulkUpdateProductsRequest([first.Id], null, null, [label.Id], [label.Id], null), "removeLabelIds"),
                     (new BulkUpdateProductsRequest([first.Id, Guid.NewGuid()], null, null, null, null, false), "productIds"),
                 })
        {
            var invalid = await manager.PostAsJsonAsync($"{Products}/bulk", request, TestJson.Options, Ct);
            invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            (await invalid.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.ShouldContainKey(field);
        }
    }

    [Fact]
    public async Task Bulk_update_requires_product_edit_permission()
    {
        var admin = await Staff.AdminAsync(api);
        var viewer = await TestRoles.LoginWithPermissionsAsync(api, admin, PoliValko.Infrastructure.Security.Permissions.PermissionKeys.ProductsView);
        var product = await api.AddProductAsync("ruchnyi-instrument", "Граблі без прав", 100m);

        (await viewer.GetAsync($"{Products}/counts", Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var denied = await viewer.PostAsJsonAsync($"{Products}/bulk", new BulkUpdateProductsRequest([product.Id], null, null, null, null, false), TestJson.Options, Ct);
        denied.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await viewer.PostAsJsonAsync(CatalogDictionaries.Labels, new { name = "Без прав", tone = "red", kind = "manual", sortOrder = 0, isActive = true }, Ct))
            .StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await viewer.GetAsync(CatalogDictionaries.Labels, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await viewer.GetAsync(CatalogDictionaries.Brands, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    private static Task<PagedResponse<ConsoleProductListItemDto>> ListAsync(HttpClient client, string query) =>
        client.ReadAsync<PagedResponse<ConsoleProductListItemDto>>($"{Products}?{query}&pageSize=100");
}
