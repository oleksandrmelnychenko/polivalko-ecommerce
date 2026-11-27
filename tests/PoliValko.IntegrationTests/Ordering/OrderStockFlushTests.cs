using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Features.Pricing;
using PoliValko.Ordering.Features.Cart;
using PoliValko.Ordering.Features.Checkout;

namespace PoliValko.IntegrationTests;

// Orders come all day. Each one used to expire the whole storefront catalog at once, so every page after an order was
// rebuilt while the shopper waited. An order now refreshes only what can be bought, in the background.
public sealed class OrderStockFlushTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task An_order_marks_its_stock_change_as_coming_from_orders()
    {
        var product = await api.AddProductAsync("vse-dlia-polyvu", "Резерв замовлення", 100, 5);
        var before = await FromOrdersAsync();

        var client = await Accounts.AnonymousAsync(api);
        var cart = await (await client.PostAsync("/api/v1/cart/open", null, Ct)).ReadAsync<ServerCartDto>();
        cart = await (await client.PutJsonAsync("/api/v1/cart/", new SaveCartRequest(cart.Id, cart.Revision, [new(product.Id, 1)])))
            .ReadAsync<ServerCartDto>();
        var body = new CartCheckoutRequest(cart.Id, cart.Revision, CheckoutApiTests.Order(product.Id, 1, "100.00", CheckoutApiTests.UniquePhone()));
        await (await client.PostJsonAsync("/api/v1/cart/checkout", body)).ReadAsync<OrderCreatedDto>(HttpStatusCode.Created);

        (await FromOrdersAsync()).ShouldBeGreaterThan(before);
    }

    [Fact]
    public async Task An_order_refreshes_only_stock_while_other_changes_still_drop_the_catalog()
    {
        var storefront = new RecordingStorefront();
        var handler = new InvalidateStockAvailability(storefront);

        await handler.HandleAsync(new StockAvailabilityChanged { OrdersOnly = true }, Ct);
        storefront.Tags.ShouldBe(["stock"]);

        storefront.Tags.Clear();
        // A message saved before the field existed has none: it keeps the old, full flush.
        var older = JsonSerializer.Deserialize<StockAvailabilityChanged>("{}", JsonSerializerOptions.Web)!;
        await handler.HandleAsync(older, Ct);
        storefront.Tags.ShouldBe(["products", "catalog", "collections"], ignoreOrder: true);
    }

    // The payload is jsonb, which rewrites its spacing: ask Postgres for the field instead of matching text.
    private Task<int> FromOrdersAsync() => api.WithDbAsync(db => db.Database.SqlQuery<int>($"""
        SELECT count(*)::int AS "Value" FROM integration.outbox_messages
        WHERE type = {StockAvailabilityChanged.Type} AND (payload ->> 'ordersOnly')::boolean
        """).SingleAsync(Ct));
}
