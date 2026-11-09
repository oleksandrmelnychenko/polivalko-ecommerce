using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Contracts;
using PoliValko.Payments.Domain;
using PoliValko.Payments.Integrations.Providers;

namespace PoliValko.Payments.Features.Cancellation;

/// <summary>
/// Withdraws the open invoices of a cancelled or already paid order so a payment page left open cannot take money.
/// An invoice paid before it could be withdrawn goes through the paid-after-cancel or extra-payment alert.
/// </summary>
internal sealed class CancelOpenPayments(
    PoliValkoDbContext db,
    IPaymentProviders providers,
    TimeProvider time,
    ILogger<CancelOpenPayments> logger) : IOutboxHandler<PaymentCancellationRequested>
{
    public const string CancelledReason = "Рахунок анульовано: замовлення скасовано";

    public const string PaidReason = "Рахунок анульовано: замовлення вже оплачено";

    public async Task HandleAsync(PaymentCancellationRequested message, CancellationToken cancellationToken)
    {
        var reason = message.Reason == PaymentCancellationReason.OrderPaid ? PaidReason : CancelledReason;
        var open = await db.Set<Payment>()
            .AsNoTracking()
            .Where(p => p.OrderId == message.OrderId && (p.Status == PaymentAttemptStatus.Created || p.Status == PaymentAttemptStatus.Processing))
            .ToListAsync(cancellationToken);

        foreach (var payment in open)
        {
            if (payment.ProviderPaymentId is { } invoiceId)
            {
                if (providers.Find(payment.Provider) is not { } provider)
                {
                    logger.LogWarning("Оплата {Order}: провайдер {Provider} вимкнений, рахунок {Invoice} не анульовано", payment.OrderNumber, payment.Provider, invoiceId);
                    continue;
                }

                if (!await provider.CancelInvoiceAsync(invoiceId, cancellationToken))
                {
                    logger.LogWarning("Оплата {Order}: рахунок {Invoice} уже оплачено, анулювати його не можна", payment.OrderNumber, invoiceId);
                    continue;
                }
            }

            var now = time.GetUtcNow();
            // Conditional, so a payment confirmed meanwhile is never overwritten.
            await db.Set<Payment>()
                .Where(p => p.Id == payment.Id && (p.Status == PaymentAttemptStatus.Created || p.Status == PaymentAttemptStatus.Processing))
                .ExecuteUpdateAsync(
                    s => s.SetProperty(p => p.Status, PaymentAttemptStatus.Expired)
                        .SetProperty(p => p.FailureReason, reason)
                        .SetProperty(p => p.UpdatedAt, now),
                    cancellationToken);
        }
    }
}
