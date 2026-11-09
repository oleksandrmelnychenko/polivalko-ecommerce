using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Sync;
using PoliValko.Ordering.Contracts;
using PoliValko.Payments.Domain;
using PoliValko.Payments.Features.Processing;
using PoliValko.Payments.Integrations.Providers;

namespace PoliValko.Payments.Features.Refunds;

/// <summary>
/// Sends card refunds to the provider at most once per reference. The reference is stored before the call,
/// so a run that repeats after a crash or timeout asks the provider what happened instead of paying again.
/// </summary>
internal sealed class RefundSettlement(
    PoliValkoDbContext db,
    IOrderPayments orders,
    IPaymentProviders providers,
    IOutbox outbox,
    TimeProvider time,
    ILogger<RefundSettlement> logger)
{
    public async Task SubmitAsync(Guid orderId, Guid refundId, CancellationToken ct)
    {
        var refund = await orders.LoadRefundAsync(orderId, refundId, ct);
        if (refund.Status != RefundStatus.Pending)
        {
            return;
        }

        var (payment, provider) = await FindPaymentAsync(refund.OrderId, ct);
        if (payment is null || provider is null)
        {
            await FailAsync(refund, "Не знайдено успішної оплати або її провайдер вимкнений.", ct);
            return;
        }

        ProviderRefundResult? result = null;
        if (refund.SubmittedAs is { } submitted)
        {
            if (!provider.CanFindRefunds)
            {
                outbox.Enqueue(new IntegrationAlert(
                    $"Повернення за {refund.OrderNumber}: результат невідомий",
                    $"Повернення {refund.Amount:0.00} ₴ уже надсилали провайдеру {provider.Name}, але він не дає перевірити результат. Звірте повернення в кабінеті провайдера; повторно його не надіслано."));
                await db.SaveChangesAsync(ct);
                return;
            }

            result = await provider.FindRefundAsync(payment, submitted, ct);
        }
        else if (!await orders.MarkRefundSubmittedAsync(refund.OrderId, refund.RefundId, Reference(refund.RefundId), ct))
        {
            // Another run claimed the refund between loading and marking it.
            return;
        }

        result ??= await provider.RefundAsync(
            payment,
            refund.SubmittedAs ?? Reference(refund.RefundId),
            refund.Amount,
            refund.Lines.Select(l => new PaymentBasketItem(l.Name, l.Sku, l.Quantity, l.UnitPrice)).ToList(),
            ct);
        await ApplyAsync(refund, result, ct);
    }

    /// <summary>Settles a refund the provider accepted earlier. Never sends it again.</summary>
    public async Task<bool> ReconcileAsync(Guid orderId, Guid refundId, CancellationToken ct)
    {
        var refund = await orders.LoadRefundAsync(orderId, refundId, ct);
        if (refund is not { Status: RefundStatus.Pending, SubmittedAs: { } submitted })
        {
            return false;
        }

        var (payment, provider) = await FindPaymentAsync(refund.OrderId, ct);
        if (payment is null || provider is not { CanFindRefunds: true })
        {
            return false;
        }

        // Not found means the first run has not reached the provider yet; that run, not this one, sends it.
        var result = await provider.FindRefundAsync(payment, submitted, ct);
        return result is { State: not ProviderRefundState.Processing } && await ApplyAsync(refund, result, ct);
    }

    private static string Reference(Guid refundId) => refundId.ToString("N");

    private async Task<(string? Payment, IPaymentProvider? Provider)> FindPaymentAsync(Guid orderId, CancellationToken ct)
    {
        // The invoice that paid for the order: still succeeded, not marked as an extra payment the manager returns by hand.
        var payment = await db.Set<Payment>()
            .AsNoTracking()
            .Where(p => p.OrderId == orderId && (p.Status == PaymentAttemptStatus.Succeeded || p.Status == PaymentAttemptStatus.Reversed))
            .OrderBy(p => p.Status == PaymentAttemptStatus.Succeeded ? 0 : 1)
            .ThenBy(p => p.FailureReason == PaymentProcessor.ExtraPaymentNote ? 1 : 0)
            .ThenByDescending(p => p.CreatedAt)
            .FirstOrDefaultAsync(ct);
        return payment?.ProviderPaymentId is null ? (null, null) : (payment.ProviderPaymentId, providers.Find(payment.Provider));
    }

    private async Task<bool> ApplyAsync(RefundToProcess refund, ProviderRefundResult result, CancellationToken ct)
    {
        switch (result.State)
        {
            case ProviderRefundState.Succeeded:
                if (!await orders.CompleteRefundAsync(refund.OrderId, refund.RefundId, time.GetUtcNow(), ct))
                {
                    return false;
                }

                outbox.Enqueue(new FiscalReceiptRequested(refund.OrderId, FiscalTrigger.Refund, refund.RefundId));
                await db.SaveChangesAsync(ct);
                logger.LogInformation("Повернення {Amount} за {Order} виконано провайдером", refund.Amount, refund.OrderNumber);
                return true;

            case ProviderRefundState.Processing:
                logger.LogInformation("Повернення {Amount} за {Order} провайдер ще обробляє", refund.Amount, refund.OrderNumber);
                return false;

            default:
                return await FailAsync(refund, result.Error ?? "Провайдер відхилив повернення.", ct);
        }
    }

    private async Task<bool> FailAsync(RefundToProcess refund, string error, CancellationToken ct)
    {
        var trimmed = error.Length > 1000 ? error[..1000] : error;
        if (!await orders.FailRefundAsync(refund.OrderId, refund.RefundId, trimmed, time.GetUtcNow(), ct))
        {
            return false;
        }

        outbox.Enqueue(new IntegrationAlert($"Повернення за {refund.OrderNumber} не виконано", trimmed));
        await db.SaveChangesAsync(ct);
        return true;
    }
}
