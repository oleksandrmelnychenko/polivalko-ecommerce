using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Navkolo.Contracts;
using PoliValko.Navkolo.Integrations.NavkoloApi;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;
using PoliValko.Ordering.Features.Checkout;
using PoliValko.Ordering.Features.Console.Orders;

namespace PoliValko.IntegrationTests;

public sealed class NavkoloCancellationTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;
    private sealed record TestOrder(Guid Id, Guid ProductId, string Number);

    private async Task<TestOrder> CreateAsync()
    {
        var product = await api.AddProductAsync("vse-dlia-polyvu", "Перевірка скасування Навколо", 100, 5);
        using var client = api.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/orders") { Content = JsonContent.Create(CheckoutApiTests.Order(product.Id, 2, "200.00", CheckoutApiTests.UniquePhone()), options: TestJson.Options) };
        request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString());
        var created = await (await client.SendAsync(request, Ct)).ReadAsync<OrderCreatedDto>(HttpStatusCode.Created);
        var id = await api.WithDbAsync(db => db.Set<Order>().Where(o => o.Number == created.Number).Select(o => o.Id).SingleAsync(Ct));
        return new(id, product.Id, created.Number);
    }

    private WebApplicationFactory<Program> Host(Provider provider) => api.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
    {
        services.RemoveAll<INavkoloClient>(); services.AddSingleton<INavkoloClient>(provider);
        services.RemoveAll<INavkoloSettings>(); services.AddSingleton<INavkoloSettings>(new EnabledSettings());
    }));
    private static async Task Export(WebApplicationFactory<Program> host, TestOrder order)
    {
        await using var scope = host.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<IOutboxHandler<OrderExportRequested>>().HandleAsync(new(order.Id), Ct);
    }
    private static async Task SyncCancellation(WebApplicationFactory<Program> host, TestOrder order)
    {
        await using var scope = host.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<IOutboxHandler<OrderCancellationRequested>>().HandleAsync(new(order.Id), Ct);
    }
    private async Task Cancel(TestOrder order)
    {
        using var admin = await Staff.AdminAsync(api);
        (await admin.PostJsonAsync($"/api/v1/console/orders/{order.Number}/status", new ChangeOrderStatusRequest(OrderStatus.Cancelled, "Тест Навколо"))).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.PostJsonAsync($"/api/v1/console/orders/{order.Number}/status", new ChangeOrderStatusRequest(OrderStatus.Cancelled, "Повтор"))).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var messages = await api.WithDbAsync(db => db.OutboxMessages.Where(m => m.Type == OrderCancellationRequested.Type).Select(m => m.Payload).ToListAsync(Ct));
        messages.Count(p => p.Contains(order.Id.ToString(), StringComparison.OrdinalIgnoreCase)).ShouldBe(1);
    }
    private Task<decimal> Reserved(TestOrder order) => api.WithDbAsync(db => db.Set<ProductStock>().Where(p => p.ProductId == order.ProductId).Select(p => p.ReservedQuantity).SingleAsync(Ct));

    [Fact]
    public async Task Cancellation_before_export_releases_once_and_prevents_late_creation()
    {
        var order = await CreateAsync(); var provider = new Provider(); await using var host = Host(provider);
        await Cancel(order); (await Reserved(order)).ShouldBe(0);
        await Task.WhenAll(Export(host, order), SyncCancellation(host, order), SyncCancellation(host, order));
        provider.Uploads.ShouldBe(0); provider.Cancellations.ShouldBe(0);
        (await Reserved(order)).ShouldBe(0);
    }

    [Fact]
    public async Task Failed_remote_cancellation_holds_stock_then_concurrent_retries_release_exactly_once()
    {
        var order = await CreateAsync(); var provider = new Provider(); await using var host = Host(provider);
        await Export(host, order); await Cancel(order);
        (await Reserved(order)).ShouldBe(2);
        provider.FailCancellation = true;
        await Should.ThrowAsync<NavkoloUnavailableException>(() => SyncCancellation(host, order));
        (await Reserved(order)).ShouldBe(2);
        provider.FailCancellation = false;
        await Task.WhenAll(Enumerable.Range(0, 6).Select(_ => SyncCancellation(host, order)));
        provider.Cancellations.ShouldBe(1);
        await Export(host, order); provider.Uploads.ShouldBe(1);
        (await Reserved(order)).ShouldBe(0);
        var saved = await api.WithDbAsync(db => db.Set<Order>().AsNoTracking().SingleAsync(o => o.Id == order.Id, Ct));
        saved.NavkoloCancellationSynchronizedAt.ShouldNotBeNull();
        (await api.WithDbAsync(db => db.Set<ProductStock>().Where(p => p.ProductId == order.ProductId).Select(p => p.Quantity).SingleAsync(Ct))).ShouldBe(5);
    }

    [Fact]
    public async Task Lost_export_response_still_requires_remote_cancellation()
    {
        var order = await CreateAsync(); var provider = new Provider { LoseUploadResponse = true }; await using var host = Host(provider);
        await Should.ThrowAsync<HttpRequestException>(() => Export(host, order));
        await Cancel(order); (await Reserved(order)).ShouldBe(2);
        await SyncCancellation(host, order);
        provider.Cancellations.ShouldBe(1); (await Reserved(order)).ShouldBe(0);
    }

    [Fact]
    public async Task Cancellation_during_export_waits_for_the_upload_and_cannot_be_overwritten()
    {
        var order = await CreateAsync(); var provider = new Provider { PauseUpload = true }; await using var host = Host(provider);
        var exporting = Export(host, order);
        await provider.UploadStarted.Task.WaitAsync(TimeSpan.FromSeconds(10), Ct);
        try
        {
            await Cancel(order); (await Reserved(order)).ShouldBe(2);
            var cancelling = SyncCancellation(host, order);
            provider.ContinueUpload.TrySetResult();
            await Task.WhenAll(exporting, cancelling);
            provider.RemoteCancelled.ShouldBeTrue(); (await Reserved(order)).ShouldBe(0);
            await Export(host, order); provider.Uploads.ShouldBe(1);
        }
        finally { provider.ContinueUpload.TrySetResult(); }
    }

    [Fact]
    public async Task Shipped_reservation_is_not_returned_to_sale_by_status_cancellation()
    {
        var order = await CreateAsync(); var provider = new Provider(); await using var host = Host(provider);
        await Export(host, order);
        using var admin = await Staff.AdminAsync(api);
        foreach (var status in new[] { OrderStatus.Confirmed, OrderStatus.Shipped })
            (await admin.PostJsonAsync($"/api/v1/console/orders/{order.Number}/status", new ChangeOrderStatusRequest(status, "Тест"))).StatusCode.ShouldBe(HttpStatusCode.OK);
        await Cancel(order); await SyncCancellation(host, order);
        (await Reserved(order)).ShouldBe(2);
        var row = await api.WithDbAsync(db => db.Set<StockReservation>().AsNoTracking().SingleAsync(r => r.OrderId == order.Id, Ct));
        row.Consumed.ShouldBeTrue(); row.Released.ShouldBeFalse();
    }

    private sealed class EnabledSettings : INavkoloSettings { public Task<string> GetModeAsync(CancellationToken ct) => Task.FromResult("Stub"); }
    private sealed class Provider : INavkoloClient
    {
        public bool FailCancellation, LoseUploadResponse, PauseUpload, RemoteCancelled;
        public int Uploads, Cancellations;
        public TaskCompletionSource UploadStarted { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource ContinueUpload { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public Task<IReadOnlyList<NavkoloProductRecord>> GetCatalogAsync(CancellationToken ct) => Task.FromResult<IReadOnlyList<NavkoloProductRecord>>([]);
        public Task<IReadOnlyList<PriceStockRecord>> GetPriceStockAsync(CancellationToken ct) => Task.FromResult<IReadOnlyList<PriceStockRecord>>([]);
        public async Task<string> SendOrderAsync(NavkoloOrder order, CancellationToken ct)
        {
            Interlocked.Increment(ref Uploads); UploadStarted.TrySetResult();
            if (PauseUpload) await ContinueUpload.Task.WaitAsync(ct);
            RemoteCancelled = false;
            if (LoseUploadResponse) throw new HttpRequestException("Simulated response loss after remote commit");
            return order.Id!.Value.ToString();
        }
        public Task CancelOrderAsync(Guid orderId, string? reference, CancellationToken ct)
        {
            if (FailCancellation) throw new NavkoloUnavailableException("Simulated ERP outage");
            Interlocked.Increment(ref Cancellations); RemoteCancelled = true; return Task.CompletedTask;
        }
    }
}
