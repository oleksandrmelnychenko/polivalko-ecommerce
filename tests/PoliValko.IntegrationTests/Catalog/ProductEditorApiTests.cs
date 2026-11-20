using System.Net;
using System.Net.Http.Json;
using PoliValko.Catalog.Features.Console.Products;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class ProductEditorApiTests(ApiFactory api)
{
    [Fact]
    public async Task Edits_accounting_and_compare_at_preserves_identity_and_rejects_stale_edits()
    {
        var ct = TestContext.Current.CancellationToken;
        var item = await api.AddProductAsync("vse-dlia-polyvu", "Редагування обліку", 27m);
        using var admin = await Staff.AdminAsync(api);
        var path = $"/api/v1/console/catalog/products/{item.Id}";
        var before = (await admin.ReadAsync<ConsoleProductDto>(path)).Navkolo;
        var original = new ProductAccountingFields(before.Sku, before.Name, before.GroupRef, before.VariantGroup, before.VariantLabel);
        var changed = original with { Name = "Трійник", Sku = $"test-{Guid.NewGuid():N}", VariantGroup = "tube", VariantLabel = "16 мм" };
        var request = new UpdateProductRequest(null, null, null, null, null, true, null, null, [], Accounting: new(original, changed));
        var result = await (await admin.PutAsJsonAsync(path, request, TestJson.Options, ct)).ReadAsync<ConsoleProductDto>();
        result.Navkolo.ShouldBe(before with { Name = changed.Name, Sku = changed.Sku, VariantGroup = "tube", VariantLabel = "16 мм" });
        (await admin.PutAsJsonAsync(path, request, TestJson.Options, ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);

        var price = new AdjustUpstreamPriceChange(item.Id, changed.Sku, 27m, null, before.PriceUpdatedAt, 25m, true, 30m);
        const string pricePath = "/api/v1/console/catalog/products/price";
        (await admin.PostAsJsonAsync(pricePath, new AdjustUpstreamPriceRequest([price]), TestJson.Options, ct)).EnsureSuccessStatusCode();
        var updated = (await admin.ReadAsync<ConsoleProductDto>(path)).Navkolo;
        updated.Price.ShouldBe(MoneyDto.Hryvnia(25m));
        updated.OldPrice.ShouldBe(MoneyDto.Hryvnia(30m));
        var clear = price with { ExpectedPrice = 25m, ExpectedOldPrice = 30m, ExpectedPriceUpdatedAt = updated.PriceUpdatedAt, OldPrice = null };
        (await admin.PostAsJsonAsync(pricePath, new AdjustUpstreamPriceRequest([clear]), TestJson.Options, ct)).EnsureSuccessStatusCode();
        (await admin.ReadAsync<ConsoleProductDto>(path)).Navkolo.OldPrice.ShouldBeNull();
    }
}
