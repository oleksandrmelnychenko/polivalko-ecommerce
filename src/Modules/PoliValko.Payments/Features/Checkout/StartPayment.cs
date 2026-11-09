using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;
using PoliValko.Infrastructure.Web;
using PoliValko.Ordering.Contracts;
using PoliValko.Payments.Configuration;
using PoliValko.Payments.Domain;
using PoliValko.Payments.Integrations.Providers;

namespace PoliValko.Payments.Features.Checkout;

internal static class StartPayment
{
    public static async Task<Results<Ok<StartPaymentDto>, ProblemHttpResult>> HandleAsync(
        string number,
        StartPaymentRequest request,
        PoliValkoDbContext db,
        [FromServices] IOrderPayments orders,
        IPaymentProviders providers,
        IOptions<PaymentsOptions> options,
        IOptions<SiteOptions> site,
        TimeProvider time,
        ILoggerFactory loggers,
        CancellationToken ct)
    {
        var order = await orders.FindPayableAsync(number, request.Token, ct);
        if (order is null)
        {
            return OrderProblems.NotFound();
        }

        var returnUrl = site.Value.Url($"/order/{order.Number}?token={Uri.EscapeDataString(request.Token!)}&payment=return");
        return await StartAsync(order, returnUrl, db, orders, providers, options, site, time, loggers, ct);
    }

    public static async Task<Results<Ok<StartPaymentDto>, ProblemHttpResult>> StartAsync(
        PayableOrder order,
        string returnUrl,
        PoliValkoDbContext db,
        IOrderPayments orders,
        IPaymentProviders providers,
        IOptions<PaymentsOptions> options,
        IOptions<SiteOptions> site,
        TimeProvider time,
        ILoggerFactory loggers,
        CancellationToken ct)
    {
        if (!order.CanPay)
        {
            return NotPayable(order);
        }

        if (providers.Active is not { } provider)
        {
            return Problems.Create(StatusCodes.Status503ServiceUnavailable, "payments.not_configured", "Онлайн-оплата тимчасово недоступна", "Зверніться до менеджера.");
        }

        // One payment start per order at a time, invoice call included: a second click (another tab, a double tap)
        // waits here and then reuses the invoice the first one opened. A cancellation waits too, so it sees that invoice.
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        order = await orders.LockPayableAsync(order.Id, ct);
        if (!order.CanPay)
        {
            return NotPayable(order);
        }

        var now = time.GetUtcNow();

        var active = await db.Set<Payment>()
            .Where(p => p.OrderId == order.Id && p.Provider == provider.Name
                        && (p.Status == PaymentAttemptStatus.Created || p.Status == PaymentAttemptStatus.Processing)
                        && p.ExpiresAt > now && p.PageUrl != null)
            .OrderByDescending(p => p.CreatedAt)
            .FirstOrDefaultAsync(ct);
        if (active is not null)
        {
            return TypedResults.Ok(new StartPaymentDto(active.Id, active.PageUrl!, active.ExpiresAt));
        }

        var payment = new Payment
        {
            Id = Guid.CreateVersion7(now),
            OrderId = order.Id,
            OrderNumber = order.Number,
            Provider = provider.Name,
            Amount = order.Total,
            Status = PaymentAttemptStatus.Created,
            CreatedAt = now,
            UpdatedAt = now,
            ExpiresAt = now + options.Value.InvoiceValidity,
        };
        db.Add(payment);
        await orders.MarkPaymentRetryAsync(order.Id, ct);
        await db.SaveChangesAsync(ct);

        try
        {
            var invoice = await provider.CreateInvoiceAsync(
                new InvoiceRequest(
                    payment.Id,
                    order.Number,
                    payment.Amount,
                    order.Items.Select(i => new PaymentBasketItem(i.Name, i.Sku, i.Quantity, i.UnitPrice)).ToList(),
                    returnUrl,
                    site.Value.Url($"/api/v1/payments/webhooks/{provider.Name}"),
                    payment.ExpiresAt),
                ct);
            payment.ProviderPaymentId = invoice.ProviderPaymentId;
            payment.PageUrl = invoice.PageUrl;
            payment.UpdatedAt = time.GetUtcNow();
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return TypedResults.Ok(new StartPaymentDto(payment.Id, invoice.PageUrl, payment.ExpiresAt));
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or InvalidOperationException && !ct.IsCancellationRequested)
        {
            loggers.CreateLogger(typeof(StartPayment)).LogError(ex, "Оплата: провайдер {Provider} не створив рахунок для {Order}", provider.Name, order.Number);
            payment.Status = PaymentAttemptStatus.Failed;
            payment.FailureReason = "Провайдер недоступний";
            await db.SaveChangesAsync(CancellationToken.None);
            await transaction.CommitAsync(CancellationToken.None);
            return Problems.Create(StatusCodes.Status503ServiceUnavailable, "payments.provider_unavailable", "Платіжна система недоступна", "Спробуйте ще раз за кілька хвилин.");
        }
    }

    private static ProblemHttpResult NotPayable(PayableOrder order) => Problems.Create(
        StatusCodes.Status409Conflict,
        "payments.not_payable",
        "Оплата зараз недоступна",
        order.PaymentMethod == PaymentMethod.Card
            ? "Замовлення ще не підтверджене, уже оплачене або скасоване."
            : "Для цього замовлення обрано оплату під час отримання.");
}
