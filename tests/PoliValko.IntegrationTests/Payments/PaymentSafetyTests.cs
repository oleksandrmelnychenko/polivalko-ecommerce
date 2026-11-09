using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Sync;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;
using PoliValko.Ordering.Features.Checkout;
using PoliValko.Payments.Domain;
using PoliValko.Payments.Features.Cancellation;
using PoliValko.Payments.Features.Checkout;
using PoliValko.Payments.Features.Processing;
using PoliValko.Payments.Integrations.Providers;

namespace PoliValko.IntegrationTests;

/// <summary>One order is paid once; money the provider returns is reflected on the order.</summary>
public sealed class PaymentSafetyTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private readonly HttpClient _client = api.CreateClient();

    [Fact]
    public async Task Parallel_pay_clicks_open_one_invoice()
    {
        var created = await CardOrderAsync(510m);

        var starts = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ => StartAsync(created)));

        starts.Select(s => s.PaymentId).Distinct().ShouldHaveSingleItem();
        (await api.WithDbAsync(db => db.Set<Payment>().CountAsync(p => p.OrderNumber == created.Number, Ct))).ShouldBe(1);
    }

    [Fact]
    public async Task Paying_one_invoice_withdraws_the_other_open_one()
    {
        var (created, first, second) = await TwoOpenInvoicesAsync(520m);
        var orderId = await OrderIdAsync(created.Number);

        await PayAsync(first, notify: true);
        (await QueuedAsync(PaymentCancellationRequested.Type, orderId)).ShouldBe(1);
        await api.WithScopeAsync(async services =>
        {
            await services.GetRequiredService<IOutboxHandler<PaymentCancellationRequested>>()
                .HandleAsync(new(orderId, PaymentCancellationReason.OrderPaid), Ct);
            return 0;
        });

        var late = await _client.PostAsJsonAsync($"/api/v1/payments/sandbox/{InvoiceId(second)}/complete", new CompleteSandboxPaymentRequest("success", null), Ct);
        late.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await late.ProblemCodeAsync()).ShouldBe("payments.invoice_closed");
        var withdrawn = await PaymentAsync(second.PaymentId);
        withdrawn.Status.ShouldBe(PaymentAttemptStatus.Expired);
        withdrawn.FailureReason.ShouldBe(CancelOpenPayments.PaidReason);
        (await PaymentAsync(first.PaymentId)).Status.ShouldBe(PaymentAttemptStatus.Succeeded);
    }

    [Fact]
    public async Task Extra_payment_of_a_paid_order_is_flagged_and_reported_once()
    {
        var (created, first, second) = await PaidTwiceAsync(530m);
        var orderId = await OrderIdAsync(created.Number);

        var order = await OrderAsync(orderId);
        order.Status.ShouldBe(OrderStatus.Paid);
        order.PaymentStatus.ShouldBe(PaymentStatus.Succeeded);
        (await PaymentAsync(first.PaymentId)).FailureReason.ShouldBeNull();
        var extra = await PaymentAsync(second.PaymentId);
        extra.Status.ShouldBe(PaymentAttemptStatus.Succeeded);
        extra.FailureReason.ShouldBe(PaymentProcessor.ExtraPaymentNote);
        (await QueuedAsync(FiscalReceiptRequested.Type, orderId)).ShouldBe(1, "чек продажу один, зайва оплата в нього не потрапляє");
        (await QueuedAsync(PaymentSucceeded.Type, orderId)).ShouldBe(1);
        (await AlertsAsync(created.Number)).ShouldContain(a => a.Contains("Зайва оплата"));
    }

    [Fact]
    public async Task Returning_the_extra_payment_leaves_the_order_paid()
    {
        var (created, _, second) = await PaidTwiceAsync(535m);
        var orderId = await OrderIdAsync(created.Number);

        await ReverseAsync(second);

        var returned = await PaymentAsync(second.PaymentId);
        returned.Status.ShouldBe(PaymentAttemptStatus.Reversed);
        returned.FailureReason.ShouldBe(PaymentProcessor.ExtraReturnedNote);
        var order = await OrderAsync(orderId);
        order.PaymentStatus.ShouldBe(PaymentStatus.Succeeded);
        order.RefundedAmount.ShouldBe(0m);
        order.Refunds.ShouldBeEmpty();
        (await AlertsAsync(created.Number)).ShouldContain(a => a.Contains("Зайву оплату"));
    }

    [Fact]
    public async Task Money_returned_outside_the_site_refunds_the_order_and_issues_a_receipt()
    {
        var (created, payment) = await PaidOrderAsync(540m);
        var orderId = await OrderIdAsync(created.Number);

        await ReverseAsync(payment);
        await ReverseAsync(payment);

        var order = await OrderAsync(orderId);
        order.PaymentStatus.ShouldBe(PaymentStatus.Refunded);
        order.RefundedAmount.ShouldBe(540m);
        var refund = order.Refunds.ShouldHaveSingleItem("повторне повідомлення нічого не додає");
        refund.Status.ShouldBe(RefundStatus.Succeeded);
        refund.Method.ShouldBe(RefundMethod.Provider);
        refund.Amount.ShouldBe(540m);
        refund.Lines.ShouldHaveSingleItem().Quantity.ShouldBe(1);
        refund.Reason.ShouldContain("поза сайтом");
        var reversed = await PaymentAsync(payment.PaymentId);
        reversed.Status.ShouldBe(PaymentAttemptStatus.Reversed);
        reversed.FailureReason.ShouldBe(PaymentProcessor.OutsideReturnNote);
        (await QueuedAsync(FiscalReceiptRequested.Type, refund.Id)).ShouldBe(1);
        (await AlertsAsync(created.Number)).ShouldContain(a => a.Contains("повернуто поза сайтом"));
    }

    [Fact]
    public async Task Reversal_that_follows_the_sites_own_refund_changes_nothing()
    {
        var (created, payment) = await PaidOrderAsync(550m);
        var orderId = await OrderIdAsync(created.Number);
        await api.WithDbAsync(async db =>
        {
            var order = await db.Set<Order>().Include(o => o.Items).SingleAsync(o => o.Id == orderId, Ct);
            var item = order.Items.Single();
            var refundId = Guid.CreateVersion7();
            db.Add(new OrderRefund
            {
                Id = refundId,
                OrderId = order.Id,
                Method = RefundMethod.Provider,
                Status = RefundStatus.Pending,
                Amount = item.UnitPrice,
                Reason = "Повернення з консолі, банк ще обробляє",
                RequestedBy = "Тест",
                CreatedAt = DateTimeOffset.UtcNow,
                ProviderRef = refundId.ToString("N"),
                Lines = [new OrderRefundLine { Id = Guid.CreateVersion7(), RefundId = refundId, OrderItemId = item.Id, Quantity = 1, Amount = item.UnitPrice }],
            });
            return await db.SaveChangesAsync(Ct);
        });

        await ReverseAsync(payment);

        var after = await OrderAsync(orderId);
        after.Refunds.ShouldHaveSingleItem().Status.ShouldBe(RefundStatus.Pending, "повернення завершить звірка");
        after.PaymentStatus.ShouldBe(PaymentStatus.Succeeded);
        var reversed = await PaymentAsync(payment.PaymentId);
        reversed.Status.ShouldBe(PaymentAttemptStatus.Reversed);
        reversed.FailureReason.ShouldBeNull();
        (await AlertsAsync(created.Number)).ShouldBeEmpty();
    }

    [Fact]
    public async Task Partial_return_outside_the_site_is_reported_without_guessing_items()
    {
        var (created, payment) = await PaidOrderAsync(560m);
        var orderId = await OrderIdAsync(created.Number);

        await ReverseAsync(payment, remaining: 280m);

        var order = await OrderAsync(orderId);
        order.PaymentStatus.ShouldBe(PaymentStatus.Succeeded);
        order.RefundedAmount.ShouldBe(0m);
        order.Refunds.ShouldBeEmpty();
        (await AlertsAsync(created.Number)).ShouldContain(a => a.Contains("Часткове повернення") && a.Contains("280"));
    }

    private async Task<OrderCreatedDto> CardOrderAsync(decimal price)
    {
        var product = await api.AddProductAsync("ruchnyi-instrument", $"Товар для перевірки оплати {price}", price, stock: 5);
        var body = CheckoutApiTests.Order(product.Id, 1, price.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture), CheckoutApiTests.UniquePhone()) with
        {
            Delivery = new DeliveryRequest(DeliveryCodes.Pickup, null, null),
            Payment = new PaymentRequest(PaymentCodes.Card),
        };
        return await (await _client.PostWithKeyAsync("/api/v1/orders", body)).ReadAsync<OrderCreatedDto>(HttpStatusCode.Created);
    }

    private async Task<(OrderCreatedDto Order, StartPaymentDto Payment)> PaidOrderAsync(decimal price)
    {
        var created = await CardOrderAsync(price);
        var payment = await StartAsync(created);
        await PayAsync(payment, notify: true);
        return (created, payment);
    }

    /// <summary>
    /// Two invoices the provider still accepts. The site no longer opens a second one while the first is active,
    /// but the first can look expired by the site's clock while the provider still takes payment.
    /// </summary>
    private async Task<(OrderCreatedDto Order, StartPaymentDto First, StartPaymentDto Second)> TwoOpenInvoicesAsync(decimal price)
    {
        var created = await CardOrderAsync(price);
        var first = await StartAsync(created);
        await api.WithDbAsync(db => db.Set<Payment>()
            .Where(p => p.Id == first.PaymentId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.ExpiresAt, DateTimeOffset.UtcNow.AddMinutes(-1)), Ct));
        var second = await StartAsync(created);
        second.PaymentId.ShouldNotBe(first.PaymentId);
        return (created, first, second);
    }

    /// <summary>Both invoices paid at the provider before either notification reached the site.</summary>
    private async Task<(OrderCreatedDto Order, StartPaymentDto First, StartPaymentDto Second)> PaidTwiceAsync(decimal price)
    {
        var (created, first, second) = await TwoOpenInvoicesAsync(price);
        await PayAsync(first, notify: false);
        await PayAsync(second, notify: false);
        await DeliverAsync(first);
        await DeliverAsync(second);
        return (created, first, second);
    }

    private async Task<StartPaymentDto> StartAsync(OrderCreatedDto order) =>
        await (await _client.PostWithKeyAsync($"/api/v1/orders/{order.Number}/payments", new StartPaymentRequest(order.AccessToken)))
            .ReadAsync<StartPaymentDto>();

    private async Task PayAsync(StartPaymentDto payment, bool notify) =>
        (await _client.PostAsJsonAsync($"/api/v1/payments/sandbox/{InvoiceId(payment)}/complete", new CompleteSandboxPaymentRequest("success", notify), Ct))
            .StatusCode.ShouldBe(HttpStatusCode.OK);

    private Task DeliverAsync(StartPaymentDto payment) =>
        api.WithScopeAsync(async services =>
        {
            var provider = services.GetRequiredService<IPaymentProviders>().Active!;
            var status = await provider.GetStatusAsync(InvoiceId(payment), Ct);
            await services.GetRequiredService<PaymentProcessor>().ApplyAsync(provider.Name, status, "test", null, Ct);
            return 0;
        });

    private Task ReverseAsync(StartPaymentDto payment, decimal? remaining = null) =>
        api.WithScopeAsync(async services =>
        {
            var status = new ProviderPaymentStatus(InvoiceId(payment), ProviderPaymentState.Reversed, null, DateTimeOffset.UtcNow, null) { RemainingAmount = remaining };
            await services.GetRequiredService<PaymentProcessor>().ApplyAsync(PaymentProviderNames.Sandbox, status, "test", null, Ct);
            return 0;
        });

    private static string InvoiceId(StartPaymentDto payment) => payment.PageUrl[(payment.PageUrl.LastIndexOf('/') + 1)..];

    private Task<Guid> OrderIdAsync(string number) =>
        api.WithDbAsync(db => db.Set<Order>().Where(o => o.Number == number).Select(o => o.Id).SingleAsync(Ct));

    private Task<Order> OrderAsync(Guid orderId) =>
        api.WithDbAsync(db => db.Set<Order>().AsNoTracking().Include(o => o.Refunds).ThenInclude(r => r.Lines).SingleAsync(o => o.Id == orderId, Ct));

    private Task<Payment> PaymentAsync(Guid paymentId) =>
        api.WithDbAsync(db => db.Set<Payment>().AsNoTracking().SingleAsync(p => p.Id == paymentId, Ct));

    private Task<int> QueuedAsync(string type, Guid id) =>
        api.WithDbAsync(async db => (await db.OutboxMessages.Where(m => m.Type == type).Select(m => m.Payload).ToListAsync(Ct))
            .Count(p => p.Contains(id.ToString(), StringComparison.OrdinalIgnoreCase)));

    private Task<List<string>> AlertsAsync(string number) =>
        api.WithDbAsync(async db => (await db.OutboxMessages.Where(m => m.Type == IntegrationAlert.Type).Select(m => m.Payload).ToListAsync(Ct))
            .Where(p => p.Contains(number, StringComparison.Ordinal))
            .ToList());
}
