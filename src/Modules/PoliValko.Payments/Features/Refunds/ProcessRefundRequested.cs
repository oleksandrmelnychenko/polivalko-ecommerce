using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Sync;
using PoliValko.Ordering.Contracts;
using PoliValko.Payments.Domain;
using PoliValko.Payments.Integrations.Providers;

namespace PoliValko.Payments.Features.Refunds;

internal sealed class ProcessRefundRequested(
    PoliValkoDbContext db,
    IOrderPayments orders,
    IPaymentProviders providers,
    IOutbox outbox,
    TimeProvider time,
    ILogger<ProcessRefundRequested> logger) : IOutboxHandler<RefundRequested>
{
    public async Task HandleAsync(RefundRequested message, CancellationToken cancellationToken)
    {
        var refund = await orders.LoadRefundAsync(message.OrderId, message.RefundId, cancellationToken);
        if (refund.Status != RefundStatus.Pending)
        {
            return;
        }

        var payment = await db.Set<Payment>()
            .Where(p => p.OrderId == refund.OrderId && (p.Status == PaymentAttemptStatus.Succeeded || p.Status == PaymentAttemptStatus.Reversed))
            .OrderByDescending(p => p.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        var provider = payment is null ? null : providers.Find(payment.Provider);
        if (payment?.ProviderPaymentId is null || provider is null)
        {
            await FailAsync(refund, "Не знайдено успішної оплати або її провайдер вимкнений.", cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            return;
        }

        var basket = refund.Lines
            .Select(l => new PaymentBasketItem(l.Name, l.Sku, l.Quantity, l.UnitPrice))
            .ToList();
        var result = await provider.RefundAsync(payment.ProviderPaymentId, refund.RefundId, refund.Amount, basket, cancellationToken);

        if (result.Accepted)
        {
            await orders.CompleteRefundAsync(refund.OrderId, refund.RefundId, result.ProviderRef, time.GetUtcNow(), cancellationToken);
            outbox.Enqueue(new FiscalReceiptRequested(refund.OrderId, FiscalTrigger.Refund, refund.RefundId));
            logger.LogInformation("Повернення {Amount} за {Order} прийнято провайдером", refund.Amount, refund.OrderNumber);
        }
        else
        {
            await FailAsync(refund, result.Error ?? "Провайдер відхилив повернення.", cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task FailAsync(RefundToProcess refund, string error, CancellationToken ct)
    {
        var trimmed = error.Length > 1000 ? error[..1000] : error;
        await orders.FailRefundAsync(refund.OrderId, refund.RefundId, trimmed, time.GetUtcNow(), ct);
        outbox.Enqueue(new IntegrationAlert($"Повернення за {refund.OrderNumber} не виконано", trimmed));
    }
}
