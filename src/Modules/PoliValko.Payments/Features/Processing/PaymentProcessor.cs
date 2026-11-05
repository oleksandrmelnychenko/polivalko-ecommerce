using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Sync;
using PoliValko.Ordering.Contracts;
using PoliValko.Payments.Domain;
using PoliValko.Payments.Integrations.Providers;

namespace PoliValko.Payments.Features.Processing;

internal sealed class PaymentProcessor(PoliValkoDbContext db, IOrderPayments orders, IOutbox outbox, TimeProvider time, ILogger<PaymentProcessor> logger)
{
    public async Task<PaymentUpdateResult> ApplyAsync(string provider, ProviderPaymentStatus status, string source, string? payload, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var now = time.GetUtcNow();

        var payment = await db.Set<Payment>().FirstOrDefaultAsync(p => p.Provider == provider && p.ProviderPaymentId == status.ProviderPaymentId, ct);
        var inserted = await db.Database.ExecuteSqlAsync(
            $"""
            INSERT INTO payments.payment_events (id, provider, event_key, payment_id, source, state, received_at, payload)
            VALUES ({Guid.CreateVersion7(now)}, {provider}, {status.EventKey}, {payment?.Id}, {source}, {status.State.ToString()}, {now}, {payload}::jsonb)
            ON CONFLICT (provider, event_key) DO NOTHING
            """,
            ct);
        if (inserted == 0)
        {
            return PaymentUpdateResult.Duplicate;
        }

        if (payment is null)
        {
            logger.LogWarning("Оплата: повідомлення {Provider} для невідомого рахунку {Invoice}", provider, status.ProviderPaymentId);
            await transaction.CommitAsync(ct);
            return PaymentUpdateResult.UnknownPayment;
        }

        if (status.ModifiedAt is { } modified && payment.ProviderModifiedAt is { } known && modified < known)
        {
            await transaction.CommitAsync(ct);
            return PaymentUpdateResult.Stale;
        }

        var order = await orders.LoadForPaymentUpdateAsync(payment.OrderId, ct);
        payment.ProviderModifiedAt = status.ModifiedAt ?? now;
        payment.UpdatedAt = now;

        switch (status.State)
        {
            case ProviderPaymentState.Succeeded when payment.Status != PaymentAttemptStatus.Succeeded:
                payment.Status = PaymentAttemptStatus.Succeeded;
                payment.FailureReason = null;
                if (status.Amount is { } amount && amount != payment.Amount)
                {
                    payment.FailureReason = $"Сума від провайдера {amount:0.00} не збігається з {payment.Amount:0.00}";
                    outbox.Enqueue(new IntegrationAlert($"Розбіжність суми оплати {order.Number}", payment.FailureReason));
                    break;
                }

                var paid = await orders.MarkPaidAsync(order.Id, now, ct);
                if (paid.Changed)
                {
                    outbox.Enqueue(new PaymentSucceeded(order.Id));
                    outbox.Enqueue(new FiscalReceiptRequested(order.Id, FiscalTrigger.Payment));
                    if (paid.IsCancelled)
                    {
                        outbox.Enqueue(new OrderPaidAfterCancel(order.Id));
                    }
                }

                break;

            case ProviderPaymentState.Failed or ProviderPaymentState.Expired when payment.IsActive:
                payment.Status = status.State == ProviderPaymentState.Failed ? PaymentAttemptStatus.Failed : PaymentAttemptStatus.Expired;
                payment.FailureReason = status.FailureReason ?? (status.State == ProviderPaymentState.Expired ? "Час на оплату минув" : "Оплату відхилено");
                var hasSucceeded = await db.Set<Payment>().AnyAsync(p => p.OrderId == order.Id && p.Id != payment.Id && p.Status == PaymentAttemptStatus.Succeeded, ct);
                if (!hasSucceeded)
                {
                    await orders.MarkPaymentFailedAsync(order.Id, ct);
                }

                break;

            case ProviderPaymentState.Processing when payment.Status == PaymentAttemptStatus.Created:
                payment.Status = PaymentAttemptStatus.Processing;
                break;

            case ProviderPaymentState.Reversed:
                payment.Status = PaymentAttemptStatus.Reversed;
                break;
        }

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return PaymentUpdateResult.Applied;
    }
}
