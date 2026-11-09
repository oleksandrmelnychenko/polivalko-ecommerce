using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Domain;
using PoliValko.Ordering.Features.Cart;
using PoliValko.Ordering.Features.Checkout;

namespace PoliValko.IntegrationTests;

public sealed class ServerCartApiTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;
    private static async Task<ServerCartDto> Open(HttpClient client) => await (await client.PostAsync("/api/v1/cart/open", null, Ct)).ReadAsync<ServerCartDto>();
    private static async Task<ServerCartDto> Save(HttpClient client, ServerCartDto cart, Guid product, int quantity) =>
        await (await client.PutJsonAsync("/api/v1/cart/", new SaveCartRequest(cart.Id, cart.Revision, [new(product, quantity)]))).ReadAsync<ServerCartDto>();

    [Fact]
    public async Task Cart_is_server_owned_merges_once_and_survives_a_new_login()
    {
        var p = await api.AddProductAsync("vse-dlia-polyvu", "Серверний кошик", 100, 10);
        var guest = await Accounts.AnonymousAsync(api);
        var cart = await Save(guest, await Open(guest), p.Id, 2);
        (await Open(guest)).Items.ShouldHaveSingleItem().Quantity.ShouldBe(2);
        var outsider = await Accounts.AnonymousAsync(api);
        (await Open(outsider)).Items.ShouldBeEmpty();
        (await outsider.PutJsonAsync("/api/v1/cart/", new SaveCartRequest(cart.Id, cart.Revision, []))).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var email = Accounts.UniqueEmail();
        var (customer, _) = await Accounts.RegisterAsync(api, email);
        await Save(customer, await Open(customer), p.Id, 1);
        (await guest.PostJsonAsync("/api/v1/account/login", new { email, password = Accounts.Password })).StatusCode.ShouldBe(HttpStatusCode.OK);
        await Accounts.RefreshCsrfAsync(guest);
        (await Open(guest)).Items.ShouldHaveSingleItem().Quantity.ShouldBe(3);
        (await Open(guest)).Items.ShouldHaveSingleItem().Quantity.ShouldBe(3);
        var otherDevice = await Accounts.LoginAsync(api, email);
        (await Open(otherDevice)).Items.ShouldHaveSingleItem().Quantity.ShouldBe(3);
        (await guest.PostAsync("/api/v1/account/logout", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await Accounts.RefreshCsrfAsync(guest);
        (await Open(guest)).Items.ShouldBeEmpty();
        using var noCsrf = api.CreateClient();
        (await noCsrf.PostAsync("/api/v1/cart/open", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Stale_cart_write_is_rejected_and_hidden_products_cannot_be_ordered()
    {
        var p = await api.AddProductAsync("vse-dlia-polyvu", "Версія кошика", 100, 10);
        var client = await Accounts.AnonymousAsync(api);
        var old = await Open(client);
        var current = await Save(client, old, p.Id, 2);
        (await client.PutJsonAsync("/api/v1/cart/", new SaveCartRequest(old.Id, old.Revision, []))).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        await api.WithDbAsync(db => db.Set<Product>().Where(x => x.Id == p.Id).ExecuteUpdateAsync(s => s.SetProperty(x => x.IsVisible, false), Ct));
        var request = new CartCheckoutRequest(current.Id, current.Revision, CheckoutApiTests.Order(p.Id, 2, "200.00", CheckoutApiTests.UniquePhone()));
        (await client.PostJsonAsync("/api/v1/cart/checkout", request)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await api.WithDbAsync(db => db.Set<ProductStock>().SingleAsync(s => s.ProductId == p.Id, Ct))).ReservedQuantity.ShouldBe(0);
    }

    [Fact]
    public async Task Lost_response_reload_and_concurrent_checkout_return_one_order_and_one_reservation()
    {
        var p = await api.AddProductAsync("vse-dlia-polyvu", "Відновлення оформлення", 100, 10);
        var client = await Accounts.AnonymousAsync(api);
        var cart = await Save(client, await Open(client), p.Id, 2);
        var request = new CartCheckoutRequest(cart.Id, cart.Revision, CheckoutApiTests.Order(p.Id, 2, "200.00", CheckoutApiTests.UniquePhone()));
        var responses = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => client.PostJsonAsync("/api/v1/cart/checkout", request)));
        var results = await Task.WhenAll(responses.Select(r => r.ReadAsync<OrderCreatedDto>(HttpStatusCode.Created)));
        results.Select(r => r.Number).Distinct().ShouldHaveSingleItem();
        // Treat all original responses as lost: only the server cart is available after a reload.
        var recovered = await Open(client);
        recovered.Items.ShouldBeEmpty();
        recovered.LastOrder.ShouldBe(results[0]);
        (await client.PostJsonAsync("/api/v1/cart/checkout", request)).StatusCode.ShouldBe(HttpStatusCode.Created);
        var key = $"cart:{cart.Id}:{cart.Revision}";
        (await api.WithDbAsync(db => db.Set<Order>().CountAsync(o => o.IdempotencyKey == key, Ct))).ShouldBe(1);
        (await api.WithDbAsync(db => db.Set<ProductStock>().SingleAsync(s => s.ProductId == p.Id, Ct))).ReservedQuantity.ShouldBe(2);
        var stored = await api.WithDbAsync(db => db.Set<ServerCart>().SingleAsync(c => c.Id == cart.Id, Ct));
        stored.ProtectedCheckoutResult!.ShouldNotContain(results[0].AccessToken);
        var unrelated = await Accounts.AnonymousAsync(api);
        (await unrelated.PostJsonAsync("/api/v1/cart/checkout", request)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var next = await Save(client, recovered, p.Id, 1);
        (await client.PostJsonAsync("/api/v1/cart/checkout", request)).StatusCode.ShouldBe(HttpStatusCode.Created);
        (await Open(client)).Revision.ShouldBe(next.Revision);
        (await Open(client)).Items.ShouldHaveSingleItem().Quantity.ShouldBe(1);
    }

    [Fact]
    public async Task Last_units_are_reserved_atomically_and_cancellation_releases_once()
    {
        var p = await api.AddProductAsync("vse-dlia-polyvu", "Останні дві одиниці", 100, 2);
        var a = await Accounts.AnonymousAsync(api);
        var b = await Accounts.AnonymousAsync(api);
        var ca = await Save(a, await Open(a), p.Id, 2);
        var cb = await Save(b, await Open(b), p.Id, 2);
        var ra = new CartCheckoutRequest(ca.Id, ca.Revision, CheckoutApiTests.Order(p.Id, 2, "200.00", CheckoutApiTests.UniquePhone()));
        var rb = new CartCheckoutRequest(cb.Id, cb.Revision, CheckoutApiTests.Order(p.Id, 2, "200.00", CheckoutApiTests.UniquePhone()));
        var responses = await Task.WhenAll(a.PostJsonAsync("/api/v1/cart/checkout", ra), b.PostJsonAsync("/api/v1/cart/checkout", rb));
        responses.Count(r => r.StatusCode == HttpStatusCode.Created).ShouldBe(1);
        responses.Count(r => r.StatusCode == HttpStatusCode.Conflict).ShouldBe(1);
        var created = await responses.Single(r => r.StatusCode == HttpStatusCode.Created).ReadAsync<OrderCreatedDto>(HttpStatusCode.Created);
        var admin = await Staff.AdminAsync(api);
        (await admin.PostJsonAsync($"/api/v1/console/orders/{created.Number}/status", new { status = "cancelled" })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.PostJsonAsync($"/api/v1/console/orders/{created.Number}/status", new { status = "cancelled" })).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await api.WithDbAsync(db => db.Set<ProductStock>().SingleAsync(s => s.ProductId == p.Id, Ct))).ReservedQuantity.ShouldBe(0);
        var loser = responses[0].StatusCode == HttpStatusCode.Conflict ? a : b;
        var retry = responses[0].StatusCode == HttpStatusCode.Conflict ? ra : rb;
        (await loser.PostJsonAsync("/api/v1/cart/checkout", retry)).StatusCode.ShouldBe(HttpStatusCode.Created);
    }

    [Fact]
    public async Task Stock_sync_preserves_local_reservations_and_confirmed_erp_fulfilment_reconciles_once()
    {
        var p = await api.AddProductAsync("vse-dlia-polyvu", "Синхронізація резерву", 100, 5);
        var client = await Accounts.AnonymousAsync(api);
        var cart = await Save(client, await Open(client), p.Id, 2);
        var body = new CartCheckoutRequest(cart.Id, cart.Revision, CheckoutApiTests.Order(p.Id, 2, "200.00", CheckoutApiTests.UniquePhone()));
        var created = await (await client.PostJsonAsync("/api/v1/cart/checkout", body)).ReadAsync<OrderCreatedDto>(HttpStatusCode.Created);
        var id = await api.WithDbAsync(db => db.Set<Order>().Where(o => o.Number == created.Number).Select(o => o.Id).SingleAsync(Ct));
        await api.WithScopeAsync(async sp => {
            var importer = sp.GetRequiredService<ICatalogImporter>();
            await importer.ApplyPriceStockAsync([new(p.NavkoloId, 100, null, 5)], Ct);
            var prices = await sp.GetRequiredService<ICatalogPricing>().GetAsync([p.Id], Ct);
            prices[p.Id].Stock.ShouldBe(3);
            var db = sp.GetRequiredService<PoliValkoDbContext>();
            await using var tx = await db.Database.BeginTransactionAsync(Ct);
            await importer.ApplyPriceStockAsync([new(p.NavkoloId, 100, null, 3)], Ct);
            var reservations = sp.GetRequiredService<ICatalogReservations>();
            await reservations.ReconcileFulfilledAsync([id], Ct);
            await db.SaveChangesAsync(Ct);
            await reservations.ReconcileFulfilledAsync([id], Ct);
            await db.SaveChangesAsync(Ct);
            await tx.CommitAsync(Ct);
            return true;
        });
        var stock = await api.WithDbAsync(db => db.Set<ProductStock>().SingleAsync(s => s.ProductId == p.Id, Ct));
        stock.Quantity.ShouldBe(3);
        stock.ReservedQuantity.ShouldBe(0);
    }
}
