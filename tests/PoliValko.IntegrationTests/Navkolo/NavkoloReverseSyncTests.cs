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
using PoliValko.Navkolo.Features.OrderSync;
using PoliValko.Navkolo.Integrations.NavkoloApi;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;
using PoliValko.Ordering.Features.Checkout;
using PoliValko.Ordering.Features.Console.Orders;

namespace PoliValko.IntegrationTests;

public sealed class NavkoloReverseSyncTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;
    private sealed record TestOrder(Guid Id, Guid ProductId, string ProductRef, string Number);

    private async Task<TestOrder> CreateAsync(bool paid = false, bool attempted = true)
    {
        var product = await api.AddProductAsync("vse-dlia-polyvu", "Зворотна синхронізація", 100, 5);
        using var client = api.CreateClient();
        var body = CheckoutApiTests.Order(product.Id, 2, "200.00", CheckoutApiTests.UniquePhone());
        if (paid) body = body with { Payment = new PaymentRequest("card") };
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/orders") { Content = JsonContent.Create(body, options: TestJson.Options) };
        request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString());
        var created = await (await client.SendAsync(request, Ct)).ReadAsync<OrderCreatedDto>(HttpStatusCode.Created);
        var id = await api.WithDbAsync(async db =>
        {
            var order = await db.Set<Order>().SingleAsync(o => o.Number == created.Number, Ct);
            if (paid) order.MarkPaid(DateTimeOffset.UtcNow, "Тест оплати");
            await db.SaveChangesAsync(Ct);
            return order.Id;
        });
        if (attempted)
        {
            await using var scope = api.Services.CreateAsyncScope();
            (await scope.ServiceProvider.GetRequiredService<IOrderExportSource>().BeginExportAsync(id, DateTimeOffset.UtcNow, Ct)).ShouldBeTrue();
        }
        return new(id, product.Id, product.NavkoloId, created.Number);
    }

    private WebApplicationFactory<Program> Host(Provider provider) => api.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
    {
        services.RemoveAll<INavkoloClient>(); services.AddSingleton<INavkoloClient>(provider);
        services.RemoveAll<INavkoloSettings>(); services.AddSingleton<INavkoloSettings>(new EnabledSettings());
    }));
    private static async Task Sync(WebApplicationFactory<Program> host)
    {
        await using var scope = host.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<NavkoloInventorySync>().RunAsync(Ct);
    }
    private Task<Order> Saved(TestOrder order) => api.WithDbAsync(db => db.Set<Order>().AsNoTracking().Include(o => o.History).SingleAsync(o => o.Id == order.Id, Ct));
    private async Task Stock(TestOrder order, decimal raw, decimal reserved)
    {
        var stock = await api.WithDbAsync(db => db.Set<ProductStock>().AsNoTracking().SingleAsync(p => p.ProductId == order.ProductId, Ct));
        stock.Quantity.ShouldBe(raw); stock.ReservedQuantity.ShouldBe(reserved);
    }
    private static Provider Remote(TestOrder order, bool shipped = false, bool cancelled = false) => new()
    {
        States = [new(order.Id, shipped, cancelled)], Stock = [new(order.ProductRef, 100, null, shipped ? 3 : 5)]
    };

    [Fact]
    public async Task Remote_cancellation_releases_once_has_history_and_no_echo_or_late_export()
    {
        var order = await CreateAsync(); var provider = Remote(order, cancelled: true); await using var host = Host(provider);
        await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => Sync(host)));
        var saved = await Saved(order);
        saved.Status.ShouldBe(OrderStatus.Cancelled); saved.NavkoloCancellationSynchronizedAt.ShouldNotBeNull();
        saved.NavkoloCancellationRequestedAt.ShouldBeNull(); saved.History.Count(h => h.By == "Навколо").ShouldBe(1);
        await Stock(order, 5, 0);
        var messages = await api.WithDbAsync(db => db.OutboxMessages.Where(m => m.Type == OrderCancellationRequested.Type).Select(m => m.Payload).ToListAsync(Ct));
        messages.ShouldNotContain(p => p.Contains(order.Id.ToString(), StringComparison.OrdinalIgnoreCase));
        await using var scope = host.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<IOutboxHandler<OrderExportRequested>>().HandleAsync(new(order.Id), Ct);
        await scope.ServiceProvider.GetRequiredService<IOutboxHandler<OrderCancellationRequested>>().HandleAsync(new(order.Id), Ct);
        provider.Writes.ShouldBe(0);
    }

    [Fact]
    public async Task Shipment_updates_console_and_consumes_reservation_against_fresh_stock_only_once()
    {
        var order = await CreateAsync(); var provider = Remote(order, shipped: true); await using var host = Host(provider);
        await Sync(host); await Sync(host);
        await Stock(order, 3, 0);
        var reservation = await api.WithDbAsync(db => db.Set<StockReservation>().AsNoTracking().SingleAsync(r => r.OrderId == order.Id, Ct));
        reservation.Consumed.ShouldBeTrue(); reservation.Released.ShouldBeTrue();
        var saved = await Saved(order); saved.Status.ShouldBe(OrderStatus.Shipped); saved.History.Count(h => h.By == "Навколо").ShouldBe(1);
        using var admin = await Staff.AdminAsync(api);
        var dto = await (await admin.GetAsync($"/api/v1/console/orders/{order.Number}", Ct)).ReadAsync<ConsoleOrderDto>();
        dto.Status.ShouldBe(OrderStatus.Shipped); dto.NavkoloShippedAt.ShouldNotBeNull();
        provider.States = []; await Sync(host); (await Saved(order)).Status.ShouldBe(OrderStatus.Shipped);
    }

    [Fact]
    public async Task Paid_remote_cancellation_keeps_payment_and_refund_available()
    {
        var order = await CreateAsync(paid: true); await using var host = Host(Remote(order, cancelled: true));
        await Sync(host); await Stock(order, 5, 0);
        using var admin = await Staff.AdminAsync(api);
        var dto = await (await admin.GetAsync($"/api/v1/console/orders/{order.Number}", Ct)).ReadAsync<ConsoleOrderDto>();
        dto.Status.ShouldBe(OrderStatus.Cancelled); dto.PaymentStatus.ShouldBe(PaymentStatus.Succeeded);
        dto.RefundMethod.ShouldBe(RefundMethod.Provider); dto.Refunds.ShouldBeEmpty();
    }

    [Fact]
    public async Task Shipment_after_cancellation_records_conflict_without_resurrection_or_double_release()
    {
        var order = await CreateAsync(); var provider = Remote(order, cancelled: true); await using var host = Host(provider);
        await Sync(host); await Stock(order, 5, 0);
        provider.States = [new(order.Id, true, false)]; provider.Stock = [new(order.ProductRef, 100, null, 3)];
        await Sync(host); await Sync(host); await Stock(order, 3, 0);
        var saved = await Saved(order); saved.Status.ShouldBe(OrderStatus.Cancelled); saved.NavkoloShippedAt.ShouldNotBeNull();
        saved.History.Count(h => h.By == "Навколо").ShouldBe(2);
        saved.History.ShouldContain(h => h.Reason != null && h.Reason.Contains("Конфлікт", StringComparison.Ordinal));
        var reservation = await api.WithDbAsync(db => db.Set<StockReservation>().AsNoTracking().SingleAsync(r => r.OrderId == order.Id, Ct));
        reservation.Consumed.ShouldBeTrue(); reservation.Released.ShouldBeTrue();
    }

    [Fact]
    public async Task Cancellation_after_completed_shipment_preserves_completion_and_physical_stock()
    {
        var order = await CreateAsync(); var provider = Remote(order, shipped: true); await using var host = Host(provider);
        await Sync(host);
        using var admin = await Staff.AdminAsync(api);
        (await admin.PostJsonAsync($"/api/v1/console/orders/{order.Number}/status", new ChangeOrderStatusRequest(OrderStatus.Completed, "Отримано"))).StatusCode.ShouldBe(HttpStatusCode.OK);
        provider.States = [new(order.Id, false, true)]; await Sync(host); await Sync(host);
        var saved = await Saved(order); saved.Status.ShouldBe(OrderStatus.Completed); saved.NavkoloCancelledAt.ShouldNotBeNull();
        await Stock(order, 3, 0);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Failed_or_incomplete_stock_snapshot_rolls_back_status_history_and_reservation(bool fail)
    {
        var order = await CreateAsync(); var provider = Remote(order, shipped: true); await using var host = Host(provider);
        provider.FailStock = fail; if (!fail) provider.Stock = [];
        await Should.ThrowAsync<Exception>(() => Sync(host));
        await Stock(order, 5, 2); var saved = await Saved(order);
        saved.Status.ShouldBe(OrderStatus.New); saved.NavkoloShippedAt.ShouldBeNull(); saved.History.ShouldNotContain(h => h.By == "Навколо");
        provider.FailStock = false; provider.Stock = [new(order.ProductRef, 100, null, 3)];
        await Sync(host); await Stock(order, 3, 0);
    }

    [Fact]
    public async Task Unexported_or_unknown_remote_ids_do_not_change_local_orders()
    {
        var order = await CreateAsync(attempted: false); var provider = Remote(order, cancelled: true);
        provider.States = [.. provider.States, new(Guid.NewGuid(), true, false)]; await using var host = Host(provider);
        await Sync(host); (await Saved(order)).Status.ShouldBe(OrderStatus.New); await Stock(order, 5, 2);
    }

    [Fact]
    public async Task Local_cancellation_waiting_during_reverse_sync_cannot_double_release()
    {
        var order = await CreateAsync(); var provider = Remote(order, cancelled: true); provider.PauseStock = true;
        await using var host = Host(provider); using var admin = await Staff.AdminAsync(api);
        var syncing = Sync(host); await provider.StockStarted.Task.WaitAsync(TimeSpan.FromSeconds(30), Ct);
        try
        {
            var cancelling = admin.PostJsonAsync($"/api/v1/console/orders/{order.Number}/status", new ChangeOrderStatusRequest(OrderStatus.Cancelled, "Одночасно"));
            provider.ContinueStock.TrySetResult();
            await syncing; (await cancelling).StatusCode.ShouldBe(HttpStatusCode.Conflict);
            await Stock(order, 5, 0);
        }
        finally { provider.ContinueStock.TrySetResult(); }
    }

    [Fact]
    public async Task Import_validation_failure_rolls_back_already_written_stock()
    {
        var order = await CreateAsync(); var provider = Remote(order, shipped: true);
        provider.Stock = [.. provider.Stock, new("unknown-product", 100, null, 1)];
        await using var host = Host(provider);
        await Should.ThrowAsync<NavkoloUnavailableException>(() => Sync(host));
        await Stock(order, 5, 2); (await Saved(order)).NavkoloShippedAt.ShouldBeNull();
    }

    [Fact]
    public async Task Snapshot_is_refreshed_after_in_flight_export_finishes()
    {
        var order = await CreateAsync(); var provider = Remote(order, cancelled: true); provider.PauseUpload = true;
        await using var host = Host(provider); await using var scope = host.Services.CreateAsyncScope();
        var exporting = scope.ServiceProvider.GetRequiredService<IOutboxHandler<OrderExportRequested>>().HandleAsync(new(order.Id), Ct);
        await provider.UploadStarted.Task.WaitAsync(TimeSpan.FromSeconds(30), Ct);
        try
        {
            var syncing = Sync(host);
            await provider.StateRead.Task.WaitAsync(TimeSpan.FromSeconds(30), Ct);
            provider.ContinueUpload.TrySetResult();
            await Task.WhenAll(exporting, syncing);
            var saved = await Saved(order); saved.Status.ShouldBe(OrderStatus.New); saved.NavkoloCancelledAt.ShouldBeNull();
            await Stock(order, 5, 2);
        }
        finally { provider.ContinueUpload.TrySetResult(); }
    }

    private sealed class EnabledSettings : INavkoloSettings { public Task<string> GetModeAsync(CancellationToken ct) => Task.FromResult("Stub"); }
    private sealed class Provider : INavkoloClient
    {
        public IReadOnlyList<ExternalOrderState> States = [];
        public IReadOnlyList<PriceStockRecord> Stock = [];
        public bool FailStock, PauseStock, PauseUpload;
        public int Writes;
        public TaskCompletionSource StockStarted { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource ContinueStock { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource UploadStarted { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource ContinueUpload { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource StateRead { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public Task<IReadOnlyList<ExternalOrderState>> GetOrderStatesAsync(CancellationToken ct)
        {
            var snapshot = States.ToArray(); StateRead.TrySetResult();
            return Task.FromResult<IReadOnlyList<ExternalOrderState>>(snapshot);
        }
        public Task<IReadOnlyList<NavkoloProductRecord>> GetCatalogAsync(CancellationToken ct) => throw new NotSupportedException();
        public async Task<IReadOnlyList<PriceStockRecord>> GetPriceStockAsync(CancellationToken ct)
        {
            StockStarted.TrySetResult(); if (PauseStock) await ContinueStock.Task.WaitAsync(ct);
            if (FailStock) throw new NavkoloUnavailableException("Тест збою залишків");
            return Stock;
        }
        public async Task<string> SendOrderAsync(NavkoloOrder order, CancellationToken ct)
        {
            Writes++; UploadStarted.TrySetResult();
            if (PauseUpload) { await ContinueUpload.Task.WaitAsync(ct); States = []; }
            return order.Id!.Value.ToString();
        }
        public Task CancelOrderAsync(Guid orderId, string? reference, CancellationToken ct) { Writes++; return Task.CompletedTask; }
    }
}
