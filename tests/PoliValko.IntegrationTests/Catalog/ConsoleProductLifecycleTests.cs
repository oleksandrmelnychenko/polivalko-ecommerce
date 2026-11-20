using System.Net;
using System.Net.Http.Json;
using PoliValko.Catalog.Features.Console.Categories;
using PoliValko.Catalog.Features.Console.Products;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class ConsoleProductLifecycleTests(ApiFactory api)
{
    [Fact]
    public async Task Created_product_can_be_archived_and_restored_without_changing_identity()
    {
        const string path = "/api/v1/console/catalog/products";
        var ct = TestContext.Current.CancellationToken;
        var admin = await Staff.AdminAsync(api);
        var category = (await admin.ReadAsync<List<ConsoleCategoryDto>>("/api/v1/console/catalog/categories")).First();
        var sku = $"qa-{Guid.NewGuid():N}";
        var input = new CreateCatalogProductRequest("Ручний товар", sku, category.Id);
        var id = await (await admin.PostAsJsonAsync(path, input, ct)).ReadAsync<Guid>(HttpStatusCode.Created);
        (await admin.PostAsJsonAsync(path, input, ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var url = $"{path}/{id}";
        var visible = new SetProductsVisibilityRequest([id], true);
        (await admin.PostAsJsonAsync($"{path}/visibility", visible, ct)).EnsureSuccessStatusCode();
        foreach (var archived in new[] { true, true, false })
        {
            (await admin.PutAsJsonAsync($"{url}/archive", new SetProductArchiveRequest(archived), ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
            var product = await admin.ReadAsync<ConsoleProductDto>(url);
            product.Id.ShouldBe(id);
            product.IsArchived.ShouldBe(archived);
            product.IsVisible.ShouldBeFalse();
            product.Navkolo.Sku.ShouldBe(sku);
            (await admin.ReadAsync<PagedResponse<ConsoleProductListItemDto>>($"{path}?q={sku}")).TotalItems.ShouldBe(archived ? 0 : 1);
            (await admin.ReadAsync<PagedResponse<ConsoleProductListItemDto>>($"{path}?q={sku}&archived=true")).TotalItems.ShouldBe(archived ? 1 : 0);
            if (archived) (await admin.PostAsJsonAsync($"{path}/visibility", visible, ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        }
    }
}
