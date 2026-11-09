using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using PoliValko.Navkolo.Configuration;
using PoliValko.Navkolo.Integrations.NavkoloApi;

namespace PoliValko.UnitTests.Navkolo;

public sealed class HttpNavkoloClientTests
{
    private const string StoreId = "aee1b0db-651b-4610-a081-2fc696f0ab39";
    private const string ProductId = "8341c598-11c0-49be-a56e-4da0274f9651";
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Catalog_uses_api_key_pagination_selected_store_and_subtracts_external_bookings()
    {
        var pages = new List<int>();
        var handler = new FakeHandler(request => {
            request.Headers.GetValues("ApiKey").Single().ShouldBe("test-key");
            if (request.RequestUri!.AbsolutePath == "/products/stores") return Json(new { status = 1, stores = new[] { new { id = StoreId } } });
            request.Method.ShouldBe(HttpMethod.Post);
            request.RequestUri.Query.ShouldContain($"store_id={StoreId}");
            request.RequestUri.Query.ShouldContain("website_synch=1");
            var offset = request.RequestUri.Query.Contains("offset=100", StringComparison.Ordinal) ? 100 : 0;
            pages.Add(offset);
            return Json(new { status = 1, products = Enumerable.Range(offset, offset == 0 ? 100 : 1).Select(i => new {
                product_id = GuidFrom(i), sku = $"SKU-{i}", title = "Товар", price = "12.50", balance = 8, booked = 3, currency = "UAH",
                store_id = StoreId, category = new { category_id = "group-id", title = "Сад" }, images = Array.Empty<string>()
            }) });
        });
        var records = await Client(handler).GetCatalogAsync(Ct);
        pages.ShouldBe([0, 100]);
        records.Count.ShouldBe(101);
        records[0].Price.ShouldBe(12.5m);
        records[0].Stock.ShouldBe(5);
        records[0].GroupRef.ShouldBe("group-id");
        records[0].GroupName.ShouldBe("Сад");
    }

    [Fact]
    public async Task Repeated_export_uses_same_order_uuid_and_does_not_double_reserve_in_erp()
    {
        var id = Guid.NewGuid();
        var uploads = new List<string>();
        var handler = new FakeHandler(request => {
            if (request.RequestUri!.AbsolutePath == "/products/stores") return Json(new { status = 1, stores = new[] { new { id = StoreId } } });
            request.RequestUri.AbsolutePath.ShouldBe("/orders/upload");
            var body = request.Content!.ReadAsStringAsync(Ct).GetAwaiter().GetResult();
            uploads.Add(body);
            using var json = JsonDocument.Parse(body);
            json.RootElement.GetProperty("id").GetGuid().ShouldBe(id);
            json.RootElement.GetProperty("reserve").GetInt32().ShouldBe(0);
            json.RootElement.GetProperty("private_id").GetString().ShouldBe("PV-123");
            json.RootElement.GetProperty("cart")[0].GetProperty("product_id").GetString().ShouldBe(ProductId);
            return Json(new { status = 1, data = new { id } });
        });
        var client = Client(handler);
        var order = new NavkoloOrder("PV-123", DateTimeOffset.Parse("2026-11-08T08:00:00Z"), "Тест", "+380670000000", "Самовивіз", "PayOnPickup", 25,
            "Тест", [new("SKU", "Товар", 2, 12.5m, ProductId)], id);
        (await client.SendOrderAsync(order, Ct)).ShouldBe(id.ToString());
        (await client.SendOrderAsync(order, Ct)).ShouldBe(id.ToString());
        uploads[0].ShouldBe(uploads[1]);
    }

    [Fact]
    public async Task Multiple_stores_require_selection_and_provider_errors_do_not_expose_secrets()
    {
        var many = Client(new FakeHandler(_ => Json(new { status = 1, stores = new[] { new { id = StoreId }, new { id = ProductId } } })));
        (await Should.ThrowAsync<NavkoloUnavailableException>(() => many.GetCatalogAsync(Ct))).Message.ShouldContain("StoreId");
        var denied = Client(new FakeHandler(_ => new HttpResponseMessage(HttpStatusCode.Unauthorized) { Content = new StringContent("secret-token customer data") }));
        var error = await Should.ThrowAsync<NavkoloUnavailableException>(() => denied.GetCatalogAsync(Ct));
        error.Message.ShouldBe("DNTrade HTTP 401.");
    }

    [Fact]
    public async Task Invalid_snapshot_is_not_accepted_as_an_empty_catalog()
    {
        var client = Client(new FakeHandler(_ => Json(new { status = 0, stores = Array.Empty<object>() })));
        await Should.ThrowAsync<NavkoloUnavailableException>(() => client.GetCatalogAsync(Ct));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Cancellation_uses_selected_status_reads_back_confirmation_and_replays_without_upload(bool loseResponse)
    {
        var id = Guid.NewGuid(); var cancelled = false; var writes = 0;
        var client = new HttpNavkoloClient(new HttpClient(new FakeHandler(request =>
        {
            if (request.RequestUri!.AbsolutePath == "/orders/statuslist") return Json(new { status = 1, data = new[] { new { id = 9, title = "Скасоване" } } });
            if (request.RequestUri.AbsolutePath == "/orders/list")
            {
                request.RequestUri.Query.ShouldContain($"id={id}");
                return Json(new { status = 1, orders = new[] { new { external_id = id, load = 0, status = cancelled ? "Скасоване" : "Нове" } } });
            }
            request.RequestUri.AbsolutePath.ShouldBe("/orders/setstatus");
            using var body = JsonDocument.Parse(request.Content!.ReadAsStringAsync(Ct).GetAwaiter().GetResult());
            body.RootElement.GetProperty("id").GetGuid().ShouldBe(id);
            body.RootElement.GetProperty("status").GetInt32().ShouldBe(9);
            writes++; cancelled = true;
            if (loseResponse) throw new HttpRequestException("Response lost after cancellation");
            return Json(new { status = 1 });
        })) { BaseAddress = new Uri("https://api.dntrade.com.ua/") }, Options.Create(new NavkoloOptions { ApiKey = "test", CancellationStatusId = 9 }), new DnTradeRequestGate(TimeProvider.System));
        if (loseResponse) await Should.ThrowAsync<HttpRequestException>(() => client.CancelOrderAsync(id, id.ToString(), Ct));
        else await client.CancelOrderAsync(id, id.ToString(), Ct);
        await client.CancelOrderAsync(id, id.ToString(), Ct);
        writes.ShouldBe(1);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Shipped_or_missing_remote_order_is_not_acknowledged_as_cancelled(bool shipped)
    {
        var id = Guid.NewGuid();
        var client = new HttpNavkoloClient(new HttpClient(new FakeHandler(request =>
        {
            if (request.RequestUri!.AbsolutePath == "/orders/statuslist") return Json(new { status = 1, data = new[] { new { id = 9, title = "Скасоване" } } });
            request.RequestUri.AbsolutePath.ShouldBe("/orders/list");
            return Json(new { status = 1, orders = shipped ? new[] { new { external_id = id, load = 1, status = "Нове" } } : [] });
        })) { BaseAddress = new Uri("https://api.dntrade.com.ua/") }, Options.Create(new NavkoloOptions { ApiKey = "test", CancellationStatusId = 9 }), new DnTradeRequestGate(TimeProvider.System));
        await Should.ThrowAsync<NavkoloUnavailableException>(() => client.CancelOrderAsync(id, null, Ct));
    }

    [Fact]
    public async Task Reverse_states_use_selected_cancellation_status_channel_and_all_pages()
    {
        var pages = new List<int>();
        var client = new HttpNavkoloClient(new HttpClient(new FakeHandler(request =>
        {
            if (request.RequestUri!.AbsolutePath == "/orders/statuslist")
                return Json(new { status = 1, data = new[] { new { id = 9, title = "Скасоване" } } });
            request.RequestUri.Query.ShouldContain("channel=Poli-Valko");
            var offset = request.RequestUri.Query.Contains("offset=50", StringComparison.Ordinal) ? 50 : 0;
            pages.Add(offset);
            return Json(new { status = 1, orders = Enumerable.Range(offset, offset == 0 ? 50 : 4).Select(i => new {
                external_id = GuidFrom(i), load = i == 50 ? 1 : 0,
                status = i == 51 ? "Скасоване" : i >= 52 ? "9" : "Нове",
                channel = i == 53 ? "Інший магазин" : "Poli-Valko"
            }) });
        })) { BaseAddress = new Uri("https://api.dntrade.com.ua/") }, Options.Create(new NavkoloOptions { CancellationStatusId = 9 }), new DnTradeRequestGate(TimeProvider.System));
        var states = await client.GetOrderStatesAsync(Ct);
        pages.ShouldBe([0, 50]); states.Count.ShouldBe(3);
        states[0].Shipped.ShouldBeTrue(); states[0].Cancelled.ShouldBeFalse();
        states[1].Cancelled.ShouldBeTrue(); states[2].Cancelled.ShouldBeTrue();
    }

    [Theory]
    [InlineData("duplicate")]
    [InlineData("load")]
    [InlineData("missing_status")]
    public async Task Unsafe_reverse_snapshot_is_rejected(string invalid)
    {
        var client = new HttpNavkoloClient(new HttpClient(new FakeHandler(request =>
        {
            if (request.RequestUri!.AbsolutePath == "/orders/statuslist")
                return Json(new { status = 1, data = new[] { new { id = invalid == "missing_status" ? 8 : 9, title = "Скасоване" } } });
            return Json(new { status = 1, orders = Enumerable.Range(0, invalid == "duplicate" ? 2 : 1).Select(_ => new {
                external_id = GuidFrom(1), load = invalid == "load" ? 2 : 1, status = "Скасоване", channel = "Poli-Valko"
            }) });
        })) { BaseAddress = new Uri("https://api.dntrade.com.ua/") }, Options.Create(new NavkoloOptions { CancellationStatusId = 9 }), new DnTradeRequestGate(TimeProvider.System));
        await Should.ThrowAsync<NavkoloUnavailableException>(() => client.GetOrderStatesAsync(Ct));
    }

    private static string GuidFrom(int i) => $"00000000-0000-0000-0000-{i + 1:000000000000}";
    private static HttpResponseMessage Json(object value) => new(HttpStatusCode.OK) { Content = new StringContent(JsonSerializer.Serialize(value), Encoding.UTF8, "application/json") };
    private static HttpNavkoloClient Client(HttpMessageHandler handler) => new(new HttpClient(handler) { BaseAddress = new Uri("https://api.dntrade.com.ua/") },
        Options.Create(new NavkoloOptions { Mode = NavkoloModes.DnTrade, ApiKey = "test-key" }), new DnTradeRequestGate(TimeProvider.System));
    private sealed class FakeHandler(Func<HttpRequestMessage, HttpResponseMessage> response) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => Task.FromResult(response(request));
    }
}
