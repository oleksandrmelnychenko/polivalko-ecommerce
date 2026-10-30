using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Sync;
using PoliValko.Ordering;
using PoliValko.Ordering.Api;
using PoliValko.Ordering.Domain;
using PoliValko.Payments.Domain;
using PoliValko.Payments.Providers;

namespace PoliValko.Payments;

public enum PaymentUpdateResult
{
    Applied,
    Duplicate,
    Stale,
    UnknownPayment,
}

/// <summary>
/// Єдиний шлях зміни статусу оплати: вебхук, фонова звірка й тестова оплата проходять тут.
/// Подія й зміна стану зберігаються в одній транзакції; повтор тієї самої події нічого не змінює.
/// </summary>
internal sealed class PaymentProcessor(PoliValkoDbContext db, IOutbox outbox, TimeProvider time, ILogger<PaymentProcessor> logger)
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

        // Повідомлення можуть приходити не за порядком: старіше за вже застосоване не відкочує стан.
        if (status.ModifiedAt is { } modified && payment.ProviderModifiedAt is { } known && modified < known)
        {
            await transaction.CommitAsync(ct);
            return PaymentUpdateResult.Stale;
        }

        var order = await db.Set<Order>().FirstAsync(o => o.Id == payment.OrderId, ct);
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

                if (order.MarkPaid(now, CheckoutEndpoints.PaymentActor))
                {
                    outbox.Enqueue(new PaymentSucceeded(order.Id));
                    outbox.Enqueue(new FiscalReceiptRequested(order.Id, FiscalTrigger.Payment));
                    if (order.Status == OrderStatus.Cancelled)
                    {
                        outbox.Enqueue(new IntegrationAlert(
                            $"Оплачено скасоване замовлення {order.Number}",
                            "Покупець оплатив замовлення після скасування. Оформіть повернення коштів в адмінці."));
                    }
                }

                break;

            case ProviderPaymentState.Failed or ProviderPaymentState.Expired when payment.IsActive:
                payment.Status = status.State == ProviderPaymentState.Failed ? PaymentAttemptStatus.Failed : PaymentAttemptStatus.Expired;
                payment.FailureReason = status.FailureReason ?? (status.State == ProviderPaymentState.Expired ? "Час на оплату минув" : "Оплату відхилено");
                var hasSucceeded = await db.Set<Payment>().AnyAsync(p => p.OrderId == order.Id && p.Id != payment.Id && p.Status == PaymentAttemptStatus.Succeeded, ct);
                if (!hasSucceeded)
                {
                    order.MarkPaymentFailed();
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
