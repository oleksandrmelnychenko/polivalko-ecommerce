using System.Net;
using System.Net.Http.Json;
using PoliValko.Catalog.Features.Admin.Products;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class AdminProductStockApiTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Stock_filter_and_bulk_visibility_hide_products_from_storefront()
    {
        var soldOut = await api.AddProductAsync("hospodarchi-tovary", "Відро розпродане", 80m, stock: 0);
        var few = await api.AddProductAsync("hospodarchi-tovary", "Відро, що закінчується", 85m, stock: 2);
        var plenty = await api.AddProductAsync("hospodarchi-tovary", "Відро в наявності", 90m, stock: 40);
        var manager = await Staff.ManagerAsync(api);

        (await ListProductsAsync(manager, soldOut.Sku, "out")).ShouldHaveSingleItem().Id.ShouldBe(soldOut.Id);
        (await ListProductsAsync(manager, soldOut.Sku, "in")).ShouldBeEmpty();
        (await ListProductsAsync(manager, few.Sku, "low")).ShouldHaveSingleItem().Id.ShouldBe(few.Id);
        (await ListProductsAsync(manager, few.Sku, "out")).ShouldBeEmpty();
        (await ListProductsAsync(manager, plenty.Sku, "in")).ShouldHaveSingleItem().Id.ShouldBe(plenty.Id);
        (await ListProductsAsync(manager, plenty.Sku, "low")).ShouldBeEmpty();
        (await manager.GetAsync("/api/v1/admin/catalog/products?stock=few", Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        var request = new SetProductsVisibilityRequest([few.Id, plenty.Id], false);
        var withoutCsrf = await (await Staff.SignInAsync(api, ApiFactory.ManagerEmail)).PostAsJsonAsync("/api/v1/admin/catalog/products/visibility", request, TestJson.Options, Ct);
        withoutCsrf.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await withoutCsrf.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Code.ShouldBe("auth.csrf_invalid");

        var hidden = await (await manager.PostAsJsonAsync("/api/v1/admin/catalog/products/visibility", request, TestJson.Options, Ct))
            .ReadAsync<SetProductsVisibilityResult>();
        hidden.Updated.ShouldBe(2);

        var again = await (await manager.PostAsJsonAsync("/api/v1/admin/catalog/products/visibility", request, TestJson.Options, Ct))
            .ReadAsync<SetProductsVisibilityResult>();
        again.Updated.ShouldBe(0);

        var storefront = api.CreateClient();
        (await storefront.GetAsync($"/api/v1/products/{few.Slug}", Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await storefront.GetAsync($"/api/v1/products/{plenty.Slug}", Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ListProductsAsync(manager, plenty.Sku, null)).ShouldHaveSingleItem().IsVisible.ShouldBeFalse();

        foreach (var (body, field) in new (object, string)[]
                 {
                     (new SetProductsVisibilityRequest([], true), "productIds"),
                     (new SetProductsVisibilityRequest([few.Id], null), "visible"),
                     (new SetProductsVisibilityRequest([Guid.NewGuid()], true), "productIds"),
                 })
        {
            var invalid = await manager.PostAsJsonAsync("/api/v1/admin/catalog/products/visibility", body, TestJson.Options, Ct);
            invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            (await invalid.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.ShouldContainKey(field);
        }
    }

    private static async Task<IReadOnlyList<AdminProductListItemDto>> ListProductsAsync(HttpClient client, string sku, string? stock) =>
        (await client.ReadAsync<PagedResponse<AdminProductListItemDto>>($"/api/v1/admin/catalog/products?q={sku}{(stock is null ? string.Empty : $"&stock={stock}")}")).Items;
}
