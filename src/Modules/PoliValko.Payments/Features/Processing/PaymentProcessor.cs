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
    /// <summary>Note on a successful payment of an order another invoice had already paid.</summary>
    public const string ExtraPaymentNote = "Зайва оплата: замовлення вже оплачено іншим рахунком. Поверніть кошти в кабінеті провайдера.";

    public const string ExtraReturnedNote = "Зайву оплату повернено.";

    public const string OutsideReturnNote = "Кошти повернуто поза сайтом.";

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
                if (status.Amount is { } amount && amount != payment.Amount)
                {
                    var mismatch = $"Сума від провайдера {amount:0.00} не збігається з {payment.Amount:0.00}";
                    if (payment.FailureReason != mismatch)
                        outbox.Enqueue(new IntegrationAlert($"Розбіжність суми оплати {order.Number}", mismatch));
                    payment.FailureReason = mismatch;
                    // Leave this event retryable if the provider corrects the same event key.
                    await db.Database.ExecuteSqlAsync($"DELETE FROM payments.payment_events WHERE provider = {provider} AND event_key = {status.EventKey}", ct);
                    break;
                }

                payment.Status = PaymentAttemptStatus.Succeeded;
                payment.FailureReason = null;
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
                else
                {
                    // The order was already paid: this money is extra and goes back to the customer, not into a receipt.
                    payment.FailureReason = ExtraPaymentNote;
                    outbox.Enqueue(new IntegrationAlert(
                        $"Зайва оплата {order.Number}",
                        $"Замовлення вже оплачене, а рахунок {payment.ProviderPaymentId} оплачено ще раз на {payment.Amount:0.00} ₴. "
                        + $"Поверніть ці кошти покупцю в кабінеті провайдера {PaymentProviderNames.Display(provider)}: на сайті повернення оформлюється лише в межах суми замовлення."));
                }

                // Any other invoice of this order still open would take the money again.
                if (await db.Set<Payment>().AnyAsync(p => p.OrderId == order.Id && p.Id != payment.Id && (p.Status == PaymentAttemptStatus.Created || p.Status == PaymentAttemptStatus.Processing), ct))
                {
                    outbox.Enqueue(new PaymentCancellationRequested(order.Id, PaymentCancellationReason.OrderPaid));
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

            case ProviderPaymentState.Reversed when payment.Status == PaymentAttemptStatus.Succeeded:
                await ApplyReversalAsync(provider, payment, order, status, now, ct);
                break;

            case ProviderPaymentState.Reversed when payment.Status != PaymentAttemptStatus.Reversed:
                // Never seen as paid, so the order has nothing to undo.
                payment.Status = PaymentAttemptStatus.Reversed;
                break;
        }

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return PaymentUpdateResult.Applied;
    }

    /// <summary>
    /// The provider returned money on a paid invoice. The site's own refunds explain most reversals; anything else was
    /// returned outside the site (merchant cabinet, bank chargeback) and is recorded on the order and reported.
    /// </summary>
    private async Task ApplyReversalAsync(string providerName, Payment payment, OrderPaymentTarget order, ProviderPaymentStatus status, DateTimeOffset now, CancellationToken ct)
    {
        var provider = PaymentProviderNames.Display(providerName);
        var wasExtra = payment.FailureReason == ExtraPaymentNote;
        payment.Status = PaymentAttemptStatus.Reversed;
        if (wasExtra)
        {
            payment.FailureReason = ExtraReturnedNote;
            outbox.Enqueue(new IntegrationAlert(
                $"Зайву оплату {order.Number} повернено",
                $"Рахунок {payment.ProviderPaymentId} на {payment.Amount:0.00} ₴ повернено покупцю. Замовлення лишається оплаченим."));
            return;
        }

        // A full reversal may not say what remains on the invoice; then all of it was returned.
        var returned = payment.Amount - Math.Clamp(status.RemainingAmount ?? 0m, 0m, payment.Amount);
        var unaccounted = returned - await orders.SumProviderRefundsAsync(order.Id, ct);
        if (unaccounted <= 0)
        {
            return;
        }

        payment.FailureReason = OutsideReturnNote;
        var cover = await db.Set<Payment>()
            .Where(p => p.OrderId == order.Id && p.Id != payment.Id && p.Status == PaymentAttemptStatus.Succeeded)
            .OrderBy(p => p.CreatedAt)
            .FirstOrDefaultAsync(ct);
        if (cover is not null)
        {
            // An extra payment still holds the order's money: it now pays for the order and must not be returned.
            cover.FailureReason = null;
            outbox.Enqueue(new IntegrationAlert(
                $"Оплату {order.Number} повернено поза сайтом",
                $"Провайдер {provider} повернув {unaccounted:0.00} ₴ за рахунком {payment.ProviderPaymentId}. Замовлення лишається оплаченим "
                + $"рахунком {cover.ProviderPaymentId}, який досі вважався зайвою оплатою: його повертати не потрібно."));
            return;
        }

        if (await orders.RecordOutsideRefundAsync(order.Id, unaccounted, provider, now, ct) is { } refundId)
        {
            outbox.Enqueue(new FiscalReceiptRequested(order.Id, FiscalTrigger.Refund, refundId));
            outbox.Enqueue(new IntegrationAlert(
                $"Кошти за {order.Number} повернуто поза сайтом",
                $"Провайдер {provider} повернув {unaccounted:0.00} ₴ за рахунком {payment.ProviderPaymentId} (повернення в кабінеті мерчанта або банківське сторно). "
                + "Замовлення позначено «Кошти повернено», чек повернення видано автоматично. Перевірте, чи товар не відправлено, і за потреби скасуйте замовлення."));
            return;
        }

        outbox.Enqueue(new IntegrationAlert(
            $"Часткове повернення за {order.Number} поза сайтом",
            $"Провайдер {provider} повернув {unaccounted:0.00} ₴ за рахунком {payment.ProviderPaymentId} поза сайтом. Сайт не знає, за які позиції, "
            + "тому замовлення не змінено. Звірте повернення в кабінеті провайдера й оформіть чек повернення вручну."));
    }
}
