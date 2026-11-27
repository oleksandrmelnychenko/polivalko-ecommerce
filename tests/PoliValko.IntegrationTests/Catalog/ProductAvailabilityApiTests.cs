using System.Net;
using PoliValko.Catalog.Features.Storefront;
using PoliValko.Ordering.Features.Checkout;

namespace PoliValko.IntegrationTests;

// Pages are cached, so the browser asks for live availability after loading. The last unit stops being in stock the
// moment someone orders it.
public sealed class ProductAvailabilityApiTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task The_last_unit_stops_being_in_stock_as_soon_as_it_is_ordered()
    {
        var last = await api.AddProductAsync("vse-dlia-roslyn", "Остання штука", 100m, stock: 1);
        var plenty = await api.AddProductAsync("vse-dlia-roslyn", "Багато штук", 100m, stock: 7.5m);
        var onRequest = await api.AddProductAsync("vse-dlia-roslyn", "Ціна за запитом", 0m, stock: 3);
        var hidden = await api.AddProductAsync("vse-dlia-roslyn", "Прихований", 100m, stock: 3, visible: false);
        var client = api.CreateClient();
        var url = $"/api/v1/catalog/availability?ids={last.Id},{plenty.Id},{onRequest.Id},{hidden.Id}";

        var response = await client.GetAsync(url, Ct);
        response.Headers.CacheControl!.NoStore.ShouldBeTrue();
        var before = (await response.ReadAsync<List<ProductAvailabilityDto>>()).ToDictionary(a => a.ProductId);
        before.Keys.ShouldBe([last.Id, plenty.Id, onRequest.Id], ignoreOrder: true);
        before[last.Id].ShouldBe(new ProductAvailabilityDto(last.Id, true, 1));
        before[plenty.Id].ShouldBe(new ProductAvailabilityDto(plenty.Id, true, 7));
        before[onRequest.Id].ShouldBe(new ProductAvailabilityDto(onRequest.Id, false, 0));

        var order = CheckoutApiTests.Order(last.Id, 1, "100.00", CheckoutApiTests.UniquePhone());
        await (await new CheckoutApiTests(api).PostOrderAsync(order, Guid.NewGuid().ToString())).ReadAsync<OrderCreatedDto>(HttpStatusCode.Created);

        var after = (await client.ReadAsync<List<ProductAvailabilityDto>>(url)).ToDictionary(a => a.ProductId);
        after[last.Id].ShouldBe(new ProductAvailabilityDto(last.Id, false, 0));
        after[plenty.Id].Available.ShouldBe(7);
    }

    [Fact]
    public async Task Malformed_or_too_many_ids_are_rejected()
    {
        var client = api.CreateClient();
        (await client.GetAsync("/api/v1/catalog/availability?ids=not-a-guid", Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var many = string.Join(",", Enumerable.Range(0, GetAvailability.MaxProducts + 1).Select(_ => Guid.NewGuid()));
        (await client.GetAsync($"/api/v1/catalog/availability?ids={many}", Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await client.ReadAsync<List<ProductAvailabilityDto>>("/api/v1/catalog/availability")).ShouldBeEmpty();
    }
}
