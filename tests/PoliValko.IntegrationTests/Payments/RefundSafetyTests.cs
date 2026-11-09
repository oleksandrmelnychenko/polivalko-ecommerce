using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Sync;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;
using PoliValko.Ordering.Features.Checkout;
using PoliValko.Ordering.Features.Console.Orders;
using PoliValko.Payments.Domain;
using PoliValko.Payments.Features.Cancellation;
using PoliValko.Payments.Features.Checkout;
using PoliValko.Payments.Features.Refunds;
using PoliValko.Payments.Integrations.Providers;

namespace PoliValko.IntegrationTests;

public sealed class RefundSafetyTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private readonly HttpClient _client = api.CreateClient();

    [Fact]
    public async Task Parallel_card_refunds_of_one_line_return_money_once()
    {
        var (created, product) = await PaidOrderAsync(700m);
        var admin = await Staff.AdminAsync(api);

        var responses = await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => admin.PostWithKeyAsync(
            $"/api/v1/console/orders/{created.Number}/refunds",
            new CreateRefundRequest([new RefundLineRequest(product.Id, 1)], "Два менеджери натиснули одночасно"))));

        responses.Count(r => r.StatusCode == HttpStatusCode.OK).ShouldBe(1);
        responses.Where(r => r.StatusCode != HttpStatusCode.OK)
            .ShouldAllBe(r => r.StatusCode == HttpStatusCode.BadRequest || r.StatusCode == HttpStatusCode.Conflict);
        var refunds = await api.WithDbAsync(db => db.Set<Order>()
            .Where(o => o.Number == created.Number)
            .SelectMany(o => o.Refunds)
            .ToListAsync(Ct));
        refunds.ShouldHaveSingleItem().Amount.ShouldBe(700m);
    }

    [Fact]
    public async Task Refund_retried_after_lost_response_asks_provider_instead_of_paying_again()
    {
        var (orderId, refundId) = await PaidOrderWithPendingRefundAsync(400m);
        var provider = new ScriptedProvider();
        provider.RefundOutcomes.Enqueue(() => throw new HttpRequestException("Таймаут після того, як банк прийняв запит"));

        await Should.ThrowAsync<HttpRequestException>(() => SubmitAsync(provider, orderId, refundId));
        var pending = await RefundAsync(refundId);
        pending.Status.ShouldBe(RefundStatus.Pending);
        pending.ProviderRef.ShouldBe(refundId.ToString("N"), "посилання записане до запиту в банк");

        provider.Found = ProviderRefundResult.Succeeded;
        await SubmitAsync(provider, orderId, refundId);
        await SubmitAsync(provider, orderId, refundId);

        provider.Refunds.ShouldBe([refundId.ToString("N")], "гроші надіслано один раз");
        (await RefundAsync(refundId)).Status.ShouldBe(RefundStatus.Succeeded);
        (await api.WithDbAsync(db => db.Set<Order>().Where(o => o.Id == orderId).Select(o => o.RefundedAmount).SingleAsync(Ct))).ShouldBe(400m);
        (await FiscalRefundRequestsAsync(refundId)).ShouldBe(1);
    }

    [Fact]
    public async Task Refund_the_provider_never_received_is_sent_again_with_the_same_reference()
    {
        var (orderId, refundId) = await PaidOrderWithPendingRefundAsync(410m);
        var provider = new ScriptedProvider();
        provider.RefundOutcomes.Enqueue(() => throw new HttpRequestException("Банк недоступний"));
        provider.RefundOutcomes.Enqueue(() => ProviderRefundResult.Succeeded);

        await Should.ThrowAsync<HttpRequestException>(() => SubmitAsync(provider, orderId, refundId));
        await SubmitAsync(provider, orderId, refundId);

        provider.Refunds.ShouldBe([refundId.ToString("N"), refundId.ToString("N")]);
        (await RefundAsync(refundId)).Status.ShouldBe(RefundStatus.Succeeded);
        (await FiscalRefundRequestsAsync(refundId)).ShouldBe(1);
    }

    [Fact]
    public async Task Processing_refund_stays_pending_until_the_provider_finishes_it()
    {
        var (orderId, refundId) = await PaidOrderWithPendingRefundAsync(420m);
        var provider = new ScriptedProvider();
        provider.RefundOutcomes.Enqueue(() => ProviderRefundResult.Processing);

        await SubmitAsync(provider, orderId, refundId);
        (await RefundAsync(refundId)).Status.ShouldBe(RefundStatus.Pending);
        (await api.WithDbAsync(db => db.Set<Order>().Where(o => o.Id == orderId).Select(o => o.PaymentStatus).SingleAsync(Ct))).ShouldBe(PaymentStatus.Succeeded);
        (await FiscalRefundRequestsAsync(refundId)).ShouldBe(0, "чек повернення лише після фактичного повернення");

        provider.Found = ProviderRefundResult.Processing;
        (await ReconcileAsync(provider, orderId, refundId)).ShouldBeFalse();

        provider.Found = ProviderRefundResult.Succeeded;
        (await ReconcileAsync(provider, orderId, refundId)).ShouldBeTrue();
        (await ReconcileAsync(provider, orderId, refundId)).ShouldBeFalse();

        provider.Refunds.Count.ShouldBe(1);
        (await RefundAsync(refundId)).Status.ShouldBe(RefundStatus.Succeeded);
        (await FiscalRefundRequestsAsync(refundId)).ShouldBe(1);
    }

    [Fact]
    public async Task Refund_rejected_after_processing_is_marked_failed_and_reported()
    {
        var (orderId, refundId) = await PaidOrderWithPendingRefundAsync(430m);
        var provider = new ScriptedProvider();
        provider.RefundOutcomes.Enqueue(() => ProviderRefundResult.Processing);
        await SubmitAsync(provider, orderId, refundId);

        provider.Found = ProviderRefundResult.Failed("Банк відхилив повернення");
        (await ReconcileAsync(provider, orderId, refundId)).ShouldBeTrue();

        var refund = await RefundAsync(refundId);
        refund.Status.ShouldBe(RefundStatus.Failed);
        refund.Error.ShouldBe("Банк відхилив повернення");
        (await api.WithDbAsync(db => db.Set<Order>().Where(o => o.Id == orderId).Select(o => o.RefundedAmount).SingleAsync(Ct))).ShouldBe(0m);
        (await AlertsAsync(orderId)).ShouldContain(a => a.Contains("не виконано"));
    }

    [Fact]
    public async Task Provider_that_cannot_look_up_refunds_is_never_asked_to_pay_twice()
    {
        var (orderId, refundId) = await PaidOrderWithPendingRefundAsync(440m);
        var provider = new ScriptedProvider { CanFindRefunds = false };
        provider.RefundOutcomes.Enqueue(() => throw new HttpRequestException("Таймаут"));

        await Should.ThrowAsync<HttpRequestException>(() => SubmitAsync(provider, orderId, refundId));
        await SubmitAsync(provider, orderId, refundId);

        provider.Refunds.Count.ShouldBe(1);
        (await RefundAsync(refundId)).Status.ShouldBe(RefundStatus.Pending);
        (await AlertsAsync(orderId)).ShouldContain(a => a.Contains("результат невідомий"));
    }

    [Fact]
    public async Task Cancelling_an_order_withdraws_its_open_invoice()
    {
        var created = await CardOrderAsync(330m);
        var start = await StartAsync(created);
        var admin = await Staff.AdminAsync(api);
        (await admin.PostAsJsonAsync($"/api/v1/console/orders/{created.Number}/status", new { status = "cancelled", reason = "Покупець передумав" }, Ct))
            .StatusCode.ShouldBe(HttpStatusCode.OK);
        var orderId = await api.WithDbAsync(db => db.Set<Order>().Where(o => o.Number == created.Number).Select(o => o.Id).SingleAsync(Ct));
        await api.WithScopeAsync(async services =>
        {
            await services.GetRequiredService<IOutboxHandler<PaymentCancellationRequested>>().HandleAsync(new(orderId), Ct);
            return 0;
        });

        var late = await _client.PostAsJsonAsync($"/api/v1/payments/sandbox/{InvoiceId(start)}/complete", new CompleteSandboxPaymentRequest("success", null), Ct);
        late.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await late.ProblemCodeAsync()).ShouldBe("payments.invoice_closed");

        var payment = await api.WithDbAsync(db => db.Set<Payment>().SingleAsync(p => p.Id == start.PaymentId, Ct));
        payment.Status.ShouldBe(PaymentAttemptStatus.Expired);
        payment.FailureReason.ShouldBe(CancelOpenPayments.CancelledReason);
        var order = await api.WithDbAsync(db => db.Set<Order>().SingleAsync(o => o.Id == orderId, Ct));
        order.Status.ShouldBe(OrderStatus.Cancelled);
        order.PaymentStatus.ShouldBe(PaymentStatus.Pending);
        var requests = await api.WithDbAsync(db => db.OutboxMessages.Where(m => m.Type == PaymentCancellationRequested.Type).Select(m => m.Payload).ToListAsync(Ct));
        requests.Count(p => p.Contains(orderId.ToString(), StringComparison.OrdinalIgnoreCase)).ShouldBe(1, "скасування в консолі саме ставить анулювання в чергу");
    }

    private async Task<OrderCreatedDto> CardOrderAsync(decimal price)
    {
        var product = await api.AddProductAsync("ruchnyi-instrument", $"Товар для безпечного повернення {price}", price, stock: 5);
        return await PlaceCardOrderAsync(product, price);
    }

    private async Task<(OrderCreatedDto Order, Product Product)> PaidOrderAsync(decimal price)
    {
        var product = await api.AddProductAsync("ruchnyi-instrument", $"Товар для безпечного повернення {price}", price, stock: 5);
        var created = await PlaceCardOrderAsync(product, price);
        var start = await StartAsync(created);
        (await _client.PostAsJsonAsync($"/api/v1/payments/sandbox/{InvoiceId(start)}/complete", new CompleteSandboxPaymentRequest("success", null), Ct))
            .StatusCode.ShouldBe(HttpStatusCode.OK);
        return (created, product);
    }

    private async Task<OrderCreatedDto> PlaceCardOrderAsync(Product product, decimal price)
    {
        var body = CheckoutApiTests.Order(product.Id, 1, price.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture), CheckoutApiTests.UniquePhone()) with
        {
            Delivery = new DeliveryRequest(DeliveryCodes.Pickup, null, null),
            Payment = new PaymentRequest(PaymentCodes.Card),
        };
        return await (await _client.PostWithKeyAsync("/api/v1/orders", body)).ReadAsync<OrderCreatedDto>(HttpStatusCode.Created);
    }

    private async Task<StartPaymentDto> StartAsync(OrderCreatedDto order) =>
        await (await _client.PostWithKeyAsync($"/api/v1/orders/{order.Number}/payments", new StartPaymentRequest(order.AccessToken)))
            .ReadAsync<StartPaymentDto>();

    private static string InvoiceId(StartPaymentDto payment) => payment.PageUrl[(payment.PageUrl.LastIndexOf('/') + 1)..];

    // The refund row is written directly: a RefundRequested message would let a parallel test's outbox run settle it first.
    private async Task<(Guid OrderId, Guid RefundId)> PaidOrderWithPendingRefundAsync(decimal price)
    {
        var (created, _) = await PaidOrderAsync(price);
        return await api.WithDbAsync(async db =>
        {
            var order = await db.Set<Order>().Include(o => o.Items).SingleAsync(o => o.Number == created.Number, Ct);
            var item = order.Items.Single();
            var refundId = Guid.CreateVersion7();
            db.Add(new OrderRefund
            {
                Id = refundId,
                OrderId = order.Id,
                Method = RefundMethod.Provider,
                Status = RefundStatus.Pending,
                Amount = item.UnitPrice,
                Reason = "Перевірка повторної обробки",
                RequestedBy = "Тест",
                CreatedAt = DateTimeOffset.UtcNow,
                Lines = [new OrderRefundLine { Id = Guid.CreateVersion7(), RefundId = refundId, OrderItemId = item.Id, Quantity = 1, Amount = item.UnitPrice }],
            });
            await db.SaveChangesAsync(Ct);
            return (order.Id, refundId);
        });
    }

    private Task SubmitAsync(ScriptedProvider provider, Guid orderId, Guid refundId) =>
        api.WithScopeAsync(async services =>
        {
            await Settlement(services, provider).SubmitAsync(orderId, refundId, Ct);
            return 0;
        });

    private Task<bool> ReconcileAsync(ScriptedProvider provider, Guid orderId, Guid refundId) =>
        api.WithScopeAsync(services => Settlement(services, provider).ReconcileAsync(orderId, refundId, Ct));

    private static RefundSettlement Settlement(IServiceProvider services, ScriptedProvider provider) => new(
        services.GetRequiredService<PoliValkoDbContext>(),
        services.GetRequiredService<IOrderPayments>(),
        provider,
        services.GetRequiredService<IOutbox>(),
        TimeProvider.System,
        NullLogger<RefundSettlement>.Instance);

    private Task<OrderRefund> RefundAsync(Guid refundId) =>
        api.WithDbAsync(db => db.Set<OrderRefund>().AsNoTracking().SingleAsync(r => r.Id == refundId, Ct));

    private Task<int> FiscalRefundRequestsAsync(Guid refundId) =>
        api.WithDbAsync(async db => (await db.OutboxMessages.Where(m => m.Type == FiscalReceiptRequested.Type).Select(m => m.Payload).ToListAsync(Ct))
            .Count(p => p.Contains(refundId.ToString(), StringComparison.OrdinalIgnoreCase)));

    private Task<List<string>> AlertsAsync(Guid orderId) =>
        api.WithDbAsync(async db =>
        {
            var number = await db.Set<Order>().Where(o => o.Id == orderId).Select(o => o.Number).SingleAsync(Ct);
            return (await db.OutboxMessages.Where(m => m.Type == IntegrationAlert.Type).Select(m => m.Payload).ToListAsync(Ct))
                .Where(p => p.Contains(number, StringComparison.Ordinal))
                .ToList();
        });

    /// <summary>Stands in for the provider of a sandbox payment and records every refund it is asked to send.</summary>
    private sealed class ScriptedProvider : IPaymentProvider, IPaymentProviders
    {
        public string Name => PaymentProviderNames.Sandbox;

        public bool CanFindRefunds { get; init; } = true;

        public Queue<Func<ProviderRefundResult>> RefundOutcomes { get; } = new();

        public List<string> Refunds { get; } = [];

        public ProviderRefundResult? Found { get; set; }

        public IPaymentProvider Active => this;

        public IPaymentProvider Find(string name) => this;

        public Task<ProviderRefundResult> RefundAsync(string providerPaymentId, string reference, decimal amount, IReadOnlyList<PaymentBasketItem> items, CancellationToken ct)
        {
            Refunds.Add(reference);
            return Task.FromResult(RefundOutcomes.Dequeue()());
        }

        public Task<ProviderRefundResult?> FindRefundAsync(string providerPaymentId, string reference, CancellationToken ct) =>
            CanFindRefunds ? Task.FromResult(Found) : throw new NotSupportedException();

        public Task<CreatedInvoice> CreateInvoiceAsync(InvoiceRequest request, CancellationToken ct) => throw new NotSupportedException();

        public Task<ProviderPaymentStatus> GetStatusAsync(string providerPaymentId, CancellationToken ct) => throw new NotSupportedException();

        public Task<ProviderPaymentStatus> ParseWebhookAsync(byte[] body, IHeaderDictionary headers, CancellationToken ct) => throw new NotSupportedException();

        public Task<bool> CancelInvoiceAsync(string providerPaymentId, CancellationToken ct) => throw new NotSupportedException();
    }
}
