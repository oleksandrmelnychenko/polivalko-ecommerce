using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using PoliValko.Ordering.Features.Checkout;

namespace PoliValko.IntegrationTests;

// A repeated request gets the first answer back, but that answer is not kept readable in the database:
// for an order it holds the token that opens the order page.
public sealed class IdempotencyStorageTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task The_saved_answer_of_an_order_does_not_show_its_access_token_and_still_replays()
    {
        var product = await api.AddProductAsync("vse-dlia-polyvu", "Лійка для ключа", 100m, stock: 5);
        var checkout = new CheckoutApiTests(api);
        var key = Guid.NewGuid().ToString();
        var request = CheckoutApiTests.Order(product.Id, 1, "100.00", CheckoutApiTests.UniquePhone());

        var first = await (await checkout.PostOrderAsync(request, key)).ReadAsync<OrderCreatedDto>(HttpStatusCode.Created);
        var saved = await api.WithDbAsync(db => db.IdempotencyRecords.AsNoTracking()
            .Where(r => r.Key == key).Select(r => r.ResponseBody).SingleAsync(Ct));

        saved.ShouldNotBeNull();
        saved.ShouldNotContain(first.AccessToken);
        saved.ShouldNotContain(first.Number);
        var again = await checkout.PostOrderAsync(request, key);
        again.Headers.GetValues("Idempotent-Replayed").ShouldBe(["true"]);
        (await again.Content.ReadFromJsonAsync<OrderCreatedDto>(TestJson.Options, Ct))!.AccessToken.ShouldBe(first.AccessToken);
    }
}
